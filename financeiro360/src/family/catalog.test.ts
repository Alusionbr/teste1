import assert from "node:assert/strict";
import test from "node:test";
import {
  builtinItems,
  catalogCards,
  composeName,
  entryCard,
  filterCards,
  guessCategory,
  offerLabel,
  parseFlyerText,
  sortCards,
  validateCatalogDraft,
} from "./catalog.ts";
import type { CatalogEntry } from "./model.ts";

const entry = (over: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id: "1", home_id: "h", name: "Arroz Tio João 5 kg", brand: "", size: "", unit: "unidade", category: "mercearia",
  store: "Atacadão", price_cents: 2490, offer_until: "2026-10-12", barcode: "", source: "manual", created_by: "a", created_at: "2026-10-05T10:00:00Z", ...over,
});
const all = { store: "all", category: "all", term: "" };

test("built-in shortcuts carry no invented brand, size or price", () => {
  const keys = new Set(builtinItems.map((i) => i.key));
  assert.equal(keys.size, builtinItems.length);
  assert.ok(builtinItems.length >= 90);
  for (const i of builtinItems) {
    assert.ok(i.name && i.unit && i.category, i.name);
    assert.equal(i.price_cents, null);
    assert.equal(i.offer_until, null);
    assert.deepEqual([i.brand, i.size, i.barcode], ["", "", ""], i.name);
  }
});

test("search ignores accents, case and order, and also finds brands", () => {
  const cards = catalogCards([]);
  const names = (term: string) => filterCards(cards, { ...all, term }).map((c) => c.name);
  assert.ok(names("feijao").includes("Feijão carioca"));
  assert.deepEqual(names("TIO JOAO arroz"), [], "brands are not part of the shortcuts");
  assert.ok(names("ARRÓZ").includes("Arroz"));
  // Marcas só aparecem nos itens salvos (vindos da API ou criados pela casa), nunca nos atalhos.
  assert.deepEqual(names("camil"), []);
  const saved = filterCards(catalogCards([entry({ id: "s", name: "Arroz Tipo 1 5kg", brand: "Camil", size: "5 kg", source: "off", barcode: "7896006711155", offer_until: null, price_cents: null })]), { ...all, term: "camil" });
  assert.deepEqual(saved.map((c) => c.name), ["Arroz Tipo 1 5kg"]);
  assert.ok(names("limpeza").includes("Detergente líquido"));
  assert.deepEqual(names("zzzz"), []);
  assert.ok(filterCards(cards, { ...all, category: "bebidas" }).every((c) => c.category === "bebidas"));
});

test("store filter keeps generic items and only matching custom entries and offers", () => {
  const mine = [
    entry({ id: "a", store: "Atacadão" }),
    entry({ id: "b", store: "Sam's Club", name: "Detergente Ypê" }),
    entry({ id: "c", store: "", name: "Item de qualquer mercado", offer_until: null, price_cents: null }),
  ];
  const names = (store: string) => filterCards(catalogCards(mine, "2026-10-05"), { ...all, store }).map((c) => c.name);
  assert.ok(names("Atacadão").includes("Arroz Tio João 5 kg"));
  assert.ok(!names("Atacadão").includes("Detergente Ypê"));
  assert.ok(names("Atacadão").includes("Item de qualquer mercado"));
  assert.ok(names("Atacadão").includes("Arroz"), "built-in items belong to every store");
  assert.ok(names("Sam's Club").includes("Detergente Ypê"));
  assert.ok(names("all").includes("Detergente Ypê"));
});

test("expired offers are hidden and labelled", () => {
  const old = entryCard(entry({ offer_until: "2026-10-01" }), "2026-10-05");
  const live = entryCard(entry(), "2026-10-05");
  assert.equal(old.expired, true);
  assert.equal(offerLabel(old), "Oferta vencida");
  assert.equal(offerLabel(live), "Oferta até 12/10");
  assert.equal(filterCards([old, live], all).length, 1);
  assert.equal(entryCard(entry({ id: "local-9" })).local, true);
});

test("offers come first, then own items, then the ready-made catalog", () => {
  const mine = [
    entry({ id: "x", name: "Meu item", offer_until: null, price_cents: null }),
    entry({ id: "y", name: "Oferta" }),
  ];
  const order = sortCards(catalogCards(mine, "2026-10-05")).slice(0, 3).map((c) => c.source);
  assert.deepEqual(order, ["offer", "mine", "builtin"]);
});

test("composed name does not repeat brand or size already written", () => {
  assert.equal(composeName("Arroz", "Camil", "5 kg"), "Arroz Camil 5 kg");
  assert.equal(composeName("Arroz Camil 5 kg", "camil", "5 KG"), "Arroz Camil 5 kg");
  assert.equal(composeName("Ovos", "", "12 un"), "Ovos 12 un");
  assert.equal(composeName("Arroz Tipo 1 Camil 5kg", "Camil", "5 kg"), "Arroz Tipo 1 Camil 5kg", "5kg equals 5 kg");
  assert.equal(composeName("Arroz Tipo 1 5kg", "Camil", "5 kg"), "Arroz Tipo 1 5kg Camil");
  assert.equal(composeName(composeName("Banana", "", ""), "prata"), "Banana prata");
  assert.equal(composeName(" Leite  ", "", ""), "Leite");
});

test("category guess uses the ready-made catalog and falls back to grocery", () => {
  assert.equal(guessCategory("Sabão em pó Omo 2kg"), "limpeza");
  assert.equal(guessCategory("Papel higiênico 12 rolos"), "higiene");
  assert.equal(guessCategory("Coca-Cola refrigerante 2L"), "bebidas");
  assert.equal(guessCategory("Salsicha"), "carnes");
  assert.equal(guessCategory("Salsichão misterioso"), "mercearia");
  assert.equal(guessCategory("Produto desconhecido"), "mercearia");
  assert.equal(guessCategory("Detergente Ypê 500ml"), "limpeza");
  assert.equal(guessCategory("Água 1,5 L"), "mercearia", "ambiguous first word falls back");
});

test("flyer text becomes draft offers; the last price wins and headers are skipped", () => {
  const text = [
    "OFERTAS DA SEMANA",
    "Arroz Tio João 5 kg - R$ 24,90",
    "• Feijão Camil 1kg R$ 7,49 cada",
    "Óleo de soja Liza 900 ml de R$ 8,99 por R$ 6,99",
    "Detergente Ypê 500ml 2,19",
    "Leite integral 1 L R$ 1.234,56",
    "Café Pilão 500 g: R$ 18",
    "Válido até 12/10 ou enquanto durarem os estoques",
    "R$ 5,00",
    "",
  ].join("\n");
  const { rows, skipped } = parseFlyerText(text);
  assert.deepEqual(
    rows.map((r) => [r.name, r.price_cents]),
    [
      ["Arroz Tio João 5 kg", 2490],
      ["Feijão Camil 1kg", 749],
      ["Óleo de soja Liza 900 ml", 699],
      ["Detergente Ypê 500ml", 219],
      ["Leite integral 1 L", 123456],
      ["Café Pilão 500 g", 1800],
    ],
  );
  assert.equal(rows[2].category, "mercearia");
  assert.equal(rows[3].category, "limpeza");
  assert.equal(skipped, 3, "header, validity line and price without a name");
});

test("flyer import is capped at 100 offers", () => {
  const text = Array.from({ length: 120 }, (_, i) => `Produto ${String.fromCharCode(97 + (i % 26))}${i} R$ 1,00`).join("\n");
  assert.equal(parseFlyerText(text).rows.length, 100);
});

test("shortcuts tell packaged products (searched online) from loose ones (added directly)", () => {
  const by = (name: string) => builtinItems.find((i) => i.name === name)!;
  assert.equal(by("Arroz").packaged, true);
  assert.equal(by("Detergente líquido").packaged, true);
  assert.equal(by("Banana").packaged, false);
  assert.equal(by("Carne moída").packaged, false);
  assert.equal(by("Alface").packaged, false);
});

test("catalog drafts are validated before reaching the database", () => {
  const draft = { name: "  Arroz   Camil ", brand: "Camil", size: "5 kg", unit: "pacote", category: "mercearia", store: "Atacadão", price_cents: 2490, offer_until: "2026-10-12", barcode: "", source: "manual" };
  assert.equal(validateCatalogDraft(draft).name, "Arroz Camil");
  assert.throws(() => validateCatalogDraft({ ...draft, name: "  " }), /nome/);
  assert.throws(() => validateCatalogDraft({ ...draft, category: "outra" }), /categoria/);
  assert.throws(() => validateCatalogDraft({ ...draft, price_cents: null }), /preço da oferta/);
  assert.throws(() => validateCatalogDraft({ ...draft, offer_until: "2026-02-30" }), /data/);
  assert.throws(() => validateCatalogDraft({ ...draft, price_cents: -1 }), /preço/);
  assert.doesNotThrow(() => validateCatalogDraft({ ...draft, offer_until: null, price_cents: null }));
  assert.doesNotThrow(() => validateCatalogDraft({ ...draft, offer_until: null, price_cents: null, barcode: "7896006711155", source: "off" }));
  assert.throws(() => validateCatalogDraft({ ...draft, barcode: "12ab" }), /barras/);
  assert.throws(() => validateCatalogDraft({ ...draft, source: "scraper" }), /Origem/);
});

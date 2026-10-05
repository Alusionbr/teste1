// Catálogo de mercado: itens comuns já prontos (sem preço), itens criados pela casa
// e ofertas de encarte. Funções puras, sem tela nem banco.
import { validIsoDate } from "../logic.ts";
import { today, type CatalogEntry } from "./model.ts";
import { formatDate } from "./home.ts";

export const catalogCategories = {
  mercearia: { label: "Mercearia", emoji: "🥫" },
  cafe: { label: "Café e matinais", emoji: "☕" },
  laticinios: { label: "Laticínios e frios", emoji: "🧀" },
  carnes: { label: "Carnes e ovos", emoji: "🥩" },
  hortifruti: { label: "Hortifrúti", emoji: "🥬" },
  padaria: { label: "Padaria e congelados", emoji: "🍞" },
  bebidas: { label: "Bebidas", emoji: "🥤" },
  limpeza: { label: "Limpeza", emoji: "🧽" },
  higiene: { label: "Higiene", emoji: "🧴" },
  casa: { label: "Utilidades", emoji: "🔋" },
} as const;
export type CatalogCategory = keyof typeof catalogCategories;
export const categoryIds = Object.keys(catalogCategories) as CatalogCategory[];
export const catalogStores = ["Atacadão", "Sam's Club", "Outro mercado"];
export const catalogUnits = ["unidade", "pacote", "caixa", "fardo", "garrafa", "lata", "bandeja", "pote", "maço", "kg", "litro", "dúzia", "rolo"];

export const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export interface CatalogCard {
  key: string;
  source: "builtin" | "mine" | "offer";
  id: string;
  name: string;
  category: string;
  unit: string;
  brand: string;
  size: string;
  barcode: string;
  // Item genérico embalado: ao tocar, busca os produtos reais nas bases abertas.
  packaged: boolean;
  store: string;
  price_cents: number | null;
  offer_until: string | null;
  expired: boolean;
  local: boolean;
}

// Atalhos de busca: só nome genérico, categoria e unidade. Nenhuma marca, tamanho ou preço é
// escrito aqui: os produtos reais (nome, marca, tamanho) vêm das bases abertas (off.ts).
// "embalado" = tem código de barras e é buscado na internet; hortifrúti e carnes a granel entram direto.
type Row = [string, CatalogCategory, string, boolean];
const rows: Row[] = [
  ["Arroz", "mercearia", "pacote", true],
  ["Feijão carioca", "mercearia", "pacote", true],
  ["Feijão preto", "mercearia", "pacote", true],
  ["Macarrão espaguete", "mercearia", "pacote", true],
  ["Macarrão parafuso", "mercearia", "pacote", true],
  ["Macarrão instantâneo", "mercearia", "unidade", true],
  ["Açúcar refinado", "mercearia", "pacote", true],
  ["Açúcar cristal", "mercearia", "pacote", true],
  ["Sal refinado", "mercearia", "pacote", true],
  ["Óleo de soja", "mercearia", "garrafa", true],
  ["Azeite de oliva", "mercearia", "garrafa", true],
  ["Vinagre", "mercearia", "garrafa", true],
  ["Farinha de trigo", "mercearia", "pacote", true],
  ["Farinha de mandioca", "mercearia", "pacote", true],
  ["Fubá", "mercearia", "pacote", true],
  ["Amido de milho", "mercearia", "caixa", true],
  ["Molho de tomate", "mercearia", "unidade", true],
  ["Extrato de tomate", "mercearia", "unidade", true],
  ["Milho verde", "mercearia", "lata", true],
  ["Ervilha", "mercearia", "lata", true],
  ["Atum", "mercearia", "lata", true],
  ["Sardinha", "mercearia", "lata", true],
  ["Maionese", "mercearia", "unidade", true],
  ["Ketchup", "mercearia", "unidade", true],
  ["Mostarda", "mercearia", "unidade", true],
  ["Leite condensado", "mercearia", "caixa", true],
  ["Creme de leite", "mercearia", "caixa", true],
  ["Biscoito recheado", "mercearia", "pacote", true],
  ["Biscoito água e sal", "mercearia", "pacote", true],
  ["Gelatina em pó", "mercearia", "caixa", true],
  ["Tempero completo", "mercearia", "unidade", true],
  ["Caldo de galinha", "mercearia", "caixa", true],
  ["Café torrado e moído", "cafe", "pacote", true],
  ["Café solúvel", "cafe", "unidade", true],
  ["Achocolatado em pó", "cafe", "unidade", true],
  ["Aveia em flocos", "cafe", "unidade", true],
  ["Cereal matinal", "cafe", "caixa", true],
  ["Granola", "cafe", "pacote", true],
  ["Chá", "cafe", "caixa", true],
  ["Leite integral", "laticinios", "caixa", true],
  ["Leite desnatado", "laticinios", "caixa", true],
  ["Leite em pó", "laticinios", "unidade", true],
  ["Manteiga", "laticinios", "unidade", true],
  ["Margarina", "laticinios", "unidade", true],
  ["Requeijão", "laticinios", "unidade", true],
  ["Iogurte natural", "laticinios", "unidade", true],
  ["Queijo mussarela", "laticinios", "kg", false],
  ["Queijo prato", "laticinios", "kg", false],
  ["Presunto", "laticinios", "kg", false],
  ["Mortadela", "laticinios", "kg", false],
  ["Queijo ralado", "laticinios", "pacote", true],
  ["Ovos", "carnes", "bandeja", true],
  ["Peito de frango", "carnes", "kg", false],
  ["Coxa e sobrecoxa", "carnes", "kg", false],
  ["Frango inteiro", "carnes", "kg", false],
  ["Carne moída", "carnes", "kg", false],
  ["Acém", "carnes", "kg", false],
  ["Alcatra", "carnes", "kg", false],
  ["Patinho", "carnes", "kg", false],
  ["Linguiça toscana", "carnes", "kg", false],
  ["Calabresa", "carnes", "kg", false],
  ["Bacon", "carnes", "kg", false],
  ["Salsicha", "carnes", "pacote", true],
  ["Filé de peixe", "carnes", "kg", false],
  ["Banana", "hortifruti", "kg", false],
  ["Maçã", "hortifruti", "kg", false],
  ["Laranja", "hortifruti", "kg", false],
  ["Mamão", "hortifruti", "kg", false],
  ["Limão", "hortifruti", "kg", false],
  ["Abacate", "hortifruti", "kg", false],
  ["Melancia", "hortifruti", "unidade", false],
  ["Tomate", "hortifruti", "kg", false],
  ["Cebola", "hortifruti", "kg", false],
  ["Batata", "hortifruti", "kg", false],
  ["Cenoura", "hortifruti", "kg", false],
  ["Alho", "hortifruti", "kg", false],
  ["Chuchu", "hortifruti", "kg", false],
  ["Alface", "hortifruti", "unidade", false],
  ["Couve", "hortifruti", "maço", false],
  ["Cheiro-verde", "hortifruti", "maço", false],
  ["Pão de forma", "padaria", "pacote", true],
  ["Pão francês", "padaria", "kg", false],
  ["Pão de queijo congelado", "padaria", "pacote", true],
  ["Hambúrguer congelado", "padaria", "caixa", true],
  ["Nuggets", "padaria", "pacote", true],
  ["Lasanha congelada", "padaria", "unidade", true],
  ["Sorvete", "padaria", "unidade", true],
  ["Água mineral", "bebidas", "unidade", true],
  ["Refrigerante", "bebidas", "unidade", true],
  ["Suco pronto", "bebidas", "caixa", true],
  ["Suco em pó", "bebidas", "unidade", true],
  ["Cerveja", "bebidas", "unidade", true],
  ["Detergente líquido", "limpeza", "unidade", true],
  ["Sabão em pó", "limpeza", "caixa", true],
  ["Sabão líquido", "limpeza", "unidade", true],
  ["Sabão em barra", "limpeza", "pacote", true],
  ["Amaciante", "limpeza", "unidade", true],
  ["Água sanitária", "limpeza", "unidade", true],
  ["Desinfetante", "limpeza", "unidade", true],
  ["Multiuso", "limpeza", "unidade", true],
  ["Limpa vidros", "limpeza", "unidade", true],
  ["Esponja de cozinha", "limpeza", "pacote", true],
  ["Palha de aço", "limpeza", "pacote", true],
  ["Saco de lixo", "limpeza", "pacote", true],
  ["Papel toalha", "limpeza", "pacote", true],
  ["Papel higiênico", "higiene", "pacote", true],
  ["Sabonete", "higiene", "unidade", true],
  ["Creme dental", "higiene", "unidade", true],
  ["Escova de dente", "higiene", "unidade", true],
  ["Shampoo", "higiene", "unidade", true],
  ["Condicionador", "higiene", "unidade", true],
  ["Desodorante", "higiene", "unidade", true],
  ["Absorvente", "higiene", "pacote", true],
  ["Fralda", "higiene", "pacote", true],
  ["Lenço umedecido", "higiene", "pacote", true],
  ["Papel alumínio", "casa", "unidade", true],
  ["Filme plástico", "casa", "unidade", true],
  ["Guardanapo", "casa", "pacote", true],
  ["Copo descartável", "casa", "pacote", true],
  ["Pilhas", "casa", "pacote", true],
  ["Lâmpada LED", "casa", "unidade", true],
  ["Fósforo", "casa", "pacote", true],
];
export const builtinItems: CatalogCard[] = rows.map(([name, category, unit, packaged]) => ({
  key: "b:" + fold(name).replace(/[^a-z0-9]+/g, "-"),
  source: "builtin" as const,
  id: "",
  name,
  category,
  unit,
  brand: "",
  size: "",
  barcode: "",
  packaged,
  store: "",
  price_cents: null,
  offer_until: null,
  expired: false,
  local: false,
}));

export const isOffer = (e: Pick<CatalogEntry, "offer_until">) => e.offer_until !== null;
export const isExpired = (e: Pick<CatalogEntry, "offer_until">, date = today()) =>
  e.offer_until !== null && e.offer_until < date;

export function entryCard(e: CatalogEntry, date = today()): CatalogCard {
  return {
    key: "c:" + e.id,
    source: isOffer(e) ? "offer" : "mine",
    id: e.id,
    name: e.name,
    category: e.category,
    unit: e.unit,
    brand: e.brand,
    size: e.size,
    barcode: e.barcode || "",
    packaged: false,
    store: e.store,
    price_cents: e.price_cents,
    offer_until: e.offer_until,
    expired: isExpired(e, date),
    local: e.id.startsWith("local-"),
  };
}
export const catalogCards = (entries: CatalogEntry[], date = today()) => [
  ...entries.map((e) => entryCard(e, date)),
  ...builtinItems,
];

export interface CatalogFilter {
  store: string;
  category: string;
  term: string;
}
export function filterCards(cards: CatalogCard[], f: CatalogFilter) {
  const words = fold(f.term).split(/\s+/).filter(Boolean);
  return cards.filter((c) => {
    if (c.expired) return false;
    if (f.category !== "all" && c.category !== f.category) return false;
    if (f.store !== "all" && c.store && c.store !== f.store) return false;
    const label = catalogCategories[c.category as CatalogCategory]?.label || "";
    const haystack = fold([c.name, c.brand, c.size, label, c.store].join(" "));
    return words.every((w) => haystack.includes(w));
  });
}
const rank = { offer: 0, mine: 1, builtin: 2 } as const;
export function sortCards(cards: CatalogCard[]) {
  return [...cards].sort(
    (a, b) =>
      rank[a.source] - rank[b.source] ||
      categoryIds.indexOf(a.category as CatalogCategory) - categoryIds.indexOf(b.category as CatalogCategory) ||
      a.name.localeCompare(b.name, "pt-BR"),
  );
}

// "Arroz" + "Camil" + "5 kg" → "Arroz Camil 5 kg", sem repetir o que já está no nome.
export function composeName(name: string, brand = "", size = "") {
  const base = name.trim();
  const parts = [base];
  const squash = (text: string) => fold(text).replace(/\s+/g, "");
  for (const extra of [brand.trim(), size.trim()])
    if (extra && !parts.some((part) => squash(part).includes(squash(extra)))) parts.push(extra);
  return parts.join(" ");
}
export const offerLabel = (c: Pick<CatalogCard, "offer_until" | "expired">) =>
  c.offer_until ? (c.expired ? "Oferta vencida" : `Oferta até ${formatDate(c.offer_until).slice(0, 5)}`) : "";

export const catalogSources = ["manual", "flyer", "off"] as const;
export type CatalogDraft = Omit<CatalogEntry, "id" | "home_id" | "created_by" | "created_at">;
export function validateCatalogDraft(d: CatalogDraft): CatalogDraft {
  const name = d.name.trim().replace(/\s+/g, " ");
  if (!name || name.length > 120) throw Error("Diga o nome do item (até 120 letras).");
  if (d.brand.trim().length > 60 || d.size.trim().length > 40) throw Error("Marca ou tamanho muito longo.");
  if (!d.unit || d.unit.length > 20) throw Error("Escolha a unidade do item.");
  if (!(d.category in catalogCategories)) throw Error("Escolha uma categoria.");
  if (d.store.length > 40) throw Error("Nome do mercado muito longo.");
  if (d.barcode && !/^\d{8,14}$/.test(d.barcode)) throw Error("Código de barras inválido.");
  if (!catalogSources.includes(d.source as (typeof catalogSources)[number])) throw Error("Origem do item inválida.");
  if (d.price_cents !== null && (!Number.isSafeInteger(d.price_cents) || d.price_cents < 0))
    throw Error("Confira o preço.");
  if (d.offer_until !== null) {
    if (!validIsoDate(d.offer_until)) throw Error("Confira a data de validade da oferta.");
    if (d.price_cents === null) throw Error("Informe o preço da oferta.");
  }
  return { ...d, name, brand: d.brand.trim(), size: d.size.trim() };
}

// Tenta adivinhar a categoria pelo nome ("Arroz Tio João 5kg" → mercearia).
// 1) nome inteiro de um item do catálogo (o mais longo vence); 2) primeira palavra do item
// ("Detergente Ypê" → Detergente líquido), só quando todas as palavras iguais apontam à mesma categoria.
const matches = (text: string, term: string) =>
  new RegExp(`(^|[^a-z])${fold(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(s|es)?([^a-z]|$)`).test(text);
export function guessCategory(name: string): CatalogCategory {
  const text = fold(name);
  let best: CatalogCard | null = null;
  for (const item of builtinItems)
    if (matches(text, item.name) && (!best || item.name.length > best.name.length)) best = item;
  if (best) return best.category as CatalogCategory;
  const byFirstWord = new Set(
    builtinItems
      .filter((item) => {
        const first = item.name.split(/\s+/)[0];
        return first.length >= 4 && matches(text, first);
      })
      .map((item) => item.category),
  );
  return byFirstWord.size === 1 ? ([...byFirstWord][0] as CatalogCategory) : "mercearia";
}

export interface FlyerRow {
  name: string;
  price_cents: number;
  category: CatalogCategory;
}
const moneyToCents = (reais: string, cents?: string) =>
  Number(reais.replace(/\./g, "")) * 100 + Number((cents || "0").padEnd(2, "0"));
// Lê texto copiado de um encarte (site, WhatsApp, PDF): uma oferta por linha, com preço.
// Em "de R$ 29,90 por R$ 24,90" vale o último preço. Linhas sem preço são só contadas.
export function parseFlyerText(text: string) {
  const found: FlyerRow[] = [];
  let skipped = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const withSymbol = [...line.matchAll(/R\$\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/g)];
    const bare = withSymbol.length ? [] : [...line.matchAll(/(?<![\d,.])(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})(?![\d,])/g)];
    const matches = withSymbol.length ? withSymbol : bare;
    const last = matches[matches.length - 1];
    if (!last) {
      skipped++;
      continue;
    }
    let name = line;
    for (const m of matches) name = name.replace(m[0], " ");
    name = name
      .replace(/\s+/g, " ")
      .replace(/^[\s\-–—:|•*·.…>]+|[\s\-–—:|•*·.…>]+$/g, "");
    while (/\s(de|por|a|cada|apenas|só)$/i.test(name)) name = name.replace(/\s\S+$/, "");
    name = name.replace(/[\s\-–—:|•*·.…]+$/g, "").slice(0, 120);
    const cents = moneyToCents(last[1], last[2]);
    if (!/[a-zà-ú]{2}/i.test(name) || !Number.isSafeInteger(cents) || cents <= 0) {
      skipped++;
      continue;
    }
    found.push({ name, price_cents: cents, category: guessCategory(name) });
    if (found.length === 100) break;
  }
  return { rows: found, skipped };
}

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
  sizes: string[];
  brands: string[];
  store: string;
  price_cents: number | null;
  offer_until: string | null;
  expired: boolean;
  local: boolean;
}

// nome | categoria | unidade de compra | tamanhos | marcas comuns. Marcas são só sugestões:
// a pessoa pode escolher "sem preferência" ou digitar outra. Nenhum preço é embutido.
type Row = [string, CatalogCategory, string, string, string];
const rows: Row[] = [
  ["Arroz", "mercearia", "pacote", "1 kg|5 kg", "Tio João|Camil|Prato Fino|Kicaldo|Namorado"],
  ["Feijão carioca", "mercearia", "pacote", "1 kg|2 kg", "Camil|Kicaldo|Tio João|Broto Legal"],
  ["Feijão preto", "mercearia", "pacote", "1 kg", "Camil|Kicaldo|Tio João"],
  ["Macarrão espaguete", "mercearia", "pacote", "500 g", "Renata|Adria|Barilla|Galo|Vitarella"],
  ["Macarrão parafuso", "mercearia", "pacote", "500 g", "Renata|Adria|Galo|Vitarella"],
  ["Macarrão instantâneo", "mercearia", "unidade", "", "Nissin"],
  ["Açúcar refinado", "mercearia", "pacote", "1 kg|5 kg", "União|Caravelas|Guarani|Da Barra"],
  ["Açúcar cristal", "mercearia", "pacote", "5 kg", "União|Caravelas|Guarani"],
  ["Sal refinado", "mercearia", "pacote", "1 kg", "Cisne|Lebre|Smart"],
  ["Óleo de soja", "mercearia", "garrafa", "900 ml", "Soya|Liza|Concórdia|Cocamar"],
  ["Azeite de oliva", "mercearia", "garrafa", "500 ml", "Gallo|Andorinha|Cocinero"],
  ["Vinagre", "mercearia", "garrafa", "750 ml", "Castelo|Minhoto"],
  ["Farinha de trigo", "mercearia", "pacote", "1 kg|5 kg", "Dona Benta|Renata|Sol|Anaconda"],
  ["Farinha de mandioca", "mercearia", "pacote", "1 kg", "Yoki|Kicaldo"],
  ["Fubá", "mercearia", "pacote", "1 kg", "Yoki|Sinhá|Kicaldo"],
  ["Amido de milho", "mercearia", "caixa", "200 g|500 g", "Maizena|Yoki|Duryea"],
  ["Molho de tomate", "mercearia", "unidade", "340 g", "Pomarola|Quero|Fugini|Heinz"],
  ["Extrato de tomate", "mercearia", "unidade", "340 g", "Elefante|Quero|Cica"],
  ["Milho verde", "mercearia", "lata", "170 g", "Quero|Predilecta|Bonduelle"],
  ["Ervilha", "mercearia", "lata", "170 g", "Quero|Predilecta|Bonduelle"],
  ["Atum", "mercearia", "lata", "170 g", "Gomes da Costa|Coqueiro|Pescador"],
  ["Sardinha", "mercearia", "lata", "125 g", "Gomes da Costa|Coqueiro|Pescador"],
  ["Maionese", "mercearia", "unidade", "500 g|3 kg", "Hellmann's|Heinz|Quero"],
  ["Ketchup", "mercearia", "unidade", "380 g", "Heinz|Hemmer|Quero"],
  ["Mostarda", "mercearia", "unidade", "200 g", "Heinz|Hemmer|Quero"],
  ["Leite condensado", "mercearia", "caixa", "395 g", "Moça|Piracanina|Italac"],
  ["Creme de leite", "mercearia", "caixa", "200 g", "Nestlé|Piracanina|Italac"],
  ["Biscoito recheado", "mercearia", "pacote", "", "Trakinas|Oreo|Bono|Passatempo"],
  ["Biscoito água e sal", "mercearia", "pacote", "", "Vitarella|Marilan|Adria|Piraquê"],
  ["Gelatina em pó", "mercearia", "caixa", "", "Dr. Oetker|Royal|Sol"],
  ["Tempero completo", "mercearia", "unidade", "", "Sazón|Arisco|Kitano"],
  ["Caldo de galinha", "mercearia", "caixa", "", "Knorr|Maggi|Sazón"],
  ["Café torrado e moído", "cafe", "pacote", "500 g|250 g", "Pilão|3 Corações|Melitta|Café do Ponto|Caboclo"],
  ["Café solúvel", "cafe", "unidade", "50 g|100 g", "Nescafé|Pilão|3 Corações"],
  ["Achocolatado em pó", "cafe", "unidade", "400 g|700 g", "Nescau|Toddy|Ovomaltine"],
  ["Aveia em flocos", "cafe", "unidade", "170 g|500 g", "Quaker|Yoki|Mãe Terra"],
  ["Cereal matinal", "cafe", "caixa", "", "Kellogg's|Nesfit|Nescau Cereal"],
  ["Granola", "cafe", "pacote", "", "Jasmine|Yoki|Mãe Terra"],
  ["Chá", "cafe", "caixa", "", "Matte Leão|Dr. Oetker"],
  ["Leite integral", "laticinios", "caixa", "1 L|caixa com 12", "Italac|Piracanina|Parmalat|Tirol|Itambé|Ninho"],
  ["Leite desnatado", "laticinios", "caixa", "1 L|caixa com 12", "Italac|Piracanina|Parmalat|Itambé"],
  ["Leite em pó", "laticinios", "unidade", "400 g", "Ninho|Itambé|Piracanina"],
  ["Manteiga", "laticinios", "unidade", "200 g|500 g", "Aviação|Président|Itambé"],
  ["Margarina", "laticinios", "unidade", "500 g", "Qualy|Doriana|Delícia"],
  ["Requeijão", "laticinios", "unidade", "200 g", "Catupiry|Itambé|Vigor|Tirolez"],
  ["Iogurte natural", "laticinios", "unidade", "170 g|1 kg", "Nestlé|Danone|Vigor|Batavo"],
  ["Queijo mussarela", "laticinios", "kg", "", "Tirolez|Itambé|Sadia"],
  ["Queijo prato", "laticinios", "kg", "", "Tirolez|Itambé"],
  ["Presunto", "laticinios", "kg", "", "Sadia|Perdigão|Seara"],
  ["Mortadela", "laticinios", "kg", "", "Sadia|Perdigão|Seara"],
  ["Queijo ralado", "laticinios", "pacote", "50 g|100 g", "Tirolez|Vigor"],
  ["Ovos", "carnes", "bandeja", "12 un|30 un", ""],
  ["Peito de frango", "carnes", "kg", "", "Sadia|Seara|Aurora"],
  ["Coxa e sobrecoxa", "carnes", "kg", "", "Sadia|Seara|Aurora"],
  ["Frango inteiro", "carnes", "kg", "", "Sadia|Seara|Aurora"],
  ["Carne moída", "carnes", "kg", "", ""],
  ["Acém", "carnes", "kg", "", ""],
  ["Alcatra", "carnes", "kg", "", ""],
  ["Patinho", "carnes", "kg", "", ""],
  ["Linguiça toscana", "carnes", "kg", "", "Sadia|Perdigão|Seara"],
  ["Calabresa", "carnes", "kg", "", "Sadia|Perdigão|Seara"],
  ["Bacon", "carnes", "kg", "", "Sadia|Perdigão|Seara"],
  ["Salsicha", "carnes", "pacote", "500 g", "Sadia|Perdigão|Seara"],
  ["Filé de peixe", "carnes", "kg", "", ""],
  ["Banana", "hortifruti", "kg", "", ""],
  ["Maçã", "hortifruti", "kg", "", ""],
  ["Laranja", "hortifruti", "kg", "", ""],
  ["Mamão", "hortifruti", "kg", "", ""],
  ["Limão", "hortifruti", "kg", "", ""],
  ["Abacate", "hortifruti", "kg", "", ""],
  ["Melancia", "hortifruti", "unidade", "", ""],
  ["Tomate", "hortifruti", "kg", "", ""],
  ["Cebola", "hortifruti", "kg", "", ""],
  ["Batata", "hortifruti", "kg", "", ""],
  ["Cenoura", "hortifruti", "kg", "", ""],
  ["Alho", "hortifruti", "kg", "", ""],
  ["Chuchu", "hortifruti", "kg", "", ""],
  ["Alface", "hortifruti", "unidade", "", ""],
  ["Couve", "hortifruti", "maço", "", ""],
  ["Cheiro-verde", "hortifruti", "maço", "", ""],
  ["Pão de forma", "padaria", "pacote", "500 g", "Pullman|Wickbold|Seven Boys|Plus Vita"],
  ["Pão francês", "padaria", "kg", "", ""],
  ["Pão de queijo congelado", "padaria", "pacote", "1 kg", "Forno de Minas"],
  ["Hambúrguer congelado", "padaria", "caixa", "", "Sadia|Perdigão|Seara"],
  ["Nuggets", "padaria", "pacote", "300 g", "Sadia|Perdigão|Seara"],
  ["Lasanha congelada", "padaria", "unidade", "", "Sadia|Perdigão|Seara"],
  ["Sorvete", "padaria", "unidade", "2 L", "Kibon|Nestlé|Jundiá"],
  ["Água mineral", "bebidas", "unidade", "1,5 L|fardo com 6|galão 20 L", "Crystal|Bonafont|Minalba|Indaiá"],
  ["Refrigerante", "bebidas", "unidade", "2 L|lata 350 ml|fardo com 12 latas", "Coca-Cola|Guaraná Antarctica|Fanta|Sprite|Pepsi"],
  ["Suco pronto", "bebidas", "caixa", "1 L", "Del Valle|Maguary|Tial|Ades"],
  ["Suco em pó", "bebidas", "unidade", "", "Tang|Clight|Mid"],
  ["Cerveja", "bebidas", "unidade", "lata 350 ml|fardo com 12 latas", "Skol|Brahma|Antarctica|Heineken"],
  ["Detergente líquido", "limpeza", "unidade", "500 ml", "Ypê|Limpol|Minuano"],
  ["Sabão em pó", "limpeza", "caixa", "1 kg|2 kg|5 kg", "Omo|Ariel|Brilhante|Ypê|Tixan"],
  ["Sabão líquido", "limpeza", "unidade", "3 L", "Omo|Ariel|Brilhante|Ypê"],
  ["Sabão em barra", "limpeza", "pacote", "5 un", "Ypê|Minuano"],
  ["Amaciante", "limpeza", "unidade", "2 L", "Comfort|Downy|Ypê"],
  ["Água sanitária", "limpeza", "unidade", "2 L", "Qboa|Candura|Ypê"],
  ["Desinfetante", "limpeza", "unidade", "2 L", "Pinho Sol|Veja|Ypê"],
  ["Multiuso", "limpeza", "unidade", "500 ml", "Veja|Ypê|Mr Músculo"],
  ["Limpa vidros", "limpeza", "unidade", "500 ml", "Veja|Ypê"],
  ["Esponja de cozinha", "limpeza", "pacote", "", "Scotch-Brite|Bettanin|Assolan"],
  ["Palha de aço", "limpeza", "pacote", "", "Bombril|Assolan"],
  ["Saco de lixo", "limpeza", "pacote", "30 L|50 L|100 L", ""],
  ["Papel toalha", "limpeza", "pacote", "2 rolos|6 rolos", "Snob|Scott|Personal"],
  ["Papel higiênico", "higiene", "pacote", "12 rolos|16 rolos|30 rolos", "Neve|Personal|Scott|Mili|Snob"],
  ["Sabonete", "higiene", "unidade", "85 g|caixa com 12", "Dove|Lux|Protex|Nivea"],
  ["Creme dental", "higiene", "unidade", "90 g", "Colgate|Oral-B|Sorriso|Close Up"],
  ["Escova de dente", "higiene", "unidade", "", "Colgate|Oral-B|Condor"],
  ["Shampoo", "higiene", "unidade", "350 ml", "Dove|Seda|Pantene|Elseve|Clear"],
  ["Condicionador", "higiene", "unidade", "350 ml", "Dove|Seda|Pantene|Elseve"],
  ["Desodorante", "higiene", "unidade", "150 ml", "Rexona|Dove|Nivea|Monange"],
  ["Absorvente", "higiene", "pacote", "", "Always|Intimus|Sempre Livre"],
  ["Fralda", "higiene", "pacote", "", "Pampers|Huggies|MamyPoko"],
  ["Lenço umedecido", "higiene", "pacote", "", "Huggies|Pampers"],
  ["Papel alumínio", "casa", "unidade", "", "Wyda|Reynolds"],
  ["Filme plástico", "casa", "unidade", "", "Wyda"],
  ["Guardanapo", "casa", "pacote", "", "Snob|Mili|Scott"],
  ["Copo descartável", "casa", "pacote", "200 ml", ""],
  ["Pilhas", "casa", "pacote", "AA|AAA", "Duracell|Panasonic|Elgin"],
  ["Lâmpada LED", "casa", "unidade", "9 W", "Philips|Osram|Taschibra"],
  ["Fósforo", "casa", "pacote", "", "Fiat Lux"],
];
const split = (text: string) => (text ? text.split("|") : []);
export const builtinItems: CatalogCard[] = rows.map(([name, category, unit, sizes, brands]) => ({
  key: "b:" + fold(name).replace(/[^a-z0-9]+/g, "-"),
  source: "builtin" as const,
  id: "",
  name,
  category,
  unit,
  sizes: split(sizes),
  brands: split(brands),
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
    sizes: e.size ? [e.size] : [],
    brands: e.brand ? [e.brand] : [],
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
    const haystack = fold([c.name, c.brands.join(" "), label, c.store].join(" "));
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
  for (const extra of [brand.trim(), size.trim()])
    if (extra && !fold(base).includes(fold(extra))) parts.push(extra);
  return parts.join(" ");
}
export const offerLabel = (c: Pick<CatalogCard, "offer_until" | "expired">) =>
  c.offer_until ? (c.expired ? "Oferta vencida" : `Oferta até ${formatDate(c.offer_until).slice(0, 5)}`) : "";

export type CatalogDraft = Omit<CatalogEntry, "id" | "home_id" | "created_by" | "created_at">;
export function validateCatalogDraft(d: CatalogDraft): CatalogDraft {
  const name = d.name.trim().replace(/\s+/g, " ");
  if (!name || name.length > 120) throw Error("Diga o nome do item (até 120 letras).");
  if (d.brand.trim().length > 60 || d.size.trim().length > 40) throw Error("Marca ou tamanho muito longo.");
  if (!d.unit || d.unit.length > 20) throw Error("Escolha a unidade do item.");
  if (!(d.category in catalogCategories)) throw Error("Escolha uma categoria.");
  if (d.store.length > 40) throw Error("Nome do mercado muito longo.");
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

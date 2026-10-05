// Produtos reais de bancos abertos e gratuitos: Open Food Facts (alimentos), Open Beauty Facts
// (higiene) e Open Products Facts (limpeza e utilidades). Mesma API, licença ODbL, acesso direto
// do navegador (cabeçalho CORS liberado). Preços NÃO vêm daqui: não há API pública de preços
// brasileiros (o Open Prices tem pouquíssimos preços em reais). Só o nome do produto buscado sai do aparelho.
//
// Regras de uso do serviço: 10 buscas por minuto e 15 consultas por código por minuto, e é proibido
// usar a busca para autocompletar. Por isso toda busca parte de um toque e há um limitador local.
import type { CatalogCategory } from "./catalog.ts";

export type OffSource = "food" | "beauty" | "products";
export const offHosts: Record<OffSource, string> = {
  food: "https://br.openfoodfacts.org",
  beauty: "https://br.openbeautyfacts.org",
  products: "https://br.openproductsfacts.org",
};
export const offCredit = {
  name: "Open Food Facts",
  url: "https://world.openfoodfacts.org",
  license: "Dados colaborativos sob licença ODbL; podem conter erros.",
};
// Qual banco consultar para cada categoria do catálogo.
export const sourceFor = (category: string): OffSource =>
  category === "higiene" ? "beauty" : category === "limpeza" || category === "casa" ? "products" : "food";

export interface OffProduct {
  code: string;
  name: string;
  brand: string;
  size: string;
  category: CatalogCategory;
  modified: number;
}
export class OffError extends Error {
  kind: "limit" | "down" | "offline" | "format";
  constructor(message: string, kind: "limit" | "down" | "offline" | "format") {
    super(message);
    this.kind = kind;
  }
}

const FIELDS = "code,product_name,brands,quantity,categories_tags,last_modified_t";
const SEARCH_LIMIT = 9; // o serviço permite 10 por minuto; sobra uma de folga
const CODE_LIMIT = 14; // o serviço permite 15 por minuto
const WINDOW_MS = 60_000;
const TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 7 * 24 * 3600_000;
const CACHE_MAX = 40;
const CACHE_KEY = "financeiro360:off-search:v1";

// Limitador de janela deslizante: recusa com o tempo de espera em vez de arriscar bloqueio.
export class RateLimiter {
  private hits: number[] = [];
  private max: number;
  private windowMs: number;
  constructor(max: number, windowMs = WINDOW_MS) {
    this.max = max;
    this.windowMs = windowMs;
  }
  take(now = Date.now()) {
    this.hits = this.hits.filter((t) => now - t < this.windowMs);
    if (this.hits.length >= this.max) return Math.max(1, Math.ceil(((this.hits[0] ?? now) + this.windowMs - now) / 1000));
    this.hits.push(now);
    return 0;
  }
}
const searchLimiter = new RateLimiter(SEARCH_LIMIT);
const codeLimiter = new RateLimiter(CODE_LIMIT);

const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const titleCase = (t: string) => t.toLowerCase().replace(/(^|[\s\-'/])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase());

// Etiquetas de categoria do banco → categoria do catálogo. Etiquetas genéricas que aparecem em quase todo
// alimento vegetal (ex.: "plant-based-foods-and-beverages") são ignoradas; as demais casam por palavra inteira.
const genericTags = new Set(["plant-based-foods-and-beverages", "plant-based-foods", "foods-and-beverages", "foods"]);
const tagRules: [RegExp, CatalogCategory][] = [
  [/(^|-)(beverages|waters|sodas|juices|beers|drinks)(-|$)/, "bebidas"],
  [/(^|-)(dairies|cheeses|yogurts|milks|butters|creams|cold-cuts|hams)(-|$)/, "laticinios"],
  [/(^|-)(meats|poultry|fishes|seafood|eggs|sausages)(-|$)/, "carnes"],
  [/(^|-)(fruits|vegetables)(-|$)/, "hortifruti"],
  [/(^|-)(breads|pizzas|ice-creams|pastries)(-|$)|^frozen-foods$/, "padaria"],
  [/(^|-)(coffees|teas|breakfast-cereals|chocolate-powders|spreads|jams)(-|$)/, "cafe"],
];
export function categoryFromTags(tags: unknown, source: OffSource): CatalogCategory {
  if (source === "beauty") return "higiene";
  if (source === "products") return "limpeza";
  const names = (Array.isArray(tags) ? tags : [])
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.replace(/^[a-z]{2}:/, "").toLowerCase())
    .filter((t) => !genericTags.has(t));
  for (const [rule, category] of tagRules) if (names.some((t) => rule.test(t))) return category;
  return "mercearia";
}

// "1kg" → "1 kg"; descarta lixo e textos longos demais.
export function cleanQuantity(value: unknown) {
  if (typeof value !== "string") return "";
  const text = value.trim().replace(/\s+/g, " ").replace(/(\d)\s*(kg|g|mg|l|ml|un|unidades?|rolos?)\b/gi, (_m, n: string, u: string) => `${n} ${u.toLowerCase() === "l" ? "L" : u.toLowerCase()}`);
  return text.length <= 40 ? text : "";
}
export function normalizeProduct(raw: unknown, source: OffSource): OffProduct | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const code = typeof r.code === "string" ? r.code.trim() : "";
  const name = typeof r.product_name === "string" ? r.product_name.trim().replace(/\s+/g, " ").slice(0, 100) : "";
  if (!/^\d{8,14}$/.test(code) || name.length < 2) return null;
  const firstBrand = typeof r.brands === "string" ? r.brands.split(",")[0].trim().slice(0, 60) : "";
  const brand = firstBrand && firstBrand === firstBrand.toUpperCase() ? titleCase(firstBrand) : firstBrand;
  return {
    code,
    name,
    brand,
    size: cleanQuantity(r.quantity),
    category: categoryFromTags(r.categories_tags, source),
    modified: typeof r.last_modified_t === "number" ? r.last_modified_t : 0,
  };
}
// Mostra primeiro os resultados que começam pelo que foi buscado, depois os que o contêm.
export function rankProducts(list: OffProduct[], query: string) {
  const q = fold(query);
  const score = (p: OffProduct) => (fold(p.name).startsWith(q) ? 0 : fold(p.name).includes(q) ? 1 : 2);
  return list.map((p, i) => ({ p, i })).sort((a, b) => score(a.p) - score(b.p) || a.i - b.i).map((x) => x.p);
}

type Fetcher = typeof fetch;
async function getJson(fetcher: Fetcher, url: string, retry = true): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetcher(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (response.status === 429) throw new OffError("O serviço pediu uma pausa. Espere um minuto e tente de novo.", "limit");
    const type = response.headers.get("content-type") || "";
    // O serviço fica instável às vezes e devolve uma página HTML de erro com status 503.
    if (response.status >= 500 || !type.includes("json")) {
      if (retry && response.status >= 500) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return getJson(fetcher, url, false);
      }
      throw new OffError("O serviço de produtos está instável agora. Tente de novo em instantes.", "down");
    }
    const body = await response.json();
    if (!body || typeof body !== "object") throw new OffError("Resposta inesperada do serviço de produtos.", "format");
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof OffError) throw error;
    throw new OffError("Sem conexão com o serviço de produtos. Você ainda pode usar seus itens salvos ou criar um item.", "offline");
  } finally {
    clearTimeout(timer);
  }
}

interface CacheEntry {
  at: number;
  rows: OffProduct[];
}
const memory = new Map<string, CacheEntry>();
const readCache = (): Record<string, CacheEntry> => {
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
};
function cached(key: string, now: number) {
  const hit = memory.get(key) || readCache()[key];
  return hit && now - hit.at < CACHE_TTL_MS && Array.isArray(hit.rows) ? hit.rows : null;
}
function remember(key: string, rows: OffProduct[], now: number) {
  memory.set(key, { at: now, rows });
  try {
    const all = { ...readCache(), [key]: { at: now, rows } };
    const keep = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, CACHE_MAX);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(keep)));
  } catch {
    /* cache é só conveniência: sem espaço, segue sem ele */
  }
}
export function clearOffCache() {
  memory.clear();
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignorado */
  }
}

export interface OffSearchOptions {
  fetcher?: Fetcher;
  now?: number;
  limiter?: RateLimiter;
}
// Busca por texto. Resultados repetidos na última semana vêm do cache e não gastam o limite.
export async function searchProducts(query: string, category: string, options: OffSearchOptions = {}) {
  const term = query.trim().replace(/\s+/g, " ");
  if (term.length < 2) throw new OffError("Digite pelo menos 2 letras para buscar.", "format");
  const source = sourceFor(category);
  const now = options.now ?? Date.now();
  const key = `${source}:${fold(term)}`;
  const hit = cached(key, now);
  if (hit) return { rows: hit, fromCache: true };
  const wait = (options.limiter ?? searchLimiter).take(now);
  if (wait) throw new OffError(`Muitas buscas seguidas. Espere ${wait} segundo(s) para buscar de novo.`, "limit");
  const url = `${offHosts[source]}/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&page_size=30&sort_by=unique_scans_n&fields=${FIELDS}`;
  const body = await getJson(options.fetcher ?? fetch.bind(globalThis), url);
  const products = Array.isArray(body.products) ? body.products : [];
  const seen = new Set<string>();
  const rows = rankProducts(
    products.flatMap((p) => {
      const item = normalizeProduct(p, source);
      if (!item || seen.has(item.code)) return [];
      seen.add(item.code);
      return [item];
    }),
    term,
  ).slice(0, 24);
  remember(key, rows, now);
  return { rows, fromCache: false };
}
// Consulta um produto pelo código de barras (para atualizar um item salvo). null = não encontrado.
export async function fetchProduct(code: string, category: string, options: OffSearchOptions = {}) {
  if (!/^\d{8,14}$/.test(code)) return null;
  const source = sourceFor(category);
  const wait = (options.limiter ?? codeLimiter).take(options.now ?? Date.now());
  if (wait) throw new OffError(`Muitas consultas seguidas. Espere ${wait} segundo(s).`, "limit");
  const body = await getJson(options.fetcher ?? fetch.bind(globalThis), `${offHosts[source]}/api/v2/product/${code}?fields=${FIELDS}`);
  return body.status === 1 ? normalizeProduct(body.product, source) : null;
}

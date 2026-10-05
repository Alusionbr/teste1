import assert from "node:assert/strict";
import test from "node:test";
import {
  OffError,
  RateLimiter,
  categoryFromTags,
  cleanQuantity,
  fetchProduct,
  normalizeProduct,
  rankProducts,
  searchProducts,
  sourceFor,
} from "./off.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
const calls = () => {
  const urls: string[] = [];
  return { urls, fetcher: (async (url: string) => (urls.push(url), json({ products: [] }))) as unknown as typeof fetch };
};
const fresh = () => new RateLimiter(9);

test("each catalog category queries the matching open database", () => {
  assert.equal(sourceFor("mercearia"), "food");
  assert.equal(sourceFor("bebidas"), "food");
  assert.equal(sourceFor("higiene"), "beauty");
  assert.equal(sourceFor("limpeza"), "products");
  assert.equal(sourceFor("casa"), "products");
});

test("products are normalised: brand case, quantity spacing, valid barcode and name only", () => {
  const raw = { code: "7896006711155", product_name: "  Arroz   Tipo 1 Camil 5kg ", brands: "CAMIL, Camil Alimentos S.A.", quantity: "5kg",
    categories_tags: ["en:cereals-and-potatoes", "en:rices"], last_modified_t: 1775135305 };
  assert.deepEqual(normalizeProduct(raw, "food"), { code: "7896006711155", name: "Arroz Tipo 1 Camil 5kg", brand: "Camil", size: "5 kg", category: "mercearia", modified: 1775135305 });
  assert.equal(normalizeProduct({ ...raw, brands: "Tio João" }, "food")?.brand, "Tio João");
  assert.equal(normalizeProduct({ ...raw, brands: "TIO JOAO" }, "food")?.brand, "Tio Joao");
  assert.equal(normalizeProduct({ ...raw, brands: undefined, quantity: undefined }, "food")?.brand, "");
  assert.equal(normalizeProduct({ ...raw, code: "123" }, "food"), null);
  assert.equal(normalizeProduct({ ...raw, code: "78960A7111155" }, "food"), null);
  assert.equal(normalizeProduct({ ...raw, product_name: "" }, "food"), null);
  assert.equal(normalizeProduct(null, "food"), null);
  assert.equal(normalizeProduct("texto", "food"), null);
  assert.equal(normalizeProduct({ ...raw, product_name: "x".repeat(300) }, "food")?.name.length, 100);
  assert.equal(normalizeProduct(raw, "beauty")?.category, "higiene");
  assert.equal(normalizeProduct(raw, "products")?.category, "limpeza");
});

test("quantity and category helpers", () => {
  assert.equal(cleanQuantity("500ml"), "500 ml");
  assert.equal(cleanQuantity("12 Rolos"), "12 rolos");
  assert.equal(cleanQuantity("1,5 L"), "1,5 L");
  assert.equal(cleanQuantity(undefined), "");
  assert.equal(cleanQuantity("x".repeat(60)), "");
  assert.equal(categoryFromTags(["en:beverages", "en:waters"], "food"), "bebidas");
  assert.equal(categoryFromTags(["en:dairies", "en:milks"], "food"), "laticinios");
  assert.equal(categoryFromTags(["en:meats"], "food"), "carnes");
  assert.equal(categoryFromTags(["en:fruits"], "food"), "hortifruti");
  assert.equal(categoryFromTags(["en:beverages-and-beverages-preparations", "en:carbonated-drinks", "en:sodas"], "food"), "bebidas");
  // Regressão vista na API real: a etiqueta genérica de todo alimento vegetal contém "beverages".
  assert.equal(categoryFromTags(["en:plant-based-foods-and-beverages", "en:plant-based-foods", "en:cereals-and-potatoes", "en:biscuits"], "food"), "mercearia");
  assert.equal(categoryFromTags(["en:plant-based-foods-and-beverages", "en:plant-based-foods", "en:cereals-and-potatoes", "en:rices"], "food"), "mercearia");
  assert.equal(categoryFromTags(["en:frozen-foods", "en:meals"], "food"), "padaria");
  assert.equal(categoryFromTags(undefined, "food"), "mercearia");
  assert.equal(categoryFromTags([1, null], "food"), "mercearia");
});

test("ranking shows names starting with the search first, keeping popularity order inside each group", () => {
  const mk = (name: string, i: number) => ({ code: String(10000000 + i), name, brand: "", size: "", category: "mercearia" as const, modified: 0 });
  const ranked = rankProducts([mk("Biscoito de arroz", 1), mk("Mini biscoitos de arroz", 2), mk("Arroz Camil", 3), mk("Arroz Tio João", 4), mk("Farinha", 5)], "arroz");
  assert.deepEqual(ranked.map((p) => p.name), ["Arroz Camil", "Arroz Tio João", "Biscoito de arroz", "Mini biscoitos de arroz", "Farinha"]);
});

test("the limiter blocks the tenth search in a minute and reports the wait", () => {
  const limiter = new RateLimiter(3);
  assert.equal(limiter.take(1000), 0);
  assert.equal(limiter.take(2000), 0);
  assert.equal(limiter.take(3000), 0);
  assert.equal(limiter.take(4000), 57);
  assert.equal(limiter.take(61_000), 0, "window slides");
});

test("search builds a Brazil query, ranks, deduplicates and caches the answer", async () => {
  const urls: string[] = [];
  const fetcher = (async (url: string) => {
    urls.push(url);
    return json({ products: [
      { code: "7893500018483", product_name: "Biscoito de arroz", brands: "Camil" },
      { code: "7893500020110", product_name: "Arroz Tio João 1 Kg", brands: "TIO JOAO", quantity: "1kg" },
      { code: "7893500020110", product_name: "Arroz Tio João 1 Kg", brands: "TIO JOAO", quantity: "1kg" },
      { code: "bad", product_name: "Sem código" },
    ] });
  }) as unknown as typeof fetch;
  const limiter = fresh();
  const first = await searchProducts("Arroz  Tio João", "mercearia", { fetcher, now: 1_000_000, limiter });
  assert.equal(first.fromCache, false);
  assert.deepEqual(first.rows.map((r) => r.name), ["Arroz Tio João 1 Kg", "Biscoito de arroz"]);
  assert.match(urls[0], /^https:\/\/br\.openfoodfacts\.org\/cgi\/search\.pl\?search_terms=Arroz%20Tio%20Jo%C3%A3o&/);
  assert.match(urls[0], /json=1/);
  const again = await searchProducts("arroz tio joao", "mercearia", { fetcher, now: 1_000_500, limiter });
  assert.equal(again.fromCache, true, "same words without accents hit the cache");
  assert.equal(urls.length, 1, "cached answers do not spend the service limit");
  const expired = await searchProducts("Arroz Tio João", "mercearia", { fetcher, now: 1_000_000 + 8 * 24 * 3600_000, limiter });
  assert.equal(expired.fromCache, false, "cache lasts one week");
  assert.equal(urls.length, 2);
});

test("search uses the sibling database of the category", async () => {
  const { urls, fetcher } = calls();
  await searchProducts("sabonete dove", "higiene", { fetcher, now: 2_000_000, limiter: fresh() });
  await searchProducts("detergente ypê", "limpeza", { fetcher, now: 2_000_000, limiter: fresh() });
  assert.match(urls[0], /^https:\/\/br\.openbeautyfacts\.org/);
  assert.match(urls[1], /^https:\/\/br\.openproductsfacts\.org/);
});

test("short queries and the local limit are refused before touching the network", async () => {
  const { urls, fetcher } = calls();
  await assert.rejects(searchProducts("a", "mercearia", { fetcher, limiter: fresh() }), (e: unknown) => e instanceof OffError && e.kind === "format");
  const limiter = new RateLimiter(1);
  await searchProducts("feijao preto", "mercearia", { fetcher, now: 3_000_000, limiter });
  await assert.rejects(
    searchProducts("macarrao espaguete", "mercearia", { fetcher, now: 3_010_000, limiter }),
    (e: unknown) => e instanceof OffError && e.kind === "limit" && /50 segundo/.test(e.message),
  );
  assert.equal(urls.length, 1);
});

test("an unstable service (HTML 503 page) is retried once and then reported kindly", async () => {
  let hits = 0;
  const fetcher = (async () => {
    hits++;
    return new Response("<!DOCTYPE html><title>Page temporarily unavailable</title>", { status: 503, headers: { "content-type": "text/html" } });
  }) as unknown as typeof fetch;
  await assert.rejects(searchProducts("leite integral", "laticinios", { fetcher, now: 4_000_000, limiter: fresh() }), (e: unknown) => e instanceof OffError && e.kind === "down" && /instável/.test(e.message));
  assert.equal(hits, 2);
  hits = 0;
  const recovers = (async () => (++hits === 1 ? new Response("erro", { status: 503, headers: { "content-type": "text/html" } }) : json({ products: [{ code: "7891000100103", product_name: "Leite integral", brands: "Italac" }] }))) as unknown as typeof fetch;
  const ok = await searchProducts("leite italac", "laticinios", { fetcher: recovers, now: 4_100_000, limiter: fresh() });
  assert.equal(ok.rows.length, 1);
  assert.equal(hits, 2);
});

test("offline, rate-limited and malformed answers become friendly errors", async () => {
  const kind = async (fetcher: typeof fetch) => {
    try {
      await searchProducts("manteiga aviacao", "laticinios", { fetcher, now: 5_000_000 + Math.random() * 1e6, limiter: fresh() });
      return "ok";
    } catch (e) {
      return e instanceof OffError ? e.kind : "other";
    }
  };
  assert.equal(await kind((async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch), "offline");
  assert.equal(await kind((async () => new Response("{}", { status: 429, headers: { "content-type": "application/json" } })) as unknown as typeof fetch), "limit");
  assert.equal(await kind((async () => new Response("não é json", { status: 200, headers: { "content-type": "text/plain" } })) as unknown as typeof fetch), "down");
  assert.equal(await kind((async () => json("texto")) as unknown as typeof fetch), "format");
  assert.equal(await kind((async () => json({ products: "nada" })) as unknown as typeof fetch), "ok");
});

test("barcode lookup returns the product, null when unknown, and ignores invalid codes", async () => {
  let url = "";
  const found = (async (u: string) => (url = u, json({ status: 1, product: { code: "7896006711155", product_name: "Arroz Camil 5kg", brands: "Camil", quantity: "5kg" } }))) as unknown as typeof fetch;
  const product = await fetchProduct("7896006711155", "mercearia", { fetcher: found, limiter: fresh() });
  assert.equal(product?.name, "Arroz Camil 5kg");
  assert.match(url, /^https:\/\/br\.openfoodfacts\.org\/api\/v2\/product\/7896006711155\?fields=/);
  const missing = (async () => json({ status: 0, status_verbose: "product not found" })) as unknown as typeof fetch;
  assert.equal(await fetchProduct("7896006711155", "mercearia", { fetcher: missing, limiter: fresh() }), null);
  assert.equal(await fetchProduct("abc", "mercearia", { fetcher: found, limiter: fresh() }), null);
  await assert.rejects(fetchProduct("7896006711155", "mercearia", { fetcher: found, limiter: new RateLimiter(0) }), (e: unknown) => e instanceof OffError && e.kind === "limit");
});

const PUBLIC_KEY = "sb_publishable_BQovHTX0tTRpLtVfOnTVAQ_QxiV1o42";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORIGINS = new Set([
  "https://alusionbr.github.io",
  "http://127.0.0.1:8765",
  "http://localhost:8765",
]);
const CATEGORIES = new Set([
  "lyrics_search",
  "rehearsal_setlists",
  "interface_controls",
  "other",
]);
const MAX_BODY_BYTES = 8192;

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") || "";
  const headers = {
    "Access-Control-Allow-Origin": ORIGINS.has(origin) ? origin : "https://alusionbr.github.io",
    "Access-Control-Allow-Headers": "apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
  const reply = (status: number, ok: boolean) =>
    new Response(JSON.stringify({ ok }), { status, headers });

  if (!ORIGINS.has(origin)) return reply(403, false);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply(405, false);
  if (request.headers.get("apikey") !== PUBLIC_KEY) return reply(401, false);

  try {
    const reader = request.body?.getReader();
    if (!reader) return reply(400, false);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return reply(413, false);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)) return reply(400, false);
    // The trap is intentionally never persisted; it quietly absorbs simple bots.
    if (typeof body.website === "string" && body.website.trim()) return reply(200, true);

    const category = body.category;
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const version = body.app_version;
    const path = body.page_path;
    if (!CATEGORIES.has(category)
      || description.length < 15 || description.length > 1500
      || typeof version !== "string" || !/^[0-9]+[.][0-9]+[.][0-9]+$/.test(version) || version.length > 24
      || typeof path !== "string" || path.length > 200 || !path.startsWith("/")
) return reply(400, false);

    const response = await fetch(
      SUPABASE_URL + "/rest/v1/estante_bug_reports",
      {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: "Bearer " + SERVICE_KEY,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          category,
          description,
          app_version: version,
          page_path: path,
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) return reply(503, false);
    return reply(200, true);
  } catch {
    return reply(400, false);
  }
});

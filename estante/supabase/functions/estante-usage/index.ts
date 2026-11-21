const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_KEY = "sb_publishable_BQovHTX0tTRpLtVfOnTVAQ_QxiV1o42";
const ORIGINS = new Set(["https://alusionbr.github.io", "http://127.0.0.1:8765", "http://localhost:8765"]);
const METRICS = new Set(["rehearsed", "missing_lyrics", "rhythm"]);
const GENRES = new Set(["xote", "samba", "pop", "rock", "hiphop", "bossa", "jazz"]);
const TRACK = /^(mbid:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|(?:lrclib|apple|deezer):[1-9][0-9]{0,14})$/;
const DAY = 86400000;

type Row = { day: string; metric: string; ref: string; count: number };
type Batch = { id: string; rows: Row[] };
type Summary = { metric: string; ref: string; total: number | string };

async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let body = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 8192) {
      await reader.cancel();
      throw new RangeError("Usage batch is too large");
    }
    body += decoder.decode(value, { stream: true });
  }
  return JSON.parse(body + decoder.decode());
}

function batchFrom(body: Batch): Batch | null {
  if (!body || typeof body.id !== "string" || !/^usage_[A-Za-z0-9_-]{8,64}$/.test(body.id)
      || !Array.isArray(body.rows) || body.rows.length < 1 || body.rows.length > 32) return null;
  const now = Date.now();
  const oldest = new Date(now - 7 * DAY).toISOString().slice(0, 10);
  const newest = new Date(now + DAY).toISOString().slice(0, 10);
  const rows = [];
  for (const row of body.rows) {
    if (!row || typeof row.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.day)
        || row.day < oldest || row.day > newest
        || !METRICS.has(row.metric)
        || typeof row.ref !== "string" || !(row.metric === "rhythm" ? GENRES.has(row.ref) : TRACK.test(row.ref))
        || !Number.isInteger(row.count) || row.count < 1 || row.count > 50) return null;
    rows.push({ day: row.day, metric: row.metric, ref: row.ref, count: row.count });
  }
  return { id: body.id, rows };
}

function rpc(name: string, apiKey: string, bearer: string, data: object) {
  return fetch(SUPABASE_URL + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: { apikey: apiKey, Authorization: bearer, "Content-Type": "application/json" },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(8000),
  });
}

function catalogSource(ref: string) {
  const [provider, id] = ref.split(":");
  switch (provider) {
    case "lrclib": return ["https://lrclib.net/api/get/" + id, "https://lrclib.net/api/get/" + id];
    case "apple": return ["https://itunes.apple.com/lookup?country=BR&id=" + id, "https://music.apple.com/br/song/" + id];
    case "deezer": return ["https://api.deezer.com/track/" + id, "https://www.deezer.com/track/" + id];
    case "mbid": return ["https://musicbrainz.org/ws/2/recording/" + id + "?inc=artist-credits&fmt=json", "https://musicbrainz.org/recording/" + id];
    default: return [];
  }
}

async function label(ref: string) {
  if (!TRACK.test(ref)) return {};
  const [lookup, link] = catalogSource(ref);
  try {
    const response = await fetch(lookup, {
      headers: { "User-Agent": "Estante/4.4 (+https://alusionbr.github.io/teste1/estante/)" },
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return { link };
    const result = await response.json();
    const entry = ref.startsWith("apple:") ? result.results?.[0] : result;
    if (!entry) return { link };
    const title = entry.trackName || entry.title;
    const artist = entry.artistName || entry.artist?.name || entry["artist-credit"]?.[0]?.name;
    return { link, title: typeof title === "string" ? title.slice(0, 200) : undefined,
      artist: typeof artist === "string" ? artist.slice(0, 200) : undefined };
  } catch { return { link }; }
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") || "";
  const headers = {
    "Access-Control-Allow-Origin": ORIGINS.has(origin) ? origin : "https://alusionbr.github.io",
    "Access-Control-Allow-Headers": "apikey, authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
  const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
  if (!ORIGINS.has(origin)) return reply(403, { ok: false });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.headers.get("apikey") !== PUBLIC_KEY) return reply(401, { ok: false });

  if (request.method === "POST") {
    let batch;
    try { batch = batchFrom(await readBody(request)); }
    catch (error) { return reply(error instanceof RangeError ? 413 : 400, { ok: false }); }
    if (!batch) return reply(400, { ok: false });
    try {
      const response = await rpc("estante_collect_usage", SERVICE_KEY, "Bearer " + SERVICE_KEY,
        { batch_id: batch.id, batch_rows: batch.rows });
      if (response.status === 429) return reply(429, { ok: false });
      if (!response.ok) return reply(503, { ok: false });
      return reply(200, { ok: true });
    } catch { return reply(503, { ok: false }); }
  }

  if (request.method === "GET") {
    const bearer = request.headers.get("authorization");
    if (!bearer?.startsWith("Bearer ")) return reply(401, { ok: false });
    try {
      // PostgREST verifies the token and checks the existing Estante admin policy.
      const response = await rpc("estante_usage_report", PUBLIC_KEY, bearer, {});
      if (response.status === 401 || response.status === 403) return reply(response.status, { ok: false });
      if (!response.ok) return reply(503, { ok: false });
      const rows: Summary[] = await response.json();
      const ref = new URL(request.url).searchParams.get("ref");
      if (!ref) return reply(200, { rows });
      if (!TRACK.test(ref) || !rows.some(row => row.ref === ref)) return reply(404, { ok: false });
      return reply(200, await label(ref));
    } catch { return reply(503, { ok: false }); }
  }
  return reply(405, { ok: false });
});

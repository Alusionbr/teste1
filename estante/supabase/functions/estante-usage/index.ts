const PUBLIC_KEY = "sb_publishable_BQovHTX0tTRpLtVfOnTVAQ_QxiV1o42";
const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FEATURES = new Set(["results", "library", "setlist", "rehearsal"]);
const CODES = new Set(["app_error", "unhandled_rejection", "local_save", "cloud_sync", "lyrics_unavailable", "source_vagalume", "source_lrclib"]);
const ORIGINS = new Set(["https://alusionbr.github.io", "http://127.0.0.1:8765", "http://localhost:8765"]);
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const headers = {
    "Access-Control-Allow-Origin": ORIGINS.has(origin) ? origin : "https://alusionbr.github.io",
    "Access-Control-Allow-Headers": "apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin", "Content-Type": "application/json"
  };
  const reply = (status: number, error?: string) => new Response(JSON.stringify(error ? {error} : {ok:true}), {status, headers});
  if (!ORIGINS.has(origin)) return reply(403, "origin");
  if (req.method === "OPTIONS") return new Response(null, {status:204, headers});
  if (req.method !== "POST") return reply(405, "method");
  // Anonymous, temporary session counters only. No account token or email is read.
  if (req.headers.get("apikey") !== PUBLIC_KEY) return reply(401, "app_key");
  try {
    const reader = req.body?.getReader(); if (!reader) return reply(400,"body");
    const parts: Uint8Array[] = []; let size = 0;
    while (true) {
      const {value,done} = await reader.read(); if(done) break;
      size += value.length; if(size>2048){await reader.cancel();return reply(413,"body_size")}
      parts.push(value);
    }
    const bytes = new Uint8Array(size);let offset=0;
    for(const part of parts){bytes.set(part,offset);offset+=part.length}
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id)
      || !FEATURES.has(body.feature) || typeof body.active!=="boolean"
      || typeof body.version!=="string" || !/^\d+\.\d+\.\d+$/.test(body.version) || body.version.length>24
      || (body.error !== null && !CODES.has(body.error))) return reply(400, "payload");
    const label="Sessão · "+body.id.slice(0,8);
    // Salted daily IP hash only, never a raw IP or a browser fingerprint.
    const ip=(req.headers.get("x-forwarded-for")||"unknown").split(",").at(-1)!.trim();
    const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(SERVICE_KEY+new Date().toISOString().slice(0,10)+ip));
    const rateKey=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");
    const result=await fetch(URL+"/rest/v1/rpc/estante_record_usage",{
      method:"POST",headers:{apikey:SERVICE_KEY,Authorization:"Bearer "+SERVICE_KEY,"Content-Type":"application/json"},
      body:JSON.stringify({p_id:body.id,p_user:null,p_label:label,p_feature:body.feature,p_version:body.version,p_active:body.active,p_error:body.error,p_rate_key:rateKey}),
      signal:AbortSignal.timeout(10000)
    });
    if(!result.ok){const error=await result.json();return reply(error.message?.includes("RATE_LIMIT")?429:400,"rejected")}
    return reply(200);
  }catch{return reply(400,"invalid_request")}
});

const checks = [
  ["published", "https://alusionbr.github.io/teste1/estante/"],
  ["lrclib", "https://lrclib.net/api/search?track_name=Amazing%20Grace&artist_name=John%20Newton"],
  ["vagalume", "https://api.vagalume.com.br/search.artmus?q=amor&limit=3"],
  ["liriqo", "https://api.liriqo-alfarrizi.my.id/v1/lyrics?title=Ouve-se%20o%20J%C3%BAbilo&artist=Marcos%20G%C3%B3es"]
];

async function inspect(name, url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const result = { source: name, status: response.status };
    if (!response.ok) return result;
    if (name === "published") {
      const html = await response.text();
      result.version = html.match(/styles\.css\?v=([\d.]+)/)?.[1] || "unknown";
    } else {
      const data = await response.json();
      result.lyricsAvailable = name === "lrclib"
        ? Array.isArray(data) && data.some(song => song.plainLyrics || song.syncedLyrics)
        : name === "liriqo" ? !!data.primary?.plain : undefined;
    }
    return result;
  } catch (error) {
    return { source: name, error: error.name === "TimeoutError" ? "timeout" : error.message };
  }
}

console.log(JSON.stringify(await Promise.all(checks.map(([name, url]) => inspect(name, url))), null, 2));

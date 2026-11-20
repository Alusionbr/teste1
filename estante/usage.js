"use strict";

const EstanteUsage = (() => {
  const endpoint = "https://pxqhpntifbtjaoqtirao.supabase.co/functions/v1/estante-usage";
  const publicKey = "sb_publishable_BQovHTX0tTRpLtVfOnTVAQ_QxiV1o42";
  const preference = "estante:usage-opt-in";
  const dayMs = 86400000;
  const day = (time = Date.now()) => new Date(time).toISOString().slice(0, 10);
  const genres = new Set(["xote", "samba", "pop", "rock", "hiphop", "bossa", "jazz"]);
  let database, timer, sending, intervalDelay = 30000;

  function enabled() {
    try { return localStorage.getItem(preference) === "1"; }
    catch { return false; }
  }

  function db() {
    if (!database) database = new Promise((resolve, reject) => {
      const request = indexedDB.open("estante-usage", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("queue");
      request.onsuccess = () => resolve(request.result);
      request.onerror = reject;
    }).catch(error => { database = undefined; throw error; });
    return database;
  }

  async function update(change, clearing = false) {
    if (!clearing && !enabled()) return;
    const connection = await db();
    return new Promise((resolve, reject) => {
      const tx = connection.transaction("queue", "readwrite");
      const store = tx.objectStore("queue");
      const request = store.get("outbox");
      let value;
      request.onsuccess = () => {
        if (clearing) { store.delete("outbox"); return; }
        if (!enabled()) return;
        const queue = request.result || { rows: [], seen: [], pending: null };
        const oldest = day(Date.now() - 6 * dayMs);
        queue.rows = queue.rows.filter(row => row.day >= oldest);
        queue.seen = queue.seen.filter(item => item.day >= oldest);
        if (queue.pending && queue.pending.rows.some(row => row.day < oldest)) queue.pending = null;
        value = change(queue);
        store.put(queue, "outbox");
      };
      tx.oncomplete = () => resolve(value);
      tx.onabort = () => reject(tx.error);
    });
  }

  function schedule(delay = intervalDelay) {
    if (timer || sending || !enabled() || navigator.onLine === false) return;
    timer = setTimeout(() => { timer = null; flush(); }, delay);
  }

  async function flush() {
    if (sending || !enabled() || navigator.onLine === false) return;
    const controller = new AbortController();
    sending = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    let more = false;
    try {
      const batch = await update(queue => {
        if (!queue.pending && queue.rows.length) queue.pending = {
          id: EstanteDomain.uid("usage"), rows: queue.rows.splice(0, 32)
        };
        return queue.pending;
      });
      if (!batch || !enabled() || controller.signal.aborted) return;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { apikey: publicKey, "Content-Type": "application/json" },
        body: JSON.stringify(batch),
        signal: controller.signal
      });
      if (!response.ok && ![400, 413].includes(response.status)) {
        intervalDelay = 5 * 60000;
        more = true;
        return;
      }
      more = await update(queue => {
        if (queue.pending?.id === batch.id) queue.pending = null;
        return queue.rows.length > 0 || Boolean(queue.pending);
      });
      intervalDelay = 30000;
    } catch {
      intervalDelay = 5 * 60000;
      more = true;
    } finally {
      clearTimeout(timeout);
      sending = null;
      if (more) schedule();
    }
  }

  function record(metric, ref, sessionId = "") {
    if (!ref || !enabled()) return;
    const today = day();
    update(queue => {
      if (sessionId) {
        if (queue.seen.some(item => item.session === sessionId && item.ref === ref)) return;
        queue.seen.push({ session: sessionId, ref, day: today });
        if (queue.seen.length > 500) queue.seen.shift();
      }
      const row = queue.rows.find(item => item.day === today && item.metric === metric && item.ref === ref && item.count < 50);
      if (row) row.count++;
      else if (queue.rows.length < 250) queue.rows.push({ day: today, metric, ref, count: 1 });
    }).then(() => schedule()).catch(() => {});
  }

  function stop() {
    clearTimeout(timer);
    timer = null;
    sending?.abort();
    return update(null, true).catch(() => {});
  }

  function init() {
    const checkbox = $("usageOptIn");
    const status = $("usagePreferenceStatus");
    checkbox.checked = enabled();
    checkbox.onchange = () => {
      try {
        if (checkbox.checked) {
          localStorage.setItem(preference, "1");
          intervalDelay = 30000;
          schedule();
        } else {
          localStorage.removeItem(preference);
          stop();
        }
        status.textContent = checkbox.checked ? "Compartilhamento ativado." : "Compartilhamento desativado.";
      } catch {
        checkbox.checked = enabled();
        status.textContent = "Não foi possível guardar esta preferência.";
      }
    };
    window.addEventListener("storage", event => {
      if (event.key !== preference && event.key !== null) return;
      checkbox.checked = enabled();
      if (!checkbox.checked) stop();
      else schedule(0);
    });
    window.addEventListener("online", () => schedule(0));
    if (enabled()) schedule();
  }

  return {
    init,
    song(song, session) { record("rehearsed", EstanteDomain.publicTrackId(song), session?.id); },
    missing(song) { if (navigator.onLine !== false && !song?.instrumental) record("missing_lyrics", EstanteDomain.publicTrackId(song)); },
    backing(entry) {
      if (entry && ["preset", "recording"].includes(entry.kind) && genres.has(entry.genre)) record("rhythm", entry.genre);
    }
  };
})();

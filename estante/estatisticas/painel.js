"use strict";

const origin = "https://pxqhpntifbtjaoqtirao.supabase.co";
const apikey = "sb_publishable_BQovHTX0tTRpLtVfOnTVAQ_QxiV1o42";
const endpoint = origin + "/functions/v1/estante-usage";
const genre = { xote: "Xote", samba: "Samba", pop: "Pop", rock: "Rock", hiphop: "Hip-hop", bossa: "Bossa nova", jazz: "Jazz" };
const listIds = ["rehearsed", "missing_lyrics", "rhythm"];
const status = document.getElementById("status");
const form = document.getElementById("login");
const report = document.getElementById("report");
const format = new Intl.NumberFormat("pt-BR");
const lookups = new Map();
let accessToken;

function signOut(message = "") {
  accessToken = null;
  lookups.clear();
  listIds.forEach(id => document.getElementById(id).replaceChildren());
  report.hidden = true;
  form.hidden = false;
  status.textContent = message;
}

async function getReport(ref = "") {
  const url = new URL(endpoint);
  if (ref) url.searchParams.set("ref", ref);
  const response = await fetch(url, {
    headers: { apikey, Authorization: "Bearer " + accessToken },
    cache: "no-store",
    signal: AbortSignal.timeout(12000)
  });
  if (response.status === 401 || response.status === 403) {
    signOut("O acesso às estatísticas exige uma conta de administrador do Estante.");
    return null;
  }
  if (!response.ok) throw Error("O painel de estatísticas está indisponível no momento.");
  return response.json();
}

function renderRow(row, position) {
  const item = document.createElement("li");
  const name = document.createElement("strong");
  const count = document.createElement("span");
  name.textContent = genre[row.ref] || row.ref;
  count.textContent = "· " + format.format(Number(row.total));
  item.append(name, count);
  if (row.metric === "rhythm") return item;

  const more = document.createElement("button");
  more.type = "button";
  more.textContent = "Consultar nome";
  async function resolve() {
    more.disabled = true;
    try {
      if (!lookups.has(row.ref)) lookups.set(row.ref, getReport(row.ref));
      const details = await lookups.get(row.ref);
      if (!details) return;
      const label = [details.title, details.artist].filter(Boolean).join(" — ") || row.ref;
      if (details.link) {
        const url = new URL(details.link);
        if (url.protocol === "https:" && ["lrclib.net", "music.apple.com", "www.deezer.com", "musicbrainz.org"].includes(url.hostname)) {
          const link = document.createElement("a");
          link.href = url.href;
          link.textContent = label;
          name.replaceChildren(link);
        }
      } else name.textContent = label;
      more.remove();
    } catch {
      lookups.delete(row.ref);
      more.disabled = false;
      more.textContent = "Tentar novamente";
    }
  }
  more.addEventListener("click", resolve);
  item.append(more);
  if (position === 0) resolve();
  return item;
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const submit = event.submitter;
  const email = document.getElementById("email");
  const password = document.getElementById("password");
  submit.disabled = true;
  status.textContent = "Verificando acesso…";
  try {
    const response = await fetch(origin + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.value.trim(), password: password.value }),
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw Error("Não foi possível entrar. Confira o e-mail e a senha.");
    accessToken = (await response.json()).access_token;
    if (!accessToken) throw Error("Não foi possível iniciar a sessão.");
    const data = await getReport();
    if (!data) return;
    for (const id of listIds) {
      const list = document.getElementById(id);
      const rows = data.rows.filter(row => row.metric === id);
      list.replaceChildren(...rows.map(renderRow));
      if (!rows.length) {
        const empty = document.createElement("li");
        empty.textContent = "Ainda sem dados neste período.";
        list.append(empty);
      }
    }
    form.hidden = true;
    report.hidden = false;
    status.textContent = "";
  } catch (error) {
    signOut(error.message || "Não foi possível abrir as estatísticas.");
  } finally {
    password.value = "";
    submit.disabled = false;
  }
});

document.getElementById("logout").addEventListener("click", () => signOut("Sessão encerrada neste navegador."));

"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function load(file, context, expose) {
  vm.runInContext(fs.readFileSync(require("node:path").join(__dirname, "..", file), "utf8") + `\nthis.${expose}=${expose};`, context);
}

function context(extra = {}) {
  const values = new Map();
  return vm.createContext(Object.assign({
    console, AbortController, setInterval() { return 1; }, clearInterval() {}, setTimeout, clearTimeout,
    window: {}, document: { visibilityState: "visible", addEventListener() {} },
    localStorage: { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v) },
    OFICIAL: [], LUGARES: { todos: () => [] }, _values: values
  }, extra));
}

async function main() {
{
  const c = context({ GROUP: { placeList: () => [{ id: "g-1", x: 1, y: 2 }] } });
  load("store.js", c, "STORE");
  assert.equal(c.STORE.data.mapearCaminhos, false, "contribuição começa desligada");
  c.STORE.data.activePlan = { ids: ["of-a", "of-b"], steps: [{ id: "of-a", tipo: "show", inicio: "2026-10-16T17:00:00.000Z", status: "pendente" }], paused: true, source: "dia" };
  c.STORE.save();
  assert.deepEqual(JSON.parse(c._values.get("parque:v1")).activePlan.ids, ["of-a", "of-b"], "roteiro ativo é persistido");
  assert.equal(JSON.parse(c._values.get("parque:v1")).activePlan.steps[0].tipo, "show", "compromisso estruturado é persistido");
  c.STORE.data.done["of-a"] = Date.now();
  c.STORE.recordPlanAdvance("of-a", "concluido", []);
  assert.equal(c.STORE.data.activePlan.completed, true, "última parada conclui sem criar outro roteiro");
  assert.equal(c.STORE.data.planHistory.length, 1, "histórico permanece após conclusão");
  assert.deepEqual(Array.from(c.STORE.undoPlanAdvance()), ["of-a"], "desfazer restaura a última parada");
  assert.equal(c.STORE.data.done["of-a"], undefined, "desfazer conclusão restaura o marcador de visita");
  c.STORE.data.activePlan.day = "2026-10-15";
  assert.equal(c.STORE.expireActivePlan("2026-10-16"), true, "roteiro antigo expira ao abrir em outro dia");
  assert.equal(c.STORE.data.activePlan, null);
  assert.equal(c.STORE.places().some(p => p.id === "g-1"), true, "pino de grupo entra no catálogo");
  c.STORE.deviceId();
  c.STORE.data.group = { code: "ABCDEF", memberId: "m-1234" };
  const before = JSON.stringify(c.STORE.data);
  assert.throws(() => c.STORE.importJson('{"pins":null}'), /inválida/);
  assert.equal(JSON.stringify(c.STORE.data), before, "importação inválida é atômica");
  const exported = JSON.parse(c.STORE.exportJson());
  assert.equal(exported.data.deviceId, "");
  assert.deepEqual(exported.data.group, { code: "", memberId: "" });
  exported.data.activePlan = { ids: ["of-remoto"] };
  exported.data.planHistory = [{ id: "of-remoto" }];
  exported.data.showChoices = { "2026-10-16|of-show@17:00": true, invasor: true };
  c.STORE.importJson(JSON.stringify(exported));
  assert.equal(c.STORE.data.activePlan, null, "backup não retoma roteiro transitório de outro aparelho");
  assert.equal(c.STORE.data.planHistory.length, 0, "backup descarta histórico transitório");
  assert.deepEqual(Object.keys(c.STORE.data.showChoices), ["2026-10-16|of-show@17:00"], "backup filtra escolhas de sessão");
  const imported = JSON.parse(c.STORE.exportJson());
  imported.data.mapearCaminhos = true;
  imported.data.mapearConsentiu = true;
  c.STORE.importJson(JSON.stringify(imported));
  assert.equal(c.STORE.data.mapearCaminhos, false, "backup não transfere consentimento de trajetos");
  assert.equal(c.STORE.data.mapearConsentiu, false, "consentimento continua local ao aparelho");
}

{
  const box = { minX: 0, minY: 0, maxX: 120, maxY: 120 };
  const c = context({
    PARK_DATA: { box, outline: [[0, 0], [120, 0], [120, 120], [0, 120]], layers: { blocks: [[[50, 0], [70, 0], [70, 100], [50, 100]]], roadsMain: [], roads: [], aisles: [], services: [], paths: [] } },
    GEO: { dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y), bearing: () => 0 }
  });
  load("route.js", c, "ROUTE");
  c.ROUTE.setTrilhas([[{ x: 45, y: 50 }, { x: 75, y: 50 }]]);
  assert.equal(c.ROUTE.custoEm(60, 50), 0, "trilha não desbloqueia barreira");
  const route = c.ROUTE.plan({ x: 45, y: 50 }, { x: 75, y: 50 });
  assert.ok(route.straight || route.points.some(p => p.y > 100), "rota não atravessa a barreira sintética");
  if (!route.straight) {
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1], b = route.points[i];
      const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 1.5);
      for (let s = 0; s <= n; s++) assert.notEqual(c.ROUTE.custoEm(a.x + (b.x - a.x) * s / n, a.y + (b.y - a.y) * s / n), 0, "segmento simplificado não cruza bloqueio");
    }
  }
  const perto = c.ROUTE.plan({ x: 10, y: 10 }, { x: 11, y: 11 });
  assert.equal(perto.points.length, 2, "destino na mesma célula mantém segmento navegável");
  assert.doesNotThrow(() => c.ROUTE.progresso(perto, { x: 10, y: 10 }));
  const acesso = c.ROUTE.plan({ x: 10, y: 50 }, { x: 60, y: 50 });
  assert.equal(acesso.accessTarget, true, "destino bloqueado termina no acesso");
  assert.ok(acesso.destinationOffset > 6, "resultado informa distância do acesso ao destino");
  assert.doesNotThrow(() => c.ROUTE.progresso(acesso, { x: 10, y: 50 }));
}

{
  let now = 10_000_000;
  const FakeDate = class extends Date { static now() { return now; } };
  const c = context({ Date: FakeDate, STORE: { data: { waits: {} }, setWait() {}, deviceId() { return "dev-1"; } }, GROUP: { async rpc() { return [{ place_id: "of-x", minutes: 30, reports: 2, last_at: new Date(now - 3600e3 - 1).toISOString() }]; } } });
  load("filas.js", c, "FILAS");
  await c.FILAS.refresh();
  assert.equal(c.FILAS.info("of-x"), null, "fila vencida não aparece como atual");
}

{
  let calls = 0;
  const c = context({
    GEO: { toXY: (lat, lon) => ({ x: lon, y: lat }), insidePark: () => true, dist: () => 10 },
    ROUTE: { setTrilhas() {} },
    STORE: { data: { mapearCaminhos: false }, uid: () => "tr-test", deviceId: () => "dev-test", save() {} },
    GROUP: { async rpc() { calls++; } }
  });
  c._values.set("parque:trilhas-fila", JSON.stringify([{ id: "tr-pendente", pts: [[-26.8, -48.61], [-26.8001, -48.6101]] }]));
  load("trilhas.js", c, "TRILHAS");
  await c.TRILHAS.enviar();
  assert.equal(calls, 0, "pendência não envia sem consentimento");
  assert.equal(c.TRILHAS.pendentes, 1, "pendência permanece pausada");
  c.GROUP.rpc = (fn, _body, options) => {
    if (fn !== "parque_trilha_add") return Promise.resolve([]);
    calls++;
    return new Promise((resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
  };
  c.TRILHAS.setEnabled(true, false);
  await new Promise(resolve => setTimeout(resolve, 0));
  c.TRILHAS.setEnabled(false, false);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(calls, 1, "worker inicia apenas após consentimento");
  assert.equal(c.TRILHAS.pendentes, 1, "opt-out cancela sem confirmar/remover a pendência");
}

{
  const sql = fs.readFileSync(require("node:path").join(__dirname, "..", "supabase", "004_grupo_sessoes_e_trilhas.sql"), "utf8");
  assert.match(sql, /parque_trilha_add\(p_device text,p_pts jsonb,p_client_id text\)/, "migração cria RPC idempotente");
  assert.match(sql, /parque_trilha_add\(p_device text,p_pts jsonb\)/, "migração preserva RPC antiga");
  assert.match(sql, /grant execute on function public\.parque_trilha_add\(text,jsonb\)/, "wrapper antigo mantém grant explícito");
  assert.doesNotMatch(sql, /set position_at\s*=\s*updated_at/i, "migração não inventa horário de posição");
}

console.log("regressões do parque: ok");
}

main().catch(err => { console.error(err); process.exitCode = 1; });

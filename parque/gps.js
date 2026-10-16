/*
 * gps.js — posição em tempo real e bússola.
 *
 * Posição: navigator.geolocation.watchPosition com alta precisão. Cada leitura
 * nova é suavizada pela precisão informada: leitura ruim (círculo grande)
 * mexe pouco no ponto; leitura boa substitui quase tudo. Isso tira o
 * "pula-pula" do GPS no meio das árvores sem atrasar quem está andando.
 *
 * Direção: bússola do aparelho quando existe (iPhone pede permissão por
 * toque); sem bússola, usa o rumo do GPS enquanto a pessoa anda.
 *
 * Também dá para fixar a posição à mão (toque longo → "Estou aqui"), para
 * quando o GPS falha dentro de um prédio.
 */
"use strict";

const GPS = (() => {
  let watchId = null;
  let pos = null;                 // {x, y, lat, lon, acc, at, manual}
  let heading = null;             // graus, 0 = norte
  let compassOn = false;
  let gpsHeading = null;
  const listeners = [];

  function emit() {
    for (const fn of listeners) fn(current());
  }

  function current() {
    if (!pos) return null;
    return Object.assign({}, pos, { heading: heading != null ? heading : gpsHeading });
  }

  function onFix(p) {
    const c = p.coords;
    const xy = GEO.toXY(c.latitude, c.longitude);
    const acc = c.accuracy || 50;
    if (pos && !pos.manual && Date.now() - pos.at < 15000) {
      // Peso pela precisão: 5 m de erro → quase 100% da leitura nova.
      const k = Math.min(1, Math.max(0.25, 12 / acc));
      xy.x = pos.x + (xy.x - pos.x) * k;
      xy.y = pos.y + (xy.y - pos.y) * k;
    }
    const ll = GEO.toLatLon(xy.x, xy.y);
    pos = { x: xy.x, y: xy.y, lat: ll.lat, lon: ll.lon, acc, at: Date.now(), manual: false, speed: c.speed };
    if (c.heading != null && !isNaN(c.heading) && (c.speed || 0) > 0.7) gpsHeading = c.heading;
    emit();
  }

  function onError(err) {
    const msg = {
      1: "Permissão de localização negada. Libere nas configurações do navegador.",
      2: "Não consegui achar sua posição agora. Tente num lugar mais aberto.",
      3: "O GPS demorou para responder. Tentando de novo…"
    }[err.code] || "Erro de localização";
    UI.gpsStatus(msg, err.code === 1 ? "erro" : "aviso");
  }

  function start() {
    if (!("geolocation" in navigator)) {
      UI.gpsStatus("Este navegador não tem GPS.", "erro");
      return;
    }
    if (watchId != null) return;
    UI.gpsStatus("Procurando sinal de GPS…", "aviso");
    watchId = navigator.geolocation.watchPosition(onFix, onError, {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 20000
    });
  }

  function stop() {
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  function setManual(xy) {
    const ll = GEO.toLatLon(xy.x, xy.y);
    pos = { x: xy.x, y: xy.y, lat: ll.lat, lon: ll.lon, acc: 8, at: Date.now(), manual: true };
    emit();
  }

  // ---- bússola --------------------------------------------------------------

  function screenAngle() {
    return (screen.orientation && screen.orientation.angle) || window.orientation || 0;
  }

  function smooth(prev, next) {
    if (prev == null) return next;
    let d = ((next - prev + 540) % 360) - 180;
    return (prev + d * 0.25 + 360) % 360;
  }

  function onOrientation(e) {
    let h = null;
    if (typeof e.webkitCompassHeading === "number") h = e.webkitCompassHeading;
    else if (e.absolute && typeof e.alpha === "number") h = 360 - e.alpha;
    if (h == null) return;
    h = (h + screenAngle() + 360) % 360;
    heading = smooth(heading, h);
    if (pos) emit();
  }

  async function enableCompass() {
    if (compassOn) return true;
    try {
      if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
        const r = await DeviceOrientationEvent.requestPermission();
        if (r !== "granted") return false;
      }
    } catch (e) {
      return false;
    }
    if ("ondeviceorientationabsolute" in window) window.addEventListener("deviceorientationabsolute", onOrientation);
    else window.addEventListener("deviceorientation", onOrientation);
    compassOn = true;
    return true;
  }

  return {
    start, stop, setManual, enableCompass, current,
    onChange(fn) { listeners.push(fn); },
    get hasCompass() { return heading != null; }
  };
})();

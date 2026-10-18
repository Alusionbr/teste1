/*
 * geo.js — conversão entre GPS e o plano do mapa, distâncias e direções.
 *
 * O mapa é desenhado em metros num plano local (x para leste, y para o sul)
 * com origem em PARK_DATA.origin. A mesma fórmula do gerador
 * (tools/make-park-data.js) é usada aqui, então GPS e desenho batem.
 */
"use strict";

const GEO = (() => {
  const M_LAT = 111320;
  const o = PARK_DATA.origin;
  const M_LON = M_LAT * Math.cos(o.lat * Math.PI / 180);

  function toXY(lat, lon) {
    return { x: (lon - o.lon) * M_LON, y: (o.lat - lat) * M_LAT };
  }

  function toLatLon(x, y) {
    return { lat: o.lat - y / M_LAT, lon: o.lon + x / M_LON };
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  // Direção de a para b em graus, 0 = norte, sentido horário.
  function bearing(a, b) {
    const deg = Math.atan2(b.x - a.x, -(b.y - a.y)) * 180 / Math.PI;
    return (deg + 360) % 360;
  }

  // Ritmo de caminhada num parque cheio: ~65 m por minuto.
  const WALK_M_PER_MIN = 65;

  function walkMinutes(meters) {
    return Math.max(1, Math.round(meters / WALK_M_PER_MIN));
  }

  function fmtDist(m) {
    if (m < 1000) return Math.round(m / 5) * 5 + " m";
    return (m / 1000).toFixed(1).replace(".", ",") + " km";
  }

  const COMPASS = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];
  function compassName(deg) {
    return COMPASS[Math.round(deg / 45) % 8];
  }

  // Distância do ponto ao contorno do parque (0 se estiver dentro).
  function insidePark(p) {
    const poly = PARK_DATA.outline;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > p.y) !== (yj > p.y) && p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  return { toXY, toLatLon, dist, bearing, walkMinutes, fmtDist, compassName, insidePark, WALK_M_PER_MIN };
})();

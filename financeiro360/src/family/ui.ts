// Peças de tela reutilizadas por todas as seções: escapar texto, ícones, botões e campos.
// Sem estado do app: o que depende da tela atual (ex.: "Salvando…") chega por parâmetro.
import { brl as formatBrl } from "./model.ts";

export const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
// Valores ficam numa marca própria para o "Ocultar valores" funcionar em qualquer tela.
export const brl = (cents: number) => `<span class="private-amount">${formatBrl(cents)}</span>`;
export const icon = (name: string) => {
  const paths: Record<string, string> = {
    overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    entries: "M7 3h10l3 3v15H4V3z M8 10h8 M8 14h8 M8 18h5",
    cards: "M3 5h18v14H3z M3 9h18 M7 15h4",
    accounts: "M3 9l9-6 9 6 M4 21h16 M6 10v8 M12 10v8 M18 10v8",
    pantry: "M4 4h16v16H4z M4 12h16 M12 4v16",
    shopping: "M3 3h2l3 13h11l2-9H7 M9 21h1 M18 21h1",
    goals: "M12 3a9 9 0 1 0 9 9 M12 7a5 5 0 1 0 5 5 M12 12l9-9 M17 3h4v4",
    documents: "M7 3h9l4 4v14H4V3z M9 12l3-3 3 3 M12 9v9",
    family:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 M17 4a4 4 0 0 1 0 7 M22 21v-2a4 4 0 0 0-3-4",
    settings:
      "M12 8a4 4 0 1 0 0 8 M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
    plus: "M12 5v14 M5 12h14",
    arrow: "M5 12h14 M13 6l6 6-6 6",
    logout: "M9 3H3v18h6 M10 12h11 M16 7l5 5-5 5",
    check: "M4 12l5 5L20 6",
    debt: "M5 3h14v18l-3-2-4 2-4-2-3 2z M8 8h8 M8 12h6",
    agenda: "M4 5h16v15H4z M4 10h16 M8 3v4 M16 3v4 M8 14h3",
    focus: "M12 3a9 9 0 1 0 0.01 0 M12 8a4 4 0 1 0 0.01 0 M12 12h0.01",
    note: "M4 20h4L19 9l-4-4L4 16z M14 6l4 4",
    timer: "M12 8v5l3 2 M9 2h6 M12 4a9 9 0 1 0 0.01 0",
    back: "M15 18l-6-6 6-6",
    next: "M9 18l6-6-6-6",
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ? `<path d="${paths[name]}"/>` : '<circle cx="12" cy="12" r="9"/>'}</svg>`;
};
export const button = (action: string, label: string, kind = "primary", extra = "") =>
  `<button class="${kind}" type="button" data-action="${action}" ${extra}>${label}</button>`;
export const opt = (value: unknown, label: unknown, current?: unknown) =>
  `<option value="${esc(value)}" ${value === current ? "selected" : ""}>${esc(label)}</option>`;
export const field = (_name: string, label: string, input: string, wide = false) =>
  `<label class="${wide ? "wide" : ""}"><span>${label}</span>${input}</label>`;
export const input = (name: string, type = "text", value: unknown = "", extra = "") =>
  `<input name="${name}" type="${type}" value="${esc(value)}" ${extra}>`;
export const moneyInput = (name: string, value: unknown = "") =>
  input(name, "text", value, 'inputmode="decimal" placeholder="0,00"');
export const centsText = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
export const emptyState = (iconName: string, text: string, action?: string) =>
  `<div class="empty"><span class="empty-icon">${icon(iconName)}</span><h3>${text}</h3><p>Um passo de cada vez. Comece com o que você já sabe.</p>${action ? button(action, "Adicionar agora") : ""}</div>`;
export const formActions = (label: string, busy: boolean) =>
  `<div class="form-actions wide"><button class="secondary" type="button" data-action="close">Cancelar</button><button class="primary" type="submit" ${busy ? "disabled" : ""}>${busy ? "Salvando…" : label}</button></div>`;
export const segmented = (action: string, current: string, options: [string, string][], label: string) =>
  `<div class="segmented" role="group" aria-label="${esc(label)}">${options
    .map(([id, text]) => `<button type="button" class="${current === id ? "active" : ""}" aria-pressed="${current === id}" data-action="${action}" data-id="${id}">${text}</button>`)
    .join("")}</div>`;

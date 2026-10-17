// O que as telas separadas precisam saber do app, sem importar app.ts (evita dependência circular).
import type { FamilyAPI } from "../api.ts";

export interface ViewCtx {
  api: FamilyAPI;
  month: string;
  today: string;
  busy: boolean;
  names: (id: string) => string;
  own: (r: { owner_id: string }) => boolean;
  empty: (text: string, action?: string) => string;
}

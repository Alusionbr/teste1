import { emptyState, parseBackup, type State } from "./logic.ts";

export const STORAGE_KEY = "financeiro360:v1";

export function readStored(read: () => string | null): { state: State; blocked: boolean } {
  try {
    const raw = read();
    return { state: raw === null ? emptyState() : parseBackup(JSON.parse(raw)), blocked: false };
  } catch {
    return { state: emptyState(), blocked: true };
  }
}

export function writeStored(write: (serialized: string) => void, state: State, blocked: boolean): boolean {
  if (blocked) return false;
  try {
    write(JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

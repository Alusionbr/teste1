export const dashboardWidgets = ['categories', 'insights', 'recent'] as const;
export type DashboardWidget = typeof dashboardWidgets[number];
export const quickActions = ['expense', 'cards', 'shopping', 'pantry'] as const;
export type QuickAction = typeof quickActions[number];
export interface Preferences {
  theme: 'system' | 'light' | 'dark';
  palette: 'forest' | 'ocean' | 'plum';
  text_size: 'standard' | 'large';
  comfortable: boolean;
  simple_mode: boolean;
  hide_values: boolean;
  dashboard_order: DashboardWidget[];
  quick_actions: QuickAction[];
}
export function defaultPreferences(): Preferences {
  return { theme: 'system', palette: 'forest', text_size: 'standard', comfortable: true,
    simple_mode: true, hide_values: false, dashboard_order: [...dashboardWidgets], quick_actions: ['expense', 'shopping'] };
}
export function normalizePreferences(input: Partial<Preferences>): Preferences {
  const defaults = defaultPreferences();
  const choice = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
    options.includes(value as T) ? value as T : fallback;
  const list = <T extends string>(value: unknown, options: readonly T[], fallback: T[]): T[] =>
    Array.isArray(value) ? [...new Set(value.filter((item): item is T => options.includes(item)))] : fallback;
  return {
    theme: choice(input.theme, ['system','light','dark'], defaults.theme),
    palette: choice(input.palette, ['forest','ocean','plum'], defaults.palette),
    text_size: choice(input.text_size, ['standard','large'], defaults.text_size),
    comfortable: typeof input.comfortable === 'boolean' ? input.comfortable : defaults.comfortable,
    simple_mode: typeof input.simple_mode === 'boolean' ? input.simple_mode : defaults.simple_mode,
    hide_values: typeof input.hide_values === 'boolean' ? input.hide_values : defaults.hide_values,
    dashboard_order: list(input.dashboard_order, dashboardWidgets, defaults.dashboard_order),
    quick_actions: list(input.quick_actions, quickActions, defaults.quick_actions),
  };
}

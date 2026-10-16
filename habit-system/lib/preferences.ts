export type Habit = { id: string; label: string; unit: "min" | "pages" | "count"; enabled: boolean };
export type Preferences = { version: 1; name: string; github: boolean; habits: Habit[] };
export const DEFAULT_PREFERENCES: Preferences = {
  version: 1, name: "", github: true,
  habits: [
    { id: "programming", label: "Programação", unit: "min", enabled: true },
    { id: "english", label: "Inglês", unit: "min", enabled: true },
    { id: "reading", label: "Leitura", unit: "pages", enabled: true },
  ],
};
export const activeHabits = (p: Preferences) => p.habits.filter(h => h.enabled);
export const fieldName = (id: string) => id === "reading" ? "pages" : id;
export function validatePreferences(value: unknown): Preferences {
  const p = value as Preferences;
  if (!p || p.version !== 1 || typeof p.name !== "string" || p.name.trim().length > 60 || typeof p.github !== "boolean" || !Array.isArray(p.habits) || p.habits.length > 30) throw new Error("Configuração inválida. Use até 30 hábitos e um nome de até 60 caracteres.");
  const ids = new Set<string>();
  const labels = new Set<string>();
  const habits = p.habits.map(h => {
    if (!h || typeof h.id !== "string" || !/^(programming|english|reading|custom-[a-z0-9-]{1,50})$/.test(h.id) || ids.has(h.id) || typeof h.label !== "string" || !h.label.trim() || h.label.trim().length > 40 || labels.has(h.label.trim().toLowerCase()) || !["min", "pages", "count"].includes(h.unit) || typeof h.enabled !== "boolean") throw new Error("Cada hábito precisa de um nome único de até 40 caracteres e uma unidade válida.");
    const builtin = DEFAULT_PREFERENCES.habits.find(b => b.id === h.id);
    if (builtin && (builtin.unit !== h.unit || builtin.label !== h.label)) throw new Error("Os hábitos originais mantêm seus nomes e unidades para preservar o histórico.");
    ids.add(h.id); labels.add(h.label.trim().toLowerCase());
    return { id: h.id, label: h.label.trim(), unit: h.unit, enabled: h.enabled };
  });
  if (!habits.some(h => h.enabled)) throw new Error("Escolha pelo menos um hábito para acompanhar.");
  return { version: 1, name: p.name.trim(), github: p.github, habits };
}
export const habitAmount = (d: { prog: number | null; eng: number | null; pages: number | null; custom?: Record<string, number> }, id: string) =>
  (id === "programming" ? d.prog : id === "english" ? d.eng : id === "reading" ? d.pages : d.custom?.[id]) ?? 0;
export function formatHabit(value: number, unit: Habit["unit"]) {
  if (unit === "pages") return `${Math.round(value)} pág.`;
  if (unit === "count") return `${value} vezes`;
  const hours = Math.floor(value / 60), minutes = Math.round(value % 60);
  return hours ? `${hours}h${minutes ? `${minutes}min` : ""}` : `${minutes}min`;
}

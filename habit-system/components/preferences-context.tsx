"use client";
import { createContext, useContext } from "react";
import { DEFAULT_PREFERENCES, activeHabits, habitAmount, formatHabit, type Preferences } from "@/lib/preferences";
import type { DayLite } from "@/lib/dashboard";
export const PreferencesContext = createContext<Preferences>(DEFAULT_PREFERENCES);
export const usePreferences = () => useContext(PreferencesContext);
const colors = ["var(--prog)", "var(--eng)", "var(--read)", "var(--accent)"];
export function useHabits() {
  const prefs = usePreferences();
  return Object.fromEntries(activeHabits(prefs).map(h => [h.id, {
    ...h, color: colors[prefs.habits.findIndex(item => item.id === h.id) % colors.length], icon: h.id === "programming" ? "💻" : h.id === "english" ? "🗣️" : h.id === "reading" ? "📖" : "✦",
    thresholds: (h.unit === "min" ? [30, 90, 180] : [1, 5, 15]) as [number, number, number],
    of: (d: DayLite) => habitAmount(d, h.id),
    format: (value: number) => formatHabit(value, h.unit),
  }]));
}

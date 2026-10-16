"use server";

import fs from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { formatDuration, loadLogs, monthDir, parseDuration } from "@/lib/logs";
import { readPreferences, writePreferences } from "@/lib/preferences-store";
import { activeHabits, fieldName, validatePreferences, type Preferences } from "@/lib/preferences";
import { localToday } from "@/lib/stats";

export type NewDayState = { ok: boolean; message: string; file?: string } | null;

// Mesmo formato dos .md de julho em diante: "4hr", "1hr30min", "30min"
function mdDuration(min: number | null): string {
  if (!min) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}min`;
  return m ? `${h}hr${m}min` : `${h}hr`;
}

const cell = (s: string, width: number) => {
  const text = s.trim();
  const left = Math.max(1, Math.floor((width - text.length) / 2));
  return " ".repeat(left) + text.padEnd(width - left);
};

const row = (label: string, today: string, month: string) => `|${cell(label, 17)}|${cell(today, 17)}|${cell(month, 23)}|`;

// "wx": falha se o arquivo já existir — nunca sobrescreve nada
function writeNew(file: string, content: string): boolean {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    fs.writeFileSync(file, content, { flag: "wx" });
    return true;
  } catch {
    return false;
  }
}

export async function createDay(_prev: NewDayState, formData: FormData): Promise<NewDayState> {
  const preferences = readPreferences().preferences;
  let values: Record<string, number>;
  try { values = readHabitValues(formData, preferences); }
  catch (error) { return { ok: false, message: (error as Error).message }; }
  const custom = Object.fromEntries(Object.entries(values).filter(([id]) => id.startsWith("custom-")));

  const date = String(formData.get("date") ?? "");
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return { ok: false, message: "Data inválida." };
  const [, y, m, d] = match;
  const today = localToday();
  if (date > today) return { ok: false, message: "Não dá para registrar um dia que ainda não chegou." };

  const prog = values.programming ?? null;
  const eng = values.english ?? null;
  const pages = values.reading ?? null;
  const learned = String(formData.get("learned") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const logs = loadLogs();
  const existing = logs.days.find((day) => day.date === date);
  if (existing) {
    return { ok: false, message: `Já existe registro para ${d}/${m}/${y} em ${existing.file}. Nada foi alterado.` };
  }

  // Dia novo depois do último registro recebe o próximo número; dia do passado (retroativo)
  // fica sem número para não duplicar a contagem que já existe.
  const last = logs.days[logs.days.length - 1];
  const retroactive = !!last && date < last.date;
  const previous = [...logs.days].reverse().find((day) => day.date < date && day.dayNumber != null);
  const dayNumber = retroactive ? null : (previous?.dayNumber ?? 0) + 1;

  // Totais do mês = dias já registrados no mês (antes desta data) + hoje
  const monthDays = logs.days.filter((day) => day.date.startsWith(`${y}-${m}`) && day.date < date);
  const monthProg = monthDays.reduce((a, day) => a + (day.programmingMin ?? 0), 0) + (prog ?? 0);
  const monthEng = monthDays.reduce((a, day) => a + (day.englishMin ?? 0), 0) + (eng ?? 0);
  const monthPages = monthDays.reduce((a, day) => a + (day.pagesRead ?? 0), 0) + (pages ?? 0);
  const total = activeHabits(preferences).filter(h => h.unit === "min").reduce((sum, h) => sum + (values[h.id] ?? 0), 0);

  const content = [
    `<!-- habits-v1: ${JSON.stringify(custom)} -->`,
    "```md",
    dayNumber != null ? `# Day ${dayNumber} — ${d}/${m}/${y}` : `# Day — ${d}/${m}/${y} (retroactive log)`,
    "",
    "## 📚 What I Learned Today",
    "",
    learned,
    "---",
    "",
    "## ⏱️ Study Time",
    "",
    "-------------------------------------------------------------",
    "|      Topic      |      Today      |      Month Total      |",
    "|-----------------|----------------:|----------------------:|",
    ...activeHabits(preferences).map(h => {
      const value = values[h.id] ?? 0;
      const monthValue = h.id === "programming" ? monthProg : h.id === "english" ? monthEng : h.id === "reading" ? monthPages : monthDays.reduce((sum, day) => sum + (day.custom?.[h.id] ?? 0), 0) + value;
      const label = h.id === "programming" ? "Programming" : h.id === "english" ? "English" : h.id === "reading" ? "Read" : `Custom: ${h.label.replace(/[|\r\n]/g, " ")}`;
      return row(label, h.unit === "min" ? mdDuration(value) : String(value), h.unit === "min" ? mdDuration(monthValue) : String(monthValue));
    }),
    "-------------------------------------------------------------",
    "",
    `**Total study time today: *${mdDuration(total) || "0min"}*`,
    "---",
    "",
    "## 💭 Notes",
    "",
    notes,
    "```",
    "",
  ].join("\n");

  const file = path.join(monthDir(logs.root, Number(y), Number(m), today.slice(0, 7)), `${d}-${m}-${y}.md`);
  if (!writeNew(file, content)) {
    return { ok: false, message: `O arquivo ${path.relative(logs.root, file)} já existe. Nada foi alterado.` };
  }

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: dayNumber != null
      ? `Day ${dayNumber} salvo (${formatDuration(total)} de estudo).`
      : `${d}/${m}/${y} salvo como registro retroativo (${formatDuration(total)}).`,
    file: path.relative(logs.root, file),
  };
}

export async function createMonthSummary(_prev: NewDayState, formData: FormData): Promise<NewDayState> {
  const preferences = readPreferences().preferences;
  let values: Record<string, number>;
  try { values = readHabitValues(formData, preferences); }
  catch (error) { return { ok: false, message: (error as Error).message }; }
  const custom = Object.fromEntries(Object.entries(values).filter(([id]) => id.startsWith("custom-")));

  const month = String(formData.get("month") ?? "");
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) return { ok: false, message: "Mês inválido." };
  const [, y, m] = match;
  const today = localToday();
  if (month > today.slice(0, 7)) return { ok: false, message: "Esse mês ainda não chegou." };

  if (!Object.keys(values).length) {
    return { ok: false, message: "Preencha pelo menos um total dos hábitos selecionados." };
  }
  const notes = String(formData.get("notes") ?? "").trim();

  const logs = loadLogs();
  const existing = logs.monthSummaries.find((s) => s.key === month);
  if (existing) {
    return { ok: false, message: `Já existe um resumo para ${m}/${y} em ${existing.file}. Nada foi alterado.` };
  }

  const content = [
    `<!-- habits-v1: ${JSON.stringify(custom)} -->`,
    "```md",
    `# Month Summary — ${m}/${y}`,
    "",
    "> Retroactive record: study totals for the whole month.",
    "> Days logged individually in this month are already part of these totals.",
    "",
    "-------------------------------------------------------------",
    "|      Topic      |      Month Total      |",
    "|-----------------|----------------------:|",
    ...activeHabits(preferences).map(h => {
      const label = h.id === "programming" ? "Programming" : h.id === "english" ? "English" : h.id === "reading" ? "Read" : `Custom: ${h.label.replace(/[|\r\n]/g, " ")}`;
      const value = values[h.id] ?? 0;
      return `|${cell(label, 17)}|${cell(h.unit === "min" ? mdDuration(value) : String(value), 23)}|`;
    }),
    "-------------------------------------------------------------",
    "",
    "## 💭 Notes",
    "",
    notes,
    "```",
    "",
  ].join("\n");

  const file = path.join(monthDir(logs.root, Number(y), Number(m), today.slice(0, 7)), `month-summary-${m}-${y}.md`);
  if (!writeNew(file, content)) {
    return { ok: false, message: `O arquivo ${path.relative(logs.root, file)} já existe. Nada foi alterado.` };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: `Resumo de ${m}/${y} salvo.`, file: path.relative(logs.root, file) };
}

export async function savePreferences(_prev: NewDayState, formData: FormData): Promise<NewDayState> {
  try {
    const next = validatePreferences(JSON.parse(String(formData.get("preferences") ?? "")));
    const current = readPreferences().preferences;
    // Never discard IDs or change units once they may have recorded values.
    for (const old of current.habits) {
      const updated = next.habits.find(h => h.id === old.id);
      if (!updated) next.habits.push({ ...old, enabled: false });
      else if (updated.unit !== old.unit) throw new Error("A unidade de um hábito existente não pode ser alterada. Crie outro hábito.");
    }
    writePreferences(next);
    revalidatePath("/", "layout");
    return { ok: true, message: "Preferências salvas." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Não foi possível salvar. Tente novamente." };
  }
}

function readHabitValues(formData: FormData, preferences: Preferences) {
  const values: Record<string, number> = {};
  for (const h of activeHabits(preferences)) {
    const raw = String(formData.get(fieldName(h.id)) ?? "").trim();
    if (!raw) continue;
    const value = h.unit === "min" ? parseDuration(raw) : Number(raw);
    if (value == null || !Number.isFinite(value) || value < 0 || value > 10000000 || (h.unit !== "min" && !Number.isInteger(value)) || raw.startsWith("-")) throw new Error(`Valor inválido para ${h.label}. Use ${h.unit === "min" ? "2h30 ou 45min" : "um número inteiro maior ou igual a zero"}.`);
    values[h.id] = value;
  }
  return values;
}

"use server";

import fs from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { formatDuration, loadLogs, monthDir, parseDuration } from "@/lib/logs";
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

type Parsed = { min: number | null; error: boolean };
function readDuration(formData: FormData, name: string): Parsed {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) return { min: null, error: false };
  const min = parseDuration(raw);
  return { min, error: min == null };
}

function readPages(formData: FormData): { pages: number | null; error: boolean } {
  const raw = String(formData.get("pages") ?? "").trim();
  if (!raw) return { pages: null, error: false };
  const pages = parseInt(raw, 10);
  return { pages, error: Number.isNaN(pages) || pages < 0 };
}

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
  const date = String(formData.get("date") ?? "");
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return { ok: false, message: "Data inválida." };
  const [, y, m, d] = match;
  const today = localToday();
  if (date > today) return { ok: false, message: "Não dá para registrar um dia que ainda não chegou." };

  const prog = readDuration(formData, "programming");
  const eng = readDuration(formData, "english");
  if (prog.error || eng.error) return { ok: false, message: "Não entendi o tempo. Use algo como 2h30, 45min ou 1hr." };
  const { pages, error: pagesError } = readPages(formData);
  if (pagesError) return { ok: false, message: "Páginas inválidas." };
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
  const monthProg = monthDays.reduce((a, day) => a + (day.programmingMin ?? 0), 0) + (prog.min ?? 0);
  const monthEng = monthDays.reduce((a, day) => a + (day.englishMin ?? 0), 0) + (eng.min ?? 0);
  const monthPages = monthDays.reduce((a, day) => a + (day.pagesRead ?? 0), 0) + (pages ?? 0);
  const total = (prog.min ?? 0) + (eng.min ?? 0);

  const content = [
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
    row("Programming", mdDuration(prog.min), mdDuration(monthProg)),
    row("English", mdDuration(eng.min), mdDuration(monthEng)),
    row("Read", pages ? String(pages) : "", monthPages ? `${monthPages} pages` : ""),
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
  const month = String(formData.get("month") ?? "");
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) return { ok: false, message: "Mês inválido." };
  const [, y, m] = match;
  const today = localToday();
  if (month > today.slice(0, 7)) return { ok: false, message: "Esse mês ainda não chegou." };

  const prog = readDuration(formData, "programming");
  const eng = readDuration(formData, "english");
  if (prog.error || eng.error) return { ok: false, message: "Não entendi o tempo. Use algo como 20h, 12h30 ou 45min." };
  const { pages, error: pagesError } = readPages(formData);
  if (pagesError) return { ok: false, message: "Páginas inválidas." };
  if (prog.min == null && eng.min == null && pages == null) {
    return { ok: false, message: "Preencha pelo menos um total (programação, inglês ou páginas)." };
  }
  const notes = String(formData.get("notes") ?? "").trim();

  const logs = loadLogs();
  const existing = logs.monthSummaries.find((s) => s.key === month);
  if (existing) {
    return { ok: false, message: `Já existe um resumo para ${m}/${y} em ${existing.file}. Nada foi alterado.` };
  }

  const content = [
    "```md",
    `# Month Summary — ${m}/${y}`,
    "",
    "> Retroactive record: study totals for the whole month.",
    "> Days logged individually in this month are already part of these totals.",
    "",
    "-------------------------------------------------------------",
    "|      Topic      |      Month Total      |",
    "|-----------------|----------------------:|",
    `|${cell("Programming", 17)}|${cell(mdDuration(prog.min), 23)}|`,
    `|${cell("English", 17)}|${cell(mdDuration(eng.min), 23)}|`,
    `|${cell("Read", 17)}|${cell(pages ? `${pages} pages` : "", 23)}|`,
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

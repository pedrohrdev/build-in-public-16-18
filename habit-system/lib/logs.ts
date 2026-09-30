// Lê os .md diários do repositório (somente leitura) e transforma em dados estruturados.
// Os arquivos originais nunca são alterados: cada dia guarda o texto bruto completo em `raw`.
import fs from "node:fs";
import path from "node:path";
import { formatDuration } from "./format.ts";
import type { DayLite, SummaryLite } from "./dashboard.ts";

export { formatDuration };

export type LogFormat = "v1" | "v2" | "livre";

export type DayEntry = {
  date: string; // YYYY-MM-DD
  dayNumber: number | null;
  file: string; // caminho relativo à raiz dos logs
  format: LogFormat;
  groupedWith: string[]; // outras datas registradas no mesmo arquivo
  programmingMin: number | null;
  englishMin: number | null;
  pagesRead: number | null;
  totalMin: number | null;
  score: number | null; // "Note of the Day" (formato antigo)
  monthProgrammingMin: number | null; // total do mês escrito no arquivo
  monthEnglishMin: number | null;
  monthPages: number | null;
  study: string;
  learned: string;
  notes: string;
  raw: string;
  warnings: string[];
};

export type FileReport = { file: string; dates: string[]; warnings: string[] };

// Resumo retroativo de um mês inteiro (quando não há registro por dia)
export type MonthSummary = {
  key: string; // YYYY-MM
  programmingMin: number | null;
  englishMin: number | null;
  pages: number | null;
  notes: string;
  file: string;
  raw: string;
};

export type LoadResult = {
  root: string;
  days: DayEntry[];
  monthSummaries: MonthSummary[];
  files: FileReport[];
  ignoredFiles: string[]; // .md que não são registros diários (README, trilha etc.)
  duplicateDates: string[];
  missingDates: string[];
};

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const SKIP_DIRS = new Set([".git", "node_modules", ".next", "habit-system"]);
const DAILY_FILE = /^(\d{1,2}-)+\d{1,2}-\d{4}\.md$/;
export const SUMMARY_FILE = /^month-summary-(\d{2})-(\d{4})\.md$/;

export function logsRoot(): string {
  return process.env.LOGS_ROOT
    ? path.resolve(process.env.LOGS_ROOT)
    : path.resolve(process.cwd(), "..");
}

export function monthFolderName(month: number): string {
  return MONTHS[month - 1];
}

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDate = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

// "4hr", "4hrs", "4 hours", "30 min", "2hr30m", "3hr30", "24h35min",
// "2 hours and 15 minutes", "3" (número sozinho = horas). Retorna minutos.
export function parseDuration(input: string | null | undefined): number | null {
  if (!input) return null;
  const t = input.toLowerCase().replace(/[*`]/g, "").trim();
  if (!t || /^[-–—.\s]*$/.test(t)) return null;
  if (/^\d+([.,]\d+)?$/.test(t)) return Math.round(parseFloat(t.replace(",", ".")) * 60);

  const re = /(\d+(?:[.,]\d+)?)\s*(h(?:ours?|rs?)?|m(?:in(?:ute)?s?)?)?/g;
  let total = 0;
  let found = false;
  let lastUnit: "h" | "m" | null = null;
  for (const m of t.matchAll(re)) {
    const value = parseFloat(m[1].replace(",", "."));
    const unit = m[2]?.[0] as "h" | "m" | undefined;
    if (unit === "h") total += value * 60;
    else if (unit === "m" || lastUnit === "h") total += value;
    else continue;
    found = true;
    lastUnit = unit ?? "m";
  }
  return found ? Math.round(total) : null;
}

function firstInt(s: string | undefined): number | null {
  const m = s?.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function cleanText(s: string): string {
  return s
    .split("\n")
    .map((l) => l.trimEnd().replace(/^\s*--\s+/, ""))
    .filter((l) => !/^\s*(-{1,3}|\.|—)\s*$/.test(l))
    .join("\n")
    .trim();
}

function stripFence(raw: string): string {
  return raw.replace(/^\s*```\w*\s*\n/, "").replace(/\n\s*```\s*$/, "");
}

// Seções "## Título" -> conteúdo
function sections(body: string): Map<string, string> {
  const map = new Map<string, string>();
  let current: string | null = null;
  let buf: string[] = [];
  for (const line of body.split("\n")) {
    const h = line.match(/^##\s+(.*)$/);
    if (h) {
      if (current) map.set(current, buf.join("\n"));
      current = h[1].replace(/[^\p{L}\p{N}\s]/gu, "").trim().toLowerCase();
      buf = [];
    } else if (current) buf.push(line);
  }
  if (current) map.set(current, buf.join("\n"));
  return map;
}

function findSection(map: Map<string, string>, prefix: string): string {
  for (const [k, v] of map) if (k.startsWith(prefix)) return v;
  return "";
}

type Parsed = Omit<DayEntry, "date" | "dayNumber" | "file" | "groupedWith" | "raw">;

function parseBody(raw: string): Parsed {
  const body = stripFence(raw);
  const warnings: string[] = [];
  const base: Parsed = {
    format: "livre",
    programmingMin: null, englishMin: null, pagesRead: null, totalMin: null, score: null,
    monthProgrammingMin: null, monthEnglishMin: null, monthPages: null,
    study: "", learned: "", notes: "", warnings,
  };

  if (/\|\s*Programming\s*\|/i.test(body)) {
    base.format = "v2";
    for (const line of body.split("\n")) {
      const cells = line.split("|").map((c) => c.trim());
      if (cells.length < 4) continue;
      const [label, today, month] = [cells[1].toLowerCase(), cells[2], cells[3]];
      if (label === "programming") {
        base.programmingMin = parseDuration(today);
        base.monthProgrammingMin = parseDuration(month);
      } else if (label === "english") {
        base.englishMin = parseDuration(today);
        base.monthEnglishMin = parseDuration(month);
      } else if (label === "read") {
        base.pagesRead = firstInt(today);
        base.monthPages = firstInt(month);
      }
    }
    const total = body.match(/Total study time today:(.*)/i);
    if (total) base.totalMin = parseDuration(total[1]);
    const secs = sections(body);
    base.learned = cleanText(findSection(secs, "what i learned").replace(/-{5,}[\s\S]*/, ""));
    base.notes = cleanText(findSection(secs, "notes"));
    const sum = (base.programmingMin ?? 0) + (base.englishMin ?? 0);
    if (base.totalMin == null && (base.programmingMin != null || base.englishMin != null)) {
      base.totalMin = sum;
    } else if (base.totalMin != null && sum > 0 && base.totalMin !== sum) {
      warnings.push(
        `"Total study time" (${formatDuration(base.totalMin)}) diferente de programação + inglês (${formatDuration(sum)})`,
      );
    }
    return base;
  }

  if (/^##\s+(Study|Note of the Day|Time)/im.test(body)) {
    base.format = "v1";
    const secs = sections(body);
    const preamble = cleanText(body.replace(/^#\s.*$/m, "").split(/^##\s/m)[0]);
    base.study = cleanText(findSection(secs, "study")) || preamble;
    base.learned = cleanText(findSection(secs, "i learned"));
    base.totalMin = parseDuration(cleanText(findSection(secs, "time")));
    base.score = firstInt(findSection(secs, "note of the day"));
    const month = body.match(/Programming time of study of the month:\s*(.*)/i);
    if (month) base.monthProgrammingMin = parseDuration(month[1]);

    const dur = "(\\d+[^,.;)]*?(?:min(?:ute)?s?|hours?|hrs?|h)\\b(?:\\s*(?:and\\s*)?\\d+\\s*(?:min(?:ute)?s?|m)\\b)?)";
    const prog = base.study.match(new RegExp(`programming for ${dur}`, "i"));
    const eng =
      base.study.match(new RegExp(`English for ${dur}`, "i")) ??
      base.study.match(new RegExp(`English\\s*\\(${dur}\\)`, "i"));
    const pages = base.study.match(/read (\d+) pages/i);
    if (prog) base.programmingMin = parseDuration(prog[1]);
    if (eng) base.englishMin = parseDuration(eng[1]);
    if (pages) base.pagesRead = parseInt(pages[1], 10);
    if (base.programmingMin == null && base.totalMin != null) {
      base.programmingMin = Math.max(0, base.totalMin - (base.englishMin ?? 0));
      if (base.totalMin > 0) warnings.push("Programação estimada a partir do campo Time");
    }
    return base;
  }

  // Texto livre: guarda tudo depois do título
  base.study = cleanText(body.replace(/^#.*$/m, ""));
  return base;
}

function walk(dir: string, out: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), out);
    } else if (entry.name.endsWith(".md")) {
      out.push(path.join(dir, entry.name));
    }
  }
}

export function loadLogs(root = logsRoot()): LoadResult {
  const all: string[] = [];
  walk(root, all);
  all.sort();

  const days: DayEntry[] = [];
  const files: FileReport[] = [];
  const ignoredFiles: string[] = [];
  const monthSummaries: MonthSummary[] = [];

  for (const abs of all) {
    const rel = path.relative(root, abs);
    const base = path.basename(abs);
    const summary = base.match(SUMMARY_FILE);
    if (summary) {
      const raw = fs.readFileSync(abs, "utf8");
      const s: MonthSummary = {
        key: `${summary[2]}-${summary[1]}`,
        programmingMin: null, englishMin: null, pages: null, notes: "", file: rel, raw,
      };
      for (const line of stripFence(raw).split("\n")) {
        const cells = line.split("|").map((c) => c.trim());
        if (cells.length < 4) continue;
        const label = cells[1].toLowerCase();
        if (label === "programming") s.programmingMin = parseDuration(cells[2]);
        else if (label === "english") s.englishMin = parseDuration(cells[2]);
        else if (label === "read") s.pages = firstInt(cells[2]);
      }
      s.notes = cleanText(findSection(sections(stripFence(raw)), "notes"));
      if (monthSummaries.some((m) => m.key === s.key)) {
        files.push({ file: rel, dates: [], warnings: [`Já existe outro resumo para ${summary[1]}/${summary[2]}; este foi ignorado`] });
      } else {
        monthSummaries.push(s);
      }
      continue;
    }
    if (!DAILY_FILE.test(base)) {
      ignoredFiles.push(rel);
      continue;
    }
    const raw = fs.readFileSync(abs, "utf8");
    const fileWarnings: string[] = [];

    const parts = base.replace(/\.md$/, "").split("-").map(Number);
    const year = parts[parts.length - 1];
    let month = parts[parts.length - 2];
    let dayNums = parts.slice(0, -2);

    const header = raw.split("\n").find((l) => /^#\s*Day/i.test(l.trim())) ?? "";
    const headerDates = [...header.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g)];
    const folderMonth = MONTHS.indexOf(path.basename(path.dirname(abs)).toLowerCase()) + 1;

    // Nome do arquivo com mês diferente da pasta (ex.: september/10-10-2026.md): confia no título
    if (folderMonth && folderMonth !== month) {
      const h = headerDates.find((d) => Number(d[2]) === folderMonth);
      if (h) {
        fileWarnings.push(
          `Nome do arquivo diz mês ${pad(month)}, mas está na pasta de ${MONTHS[folderMonth - 1]} e o título diz ${h[0]} — usando ${h[0]}`,
        );
        month = folderMonth;
        dayNums = [Number(h[1])];
      } else {
        fileWarnings.push(`Mês do nome do arquivo (${pad(month)}) diferente da pasta`);
      }
    } else if (dayNums.length === 1 && headerDates.length === 1) {
      const [, hd, hm] = headerDates[0].map(Number);
      if (hd !== dayNums[0] || hm !== month) {
        fileWarnings.push(`Título diz ${headerDates[0][0]}, nome do arquivo diz ${pad(dayNums[0])}/${pad(month)} — usando o nome do arquivo`);
      }
    }

    const headerNums = (header.match(/Day\s+([\d,\s\-–]+?)\s*[—–-]\s*\d{1,2}[\/,]/i)?.[1] ?? header.match(/Day\s+(\d+)/i)?.[1] ?? "")
      .split(/[^\d]+/)
      .filter(Boolean)
      .map(Number);

    const parsed = parseBody(raw);
    const dates = dayNums.map((d) => isoDate(year, month, d));
    const grouped = dates.length > 1;
    if (grouped) fileWarnings.push(`Arquivo agrupa ${dates.length} dias; horas não são divididas entre eles`);

    dates.forEach((date, i) => {
      let study = parsed.study;
      if (grouped) {
        // "22 - fiz tal coisa" -> texto específico daquele dia, se existir
        const line = raw.split("\n").find((l) => new RegExp(`^\\s*${dayNums[i]}\\s*[-–—:]\\s+`).test(l));
        if (line) study = line.replace(/^\s*\d+\s*[-–—:]\s+/, "").trim();
      }
      days.push({
        ...parsed,
        warnings: [...fileWarnings, ...parsed.warnings],
        study,
        date,
        dayNumber: headerNums.length === dates.length ? headerNums[i] : i === 0 ? (headerNums[0] ?? null) : null,
        file: rel,
        groupedWith: dates.filter((d) => d !== date),
        raw,
      });
    });

    files.push({ file: rel, dates, warnings: [...fileWarnings, ...parsed.warnings] });
  }

  days.sort((a, b) => a.date.localeCompare(b.date));

  const seen = new Map<string, number>();
  for (const d of days) seen.set(d.date, (seen.get(d.date) ?? 0) + 1);
  const duplicateDates = [...seen].filter(([, n]) => n > 1).map(([d]) => d);

  const missingDates: string[] = [];
  if (days.length) {
    const cur = new Date(days[0].date + "T00:00:00Z");
    const end = new Date(days[days.length - 1].date + "T00:00:00Z");
    while (cur <= end) {
      const iso = cur.toISOString().slice(0, 10);
      if (!seen.has(iso)) missingDates.push(iso);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }

  monthSummaries.sort((a, b) => a.key.localeCompare(b.key));
  return { root, days, monthSummaries, files, ignoredFiles, duplicateDates, missingDates };
}

export function studiedMinutes(d: DayEntry): number {
  const sum = (d.programmingMin ?? 0) + (d.englishMin ?? 0);
  return Math.max(sum, d.totalMin ?? 0);
}

export function didStudy(d: DayEntry): boolean {
  return studiedMinutes(d) > 0 || (d.pagesRead ?? 0) > 0;
}

// Formato enxuto enviado ao navegador
export function toDayLite(d: DayEntry): DayLite {
  return {
    date: d.date,
    dayNumber: d.dayNumber,
    prog: d.programmingMin,
    eng: d.englishMin,
    pages: d.pagesRead,
    minutes: studiedMinutes(d),
    score: d.score,
    studied: didStudy(d),
    study: d.study,
    learned: d.learned,
    notes: d.notes,
    raw: d.raw,
    file: d.file,
    warnings: d.warnings,
    groupedWith: d.groupedWith,
  };
}

export function toSummaryLite(s: MonthSummary): SummaryLite {
  return { key: s.key, prog: s.programmingMin, eng: s.englishMin, pages: s.pages, notes: s.notes, file: s.file, raw: s.raw };
}

// Pasta onde um mês novo é gravado: usa a que já existir; meses passados sem pasta
// vão para my-old-version/, o mês atual (ou futuro) fica na raiz, como september/.
export function monthDir(root: string, year: number, month: number, todayKey: string): string {
  const folder = monthFolderName(month);
  const atRoot = path.join(root, folder);
  const old = path.join(root, "my-old-version", folder);
  if (fs.existsSync(atRoot)) return atRoot;
  if (fs.existsSync(old)) return old;
  return `${year}-${pad(month)}` < todayKey ? old : atRoot;
}

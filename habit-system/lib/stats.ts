import { didStudy, studiedMinutes, type DayEntry } from "./logs.ts";

export type MonthStats = {
  key: string; // YYYY-MM
  programmingMin: number;
  englishMin: number;
  pages: number;
  studiedDays: number;
  loggedDays: number;
  avgScore: number | null;
};

export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function computeStats(days: DayEntry[], today = localToday()) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const studied = (iso: string) => {
    const d = byDate.get(iso);
    return d ? didStudy(d) : false;
  };

  // Sequência atual: conta a partir de hoje (ou de ontem, se hoje ainda não foi registrado)
  let cursor = studied(today) ? today : addDays(today, -1);
  let currentStreak = 0;
  while (studied(cursor)) {
    currentStreak++;
    cursor = addDays(cursor, -1);
  }

  let bestStreak = 0;
  let bestEnd: string | null = null;
  let run = 0;
  if (days.length) {
    for (let iso = days[0].date; iso <= today; iso = addDays(iso, 1)) {
      run = studied(iso) ? run + 1 : 0;
      if (run > bestStreak) {
        bestStreak = run;
        bestEnd = iso;
      }
    }
  }

  const months = new Map<string, MonthStats & { scoreSum: number; scoreCount: number }>();
  for (const d of days) {
    const key = d.date.slice(0, 7);
    const m = months.get(key) ?? {
      key, programmingMin: 0, englishMin: 0, pages: 0, studiedDays: 0, loggedDays: 0,
      avgScore: null, scoreSum: 0, scoreCount: 0,
    };
    m.programmingMin += d.programmingMin ?? 0;
    m.englishMin += d.englishMin ?? 0;
    m.pages += d.pagesRead ?? 0;
    m.loggedDays++;
    if (didStudy(d)) m.studiedDays++;
    if (d.score != null) {
      m.scoreSum += d.score;
      m.scoreCount++;
    }
    months.set(key, m);
  }
  const monthly: MonthStats[] = [...months.values()].map(({ scoreSum, scoreCount, ...m }) => ({
    ...m,
    avgScore: scoreCount ? Math.round((scoreSum / scoreCount) * 10) / 10 : null,
  }));

  const sum = (f: (d: DayEntry) => number) => days.reduce((acc, d) => acc + f(d), 0);

  return {
    currentStreak,
    bestStreak,
    bestEnd,
    totalProgrammingMin: sum((d) => d.programmingMin ?? 0),
    totalEnglishMin: sum((d) => d.englishMin ?? 0),
    totalPages: sum((d) => d.pagesRead ?? 0),
    studiedDays: days.filter(didStudy).length,
    loggedDays: days.length,
    loggedToday: byDate.has(today),
    monthly,
    maxDayMin: Math.max(0, ...days.map(studiedMinutes)),
  };
}

export const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_LABELS[m - 1]}/${String(y).slice(2)}`;
}

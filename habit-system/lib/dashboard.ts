// Cálculos do painel. Código puro (sem node:fs): roda no servidor e no navegador,
// para as abas Mês e Ano poderem recalcular tudo para o período escolhido.
import { addDays, monthEnd, monthLabel } from "./format.ts";

export type HabitKey = "programming" | "english" | "reading";

export type DayLite = {
  date: string;
  dayNumber: number | null;
  prog: number | null;
  eng: number | null;
  pages: number | null;
  minutes: number;
  score: number | null;
  studied: boolean;
  study: string;
  learned: string;
  notes: string;
  raw: string;
  file: string;
  warnings: string[];
  groupedWith: string[];
};

// Resumo mensal escrito à mão (arquivo month-summary-MM-AAAA.md)
export type SummaryLite = {
  key: string;
  prog: number | null;
  eng: number | null;
  pages: number | null;
  notes: string;
  file: string;
  raw: string;
};

// O resumo vale como TOTAL do mês: só a parte que passa da soma dos dias registrados
// entra como "sem dia definido".
export type MonthExtra = { key: string; prog: number; eng: number; pages: number; summary: SummaryLite };

export type Report = {
  root: string;
  files: number;
  ignored: string[];
  duplicates: string[];
  missing: string[];
  warnings: { file: string; dates: string[]; warnings: string[] }[];
};

export type HabitStats = {
  key: HabitKey;
  total: number;
  extra: number; // parte vinda de resumos mensais
  studiedDays: number;
  avgPerStudiedDay: number;
  best: { date: string; value: number } | null;
  currentStreak: number;
  bestStreak: number;
  monthly: { key: string; label: string; value: number }[];
  cumulative: { date: string; value: number }[];
};

export type MonthCard = {
  key: string;
  label: string;
  prog: number;
  eng: number;
  pages: number;
  extra: MonthExtra | null;
  studiedDays: number;
  loggedDays: number;
  daysInMonth: number;
  avgScore: number | null;
  progDelta: number | null; // % vs mês anterior
  bestDay: { date: string; minutes: number } | null;
};

export type Achievement = {
  id: string;
  icon: string;
  title: string;
  desc: string;
  current: number;
  target: number;
  unlockedAt: string | null;
};

export type Dashboard = ReturnType<typeof buildDashboard>;

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export const habitValue = (d: DayLite, k: HabitKey) => (k === "programming" ? d.prog : k === "english" ? d.eng : d.pages) ?? 0;
const extraValue = (e: MonthExtra, k: HabitKey) => (k === "programming" ? e.prog : k === "english" ? e.eng : e.pages);

export function computeExtras(days: DayLite[], summaries: SummaryLite[]): MonthExtra[] {
  return summaries.map((s) => {
    const md = days.filter((d) => d.date.startsWith(s.key));
    const sum = (f: (d: DayLite) => number | null) => md.reduce((a, d) => a + (f(d) ?? 0), 0);
    return {
      key: s.key,
      prog: Math.max(0, (s.prog ?? 0) - sum((d) => d.prog)),
      eng: Math.max(0, (s.eng ?? 0) - sum((d) => d.eng)),
      pages: Math.max(0, (s.pages ?? 0) - sum((d) => d.pages)),
      summary: s,
    };
  });
}

function streaks(first: string | undefined, has: (iso: string) => boolean, today: string) {
  let cursor = has(today) ? today : addDays(today, -1);
  let current = 0;
  while (has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  let best = 0;
  let bestStart: string | null = null;
  let bestEnd: string | null = null;
  let run = 0;
  if (first) {
    for (let iso = first; iso <= today; iso = addDays(iso, 1)) {
      run = has(iso) ? run + 1 : 0;
      if (run > best) {
        best = run;
        bestEnd = iso;
        bestStart = addDays(iso, -(run - 1));
      }
    }
  }
  return { current, best, bestStart, bestEnd };
}

export function buildDashboard(days: DayLite[], extras: MonthExtra[], today: string) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const dates = days.map((d) => d.date);
  const monthKeys = [...new Set([...dates.map((d) => d.slice(0, 7)), ...extras.map((e) => e.key)])].sort();

  // Linha do tempo: cada dia + o fim de cada mês com resumo (onde entra a parte sem dia definido)
  type Ev = { date: string; v: Record<HabitKey, number> };
  const evMap = new Map<string, Ev>();
  const push = (date: string, k: HabitKey, v: number) => {
    const ev = evMap.get(date) ?? { date, v: { programming: 0, english: 0, reading: 0 } };
    ev.v[k] += v;
    evMap.set(date, ev);
  };
  for (const d of days) for (const k of ["programming", "english", "reading"] as HabitKey[]) push(d.date, k, habitValue(d, k));
  for (const e of extras) {
    const at = monthEnd(e.key) < today ? monthEnd(e.key) : today;
    for (const k of ["programming", "english", "reading"] as HabitKey[]) push(at, k, extraValue(e, k));
  }
  const timeline = [...evMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  const cumulativeOf = (k: HabitKey) => {
    let acc = 0;
    return timeline.map((ev) => ({ date: ev.date, value: (acc += ev.v[k]) }));
  };

  const habit = (k: HabitKey): HabitStats => {
    const active = days.filter((d) => habitValue(d, k) > 0);
    const daysTotal = active.reduce((a, d) => a + habitValue(d, k), 0);
    const extra = extras.reduce((a, e) => a + extraValue(e, k), 0);
    const best = active.reduce<{ date: string; value: number } | null>(
      (b, d) => (!b || habitValue(d, k) > b.value ? { date: d.date, value: habitValue(d, k) } : b),
      null,
    );
    const s = streaks(dates[0], (iso) => {
      const d = byDate.get(iso);
      return !!d && habitValue(d, k) > 0;
    }, today);
    return {
      key: k,
      total: daysTotal + extra,
      extra,
      studiedDays: active.length,
      avgPerStudiedDay: active.length ? Math.round(daysTotal / active.length) : 0,
      best,
      currentStreak: s.current,
      bestStreak: s.best,
      monthly: monthKeys.map((key) => ({
        key,
        label: monthLabel(key),
        value:
          days.filter((d) => d.date.startsWith(key)).reduce((a, d) => a + habitValue(d, k), 0) +
          extras.filter((e) => e.key === key).reduce((a, e) => a + extraValue(e, k), 0),
      })),
      cumulative: cumulativeOf(k),
    };
  };

  const habits = { programming: habit("programming"), english: habit("english"), reading: habit("reading") };
  const overall = streaks(dates[0], (iso) => !!byDate.get(iso)?.studied, today);
  const lastDate = dates[dates.length - 1] > today ? dates[dates.length - 1] : today;
  const span = dates.length ? Math.round((Date.parse(lastDate) - Date.parse(dates[0])) / 86400000) + 1 : 0;

  const months: MonthCard[] = monthKeys.map((key, i) => {
    const md = days.filter((d) => d.date.startsWith(key));
    const [y, m] = key.split("-").map(Number);
    const scores = md.filter((d) => d.score != null);
    const prog = habits.programming.monthly[i].value;
    const prevProg = i > 0 ? habits.programming.monthly[i - 1].value : null;
    const best = md.reduce<DayLite | null>((b, d) => (!b || d.minutes > b.minutes ? d : b), null);
    return {
      key,
      label: monthLabel(key),
      prog,
      eng: habits.english.monthly[i].value,
      pages: habits.reading.monthly[i].value,
      extra: extras.find((e) => e.key === key) ?? null,
      studiedDays: md.filter((d) => d.studied).length,
      loggedDays: md.length,
      daysInMonth: new Date(y, m, 0).getDate(),
      avgScore: scores.length ? Math.round((scores.reduce((a, d) => a + d.score!, 0) / scores.length) * 10) / 10 : null,
      progDelta: prevProg ? Math.round(((prog - prevProg) / prevProg) * 100) : null,
      bestDay: best && best.minutes > 0 ? { date: best.date, minutes: best.minutes } : null,
    };
  });

  const weekday = WEEKDAYS.map((label, wd) => {
    const list = days.filter((d) => new Date(d.date + "T00:00:00Z").getUTCDay() === wd);
    const prog = list.reduce((a, d) => a + (d.prog ?? 0), 0);
    const eng = list.reduce((a, d) => a + (d.eng ?? 0), 0);
    return {
      label,
      count: list.length,
      prog: list.length ? Math.round(prog / list.length) : 0,
      eng: list.length ? Math.round(eng / list.length) : 0,
      studiedPct: list.length ? Math.round((list.filter((d) => d.studied).length / list.length) * 100) : 0,
    };
  });

  // Conquistas: a data de desbloqueio é o dia em que o acumulado cruzou a meta
  const firstCross = (series: { date: string; value: number }[], target: number) =>
    series.find((p) => p.value >= target)?.date ?? null;
  let studiedAcc = 0;
  const studiedSeries = days.map((d) => ({ date: d.date, value: (studiedAcc += d.studied ? 1 : 0) }));
  let run = 0;
  let bestRun = 0;
  const streakSeries: { date: string; value: number }[] = [];
  if (dates.length) {
    for (let iso = dates[0]; iso <= today; iso = addDays(iso, 1)) {
      run = byDate.get(iso)?.studied ? run + 1 : 0;
      bestRun = Math.max(bestRun, run);
      streakSeries.push({ date: iso, value: bestRun });
    }
  }
  const P = habits.programming.cumulative;
  const E = habits.english.cumulative;
  const R = habits.reading.cumulative;
  const lastOf = (s: { value: number }[]) => s[s.length - 1]?.value ?? 0;
  const ach = (id: string, icon: string, title: string, desc: string, series: { date: string; value: number }[], target: number): Achievement => ({
    id, icon, title, desc, target, current: Math.min(lastOf(series), target), unlockedAt: firstCross(series, target),
  });
  const achievements: Achievement[] = [
    ach("start", "🌱", "Primeiro passo", "Registrou o Day 1", studiedSeries, 1),
    ach("d30", "📅", "30 dias estudando", "30 dias com estudo registrado", studiedSeries, 30),
    ach("d100", "💯", "Centenário", "100 dias com estudo", studiedSeries, 100),
    ach("d200", "🏛️", "200 dias", "200 dias com estudo", studiedSeries, 200),
    ach("s7", "🔥", "Semana perfeita", "7 dias seguidos estudando", streakSeries, 7),
    ach("s30", "☄️", "Mês imparável", "30 dias seguidos estudando", streakSeries, 30),
    ach("s60", "🌋", "Lenda da consistência", "60 dias seguidos", streakSeries, 60),
    ach("p50", "💻", "50h de código", "50 horas de programação", P, 50 * 60),
    ach("p100", "⚙️", "100h de código", "100 horas de programação", P, 100 * 60),
    ach("p250", "🚀", "250h de código", "250 horas de programação", P, 250 * 60),
    ach("p500", "🧠", "500h de código", "500 horas de programação", P, 500 * 60),
    ach("e25", "🗣️", "25h de inglês", "25 horas de inglês", E, 25 * 60),
    ach("e50", "🌎", "50h de inglês", "50 horas de inglês", E, 50 * 60),
    ach("r500", "📖", "500 páginas", "500 páginas lidas", R, 500),
    ach("r1000", "📚", "1.000 páginas", "1.000 páginas lidas", R, 1000),
    ach("r2500", "🏆", "2.500 páginas", "2.500 páginas lidas", R, 2500),
  ];

  return {
    today,
    firstDate: dates[0] ?? today,
    lastDayNumber: [...days].reverse().find((d) => d.dayNumber != null)?.dayNumber ?? null,
    loggedToday: byDate.has(today),
    days,
    extras,
    timeline: timeline.map((t) => t.date),
    overall: {
      currentStreak: overall.current,
      bestStreak: overall.best,
      bestStart: overall.bestStart,
      bestEnd: overall.bestEnd,
      studiedDays: days.filter((d) => d.studied).length,
      loggedDays: days.length,
      span,
      totalMinutes: habits.programming.total + habits.english.total,
      maxDayMinutes: Math.max(0, ...days.map((d) => d.minutes)),
    },
    habits,
    months,
    weekday,
    achievements,
  };
}

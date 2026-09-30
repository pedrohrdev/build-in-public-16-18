// Estatísticas dos commits do GitHub. Código puro (roda no navegador).
import type { Commit } from "./github.ts";
import { addDays, addMonths, monthLabel } from "./format.ts";

export type CommitDay = { date: string; count: number };

export function buildCommits(commits: Commit[], today: string) {
  const perDay = new Map<string, number>();
  for (const c of commits) perDay.set(c.date, (perDay.get(c.date) ?? 0) + 1);
  const days: CommitDay[] = [...perDay].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
  const first = days[0]?.date ?? today;

  const { currentStreak, bestStreak, best } = streakStats(days, today);

  // Todos os meses do primeiro commit até hoje (inclusive os sem commit, que aparecem como zero)
  const monthKeys: string[] = [];
  for (let k = first.slice(0, 7); k <= today.slice(0, 7); k = addMonths(k, 1)) monthKeys.push(k);
  const monthly = monthKeys.map((key) => ({
    key,
    label: monthLabel(key),
    value: days.filter((d) => d.date.startsWith(key)).reduce((a, d) => a + d.count, 0),
  }));

  let acc = 0;
  const cumulative = days.map((d) => ({ date: d.date, value: (acc += d.count) }));

  const repoMap = new Map<string, number>();
  for (const c of commits) repoMap.set(c.repo, (repoMap.get(c.repo) ?? 0) + 1);
  const repos = [...repoMap].map(([repo, count]) => ({ repo, count })).sort((a, b) => b.count - a.count);

  const hours = Array.from({ length: 24 }, (_, h) => commits.filter((c) => Number(c.time.slice(0, 2)) === h).length);
  return {
    total: commits.length,
    activeDays: days.length,
    first,
    days,
    currentStreak,
    bestStreak,
    best,
    avgPerActiveDay: days.length ? Math.round((commits.length / days.length) * 10) / 10 : 0,
    monthly,
    cumulative,
    repos,
    hours,
    recent: commits.slice(0, 15),
  };
}

// Sequência atual, maior sequência e melhor dia de uma lista de dias com atividade
export function streakStats(days: CommitDay[], today: string) {
  const has = new Set(days.filter((d) => d.count > 0).map((d) => d.date));
  let cursor = has.has(today) ? today : addDays(today, -1);
  let currentStreak = 0;
  while (has.has(cursor)) {
    currentStreak++;
    cursor = addDays(cursor, -1);
  }
  let bestStreak = 0;
  let run = 0;
  for (let iso = days[0]?.date ?? today; iso <= today; iso = addDays(iso, 1)) {
    run = has.has(iso) ? run + 1 : 0;
    bestStreak = Math.max(bestStreak, run);
  }
  const best = days.reduce<CommitDay | null>((b, d) => (!b || d.count > b.count ? d : b), null);
  return { currentStreak, bestStreak, best };
}

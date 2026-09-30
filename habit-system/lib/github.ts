// Busca os commits do perfil no GitHub (API de busca de commits) e guarda em cache.
// Sem token: só repositórios públicos e 10 buscas/min. Com GITHUB_TOKEN: inclui privados e limite maior.
import fs from "node:fs";
import path from "node:path";

export const GITHUB_USER = process.env.GITHUB_USER ?? "pedrohrdev";
const TTL = 30 * 60 * 1000; // 30 min
const CACHE_FILE = path.join(process.cwd(), "data", "github-cache.json");

export type Commit = {
  sha: string;
  date: string; // YYYY-MM-DD no fuso do autor
  time: string; // HH:MM
  repo: string; // dono/nome
  message: string; // primeira linha
  url: string;
};

// Contribuições exatamente como o GitHub conta (quadradinhos verdes do perfil). Precisa de token.
export type Contributions = {
  days: { date: string; count: number }[];
  total: number; // desde a criação da conta
  lastYear: number; // o "N contributions in the last year" do perfil
  commits: number; // commits em repositórios públicos
  pullRequests: number;
  issues: number;
  reviews: number;
  repositories: number; // repositórios criados
  restricted: number; // contribuições privadas (o GitHub só informa o total)
};

export type GithubData = {
  user: string;
  createdAt: string | null; // data de criação da conta
  contributions: Contributions | null;
  commits: Commit[];
  fetchedAt: string | null;
  error: string | null; // preenchido quando a busca falhou (pode haver dados antigos do cache)
  authenticated: boolean;
};

type Cache = { key: string; fetchedAt: string; commits: Commit[]; createdAt: string | null; contributions: Contributions | null };
let memory: Cache | null = null;

type SearchItem = {
  sha: string;
  html_url: string;
  commit: { author: { date: string }; message: string };
  repository: { full_name: string };
};

const headers = (token: string | undefined) => ({
  Accept: "application/vnd.github+json",
  "User-Agent": "habit-system",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

async function accountCreatedAt(token: string | undefined): Promise<string> {
  const res = await fetch(`https://api.github.com/users/${GITHUB_USER}`, { headers: headers(token), signal: AbortSignal.timeout(10_000), cache: "no-store" });
  if (!res.ok) throw new Error(`GitHub respondeu ${res.status} ao buscar o perfil.`);
  return ((await res.json()) as { created_at: string }).created_at.slice(0, 10);
}

const CC_FIELDS = `contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
  totalCommitContributions totalPullRequestContributions totalIssueContributions
  totalPullRequestReviewContributions totalRepositoryContributions restrictedContributionsCount`;

type CC = {
  contributionCalendar: { totalContributions: number; weeks: { contributionDays: { date: string; contributionCount: number }[] }[] };
  totalCommitContributions: number;
  totalPullRequestContributions: number;
  totalIssueContributions: number;
  totalPullRequestReviewContributions: number;
  totalRepositoryContributions: number;
  restrictedContributionsCount: number;
};

async function graphql<T>(query: string, token: string): Promise<T> {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (!res.ok || !json.data) throw new Error(json.errors?.[0]?.message ?? `GitHub respondeu ${res.status}.`);
  return json.data;
}

// O GitHub só devolve até 1 ano por consulta: busca em janelas de 1 ano desde a criação da conta
async function fetchContributions(since: string, until: string, token: string): Promise<Contributions> {
  const windows: [string, string][] = [];
  for (let from = since; from <= until; ) {
    const next = new Date(Date.parse(from) + 364 * 86400000).toISOString().slice(0, 10);
    const to = next < until ? next : until;
    windows.push([from, to]);
    from = new Date(Date.parse(to) + 86400000).toISOString().slice(0, 10);
  }
  const aliases = windows
    .map(([f, t], i) => `w${i}: contributionsCollection(from: "${f}T00:00:00Z", to: "${t}T23:59:59Z") { ${CC_FIELDS} }`)
    .join("\n");
  const data = await graphql<{ user: Record<string, CC> & { lastYear: { contributionCalendar: { totalContributions: number } } } }>(
    `query { user(login: "${GITHUB_USER}") { ${aliases}
      lastYear: contributionsCollection { contributionCalendar { totalContributions } } } }`,
    token,
  );
  const out: Contributions = { days: [], total: 0, lastYear: data.user.lastYear.contributionCalendar.totalContributions, commits: 0, pullRequests: 0, issues: 0, reviews: 0, repositories: 0, restricted: 0 };
  const seen = new Set<string>();
  windows.forEach((_, i) => {
    const c = data.user[`w${i}`] as CC;
    out.total += c.contributionCalendar.totalContributions;
    out.commits += c.totalCommitContributions;
    out.pullRequests += c.totalPullRequestContributions;
    out.issues += c.totalIssueContributions;
    out.reviews += c.totalPullRequestReviewContributions;
    out.repositories += c.totalRepositoryContributions;
    out.restricted += c.restrictedContributionsCount;
    for (const w of c.contributionCalendar.weeks)
      for (const d of w.contributionDays)
        if (d.contributionCount > 0 && d.date >= since && d.date <= until && !seen.has(d.date)) {
          seen.add(d.date);
          out.days.push({ date: d.date, count: d.contributionCount });
        }
  });
  out.days.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

async function searchPage(from: string, to: string, page: number, token: string | undefined) {
  const q = encodeURIComponent(`author:${GITHUB_USER} author-date:${from}..${to}`);
  const res = await fetch(`https://api.github.com/search/commits?q=${q}&sort=author-date&order=desc&per_page=100&page=${page}`, {
    headers: headers(token),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (res.status === 403 || res.status === 429) throw new Error("Limite de buscas do GitHub atingido. Tente de novo em alguns minutos.");
  if (!res.ok) throw new Error(`GitHub respondeu ${res.status}.`);
  return (await res.json()) as { total_count: number; items: SearchItem[] };
}

// A busca devolve no máximo 1000 resultados por consulta: se passar disso, divide o período ao meio.
async function fetchRange(from: string, to: string, token: string | undefined): Promise<SearchItem[]> {
  const first = await searchPage(from, to, 1, token);
  if (first.total_count > 1000 && from < to) {
    const mid = new Date((Date.parse(from) + Date.parse(to)) / 2).toISOString().slice(0, 10);
    const next = new Date(Date.parse(mid) + 86400000).toISOString().slice(0, 10);
    return [...(await fetchRange(from, mid, token)), ...(await fetchRange(next, to, token))];
  }
  const items = [...first.items];
  const pages = Math.min(10, Math.ceil(first.total_count / 100));
  for (let p = 2; p <= pages; p++) items.push(...(await searchPage(from, to, p, token)).items);
  return items;
}

function toCommit(i: SearchItem): Commit {
  const iso = i.commit.author.date; // ex.: 2026-09-30T08:42:00.000-03:00 (hora local do autor)
  return {
    sha: i.sha,
    date: iso.slice(0, 10),
    time: iso.slice(11, 16),
    repo: i.repository.full_name,
    message: i.commit.message.split("\n")[0],
    url: i.html_url,
  };
}

function readDisk(): Cache | null {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) as Cache;
  } catch {
    return null;
  }
}

export async function loadGithub(until: string): Promise<GithubData> {
  const token = process.env.GITHUB_TOKEN || undefined;
  const key = `${GITHUB_USER}|${until}|${token ? "auth" : "anon"}|v2`;
  const cached = memory?.key === key ? memory : readDisk();
  const fresh = cached?.key === key && Date.now() - Date.parse(cached.fetchedAt) < TTL;
  const base = { user: GITHUB_USER, authenticated: !!token };
  if (fresh && cached) return { ...base, ...pick(cached), error: null };

  try {
    const createdAt = await accountCreatedAt(token);
    const [items, contributions] = await Promise.all([
      fetchRange(createdAt, until, token),
      token ? fetchContributions(createdAt, until, token) : Promise.resolve(null),
    ]);
    const seen = new Set<string>();
    const commits = items
      .filter((i) => !seen.has(i.sha) && seen.add(i.sha))
      .map(toCommit)
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    memory = { key, fetchedAt: new Date().toISOString(), commits, createdAt, contributions };
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(memory));
    return { ...base, ...pick(memory), error: null };
  } catch (e) {
    // Falhou (sem internet, limite do GitHub...): usa o último cache, mesmo antigo
    const msg = e instanceof Error ? e.message : "Não foi possível buscar os dados do GitHub.";
    const stale = cached && cached.key.split("|")[0] === GITHUB_USER && "contributions" in cached ? cached : null;
    return {
      ...base,
      ...(stale ? pick(stale) : { commits: [], fetchedAt: null, createdAt: null, contributions: null }),
      error: msg,
    };
  }
}

const pick = (c: Cache) => ({ commits: c.commits, fetchedAt: c.fetchedAt, createdAt: c.createdAt, contributions: c.contributions });

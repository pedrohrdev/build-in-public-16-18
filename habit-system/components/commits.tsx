"use client";

// Commits do GitHub: carregados depois da página abrir (a busca pode levar alguns segundos).
import { motion } from "motion/react";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { buildCommits, streakStats } from "@/lib/commits";
import { brDate, longDate } from "@/lib/format";
import type { Commit, Contributions, GithubData } from "@/lib/github";
import { AreaChart, BarChart, Heatmap } from "./charts";
import { useOverlays } from "./overlays";
import { Card, CountUp, EASE, Section } from "./ui";

type State = { status: "loading" } | { status: "done"; data: GithubData };
const GithubCtx = createContext<State>({ status: "loading" });
export const useGithub = () => useContext(GithubCtx);

export function GithubProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    fetch("/api/github")
      .then((r) => r.json() as Promise<GithubData>)
      .then((data) => alive && setState({ status: "done", data }))
      .catch(() =>
        alive &&
        setState({
          status: "done",
          data: {
            user: "",
            createdAt: null,
            contributions: null,
            commits: [],
            fetchedAt: null,
            error: "Não foi possível falar com o servidor.",
            authenticated: false,
          },
        }),
      );
    return () => {
      alive = false;
    };
  }, []);
  return <GithubCtx.Provider value={state}>{children}</GithubCtx.Provider>;
}

const COLOR = "var(--commit)";

export function CommitsSection({ today, loggedDates }: { today: string; loggedDates: Set<string> }) {
  const gh = useGithub();
  const { openDay } = useOverlays();
  const data = gh.status === "done" ? gh.data : null;
  const s = useMemo(() => (data ? buildCommits(data.commits, today) : null), [data, today]);
  const contrib = data?.contributions ?? null;
  // Heatmap e sequências: contribuições (iguais ao perfil) quando houver token; senão, commits
  const activity = useMemo(() => (contrib ? contrib.days : (s?.days ?? [])), [contrib, s]);
  const streak = useMemo(() => streakStats(activity, today), [activity, today]);
  const unit = contrib ? "contribuições" : "commits";

  return (
    <Section
      id="commits"
      eyebrow="GitHub"
      color={COLOR}
      title="Código no GitHub"
      subtitle={
        data ? (
          <>
            Direto do perfil{" "}
            <a href={`https://github.com/${data.user}`} target="_blank" rel="noreferrer" className="text-foreground underline decoration-[var(--commit)] underline-offset-4">
              @{data.user}
            </a>
            {data.createdAt && <>, desde que a conta foi criada ({brDate(data.createdAt)})</>}. Sem precisar anotar nada.
          </>
        ) : (
          "Buscando seus dados no GitHub…"
        )
      }
    >
      {gh.status === "loading" && <Loading />}
      {data?.error && (
        <p className="mb-4 rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted">
          ⚠ {data.error}
          {data.commits.length > 0 && data.fetchedAt && ` Mostrando os dados de ${new Date(data.fetchedAt).toLocaleString("pt-BR")}.`}
        </p>
      )}
      {data && !data.error && !contrib && (
        <p className="mb-4 rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted">
          Sem token do GitHub: mostrando só commits de repositórios públicos. Abra pelo atalho “Hábitos 16→18” (ou rode{" "}
          <code className="font-mono text-xs">GITHUB_TOKEN=$(gh auth token) npm run dev</code>) para ver as contribuições iguais ao perfil, incluindo as privadas.
        </p>
      )}
      {contrib && <ContributionsCard c={contrib} />}
      {s && s.total > 0 && (
        <div className="mt-4 grid gap-4 lg:grid-cols-4">
          <Card className="flex flex-col justify-between lg:row-span-2">
            <div>
              <div className="text-sm text-muted">commits</div>
              <div className="text-5xl font-semibold tracking-tight md:text-6xl" style={{ color: COLOR }}>
                <CountUp value={s.total} />
              </div>
              <div className="text-sm text-muted">
                desde {brDate(s.first)}
                {!data?.authenticated && " · só públicos"}
              </div>
            </div>
            <dl className="mt-8 space-y-4 text-sm">
              {[
                { l: "dias com commit", v: `${s.activeDays}` },
                { l: "média por dia com commit", v: `${s.avgPerActiveDay}` },
                { l: `sequência atual (${unit})`, v: `${streak.currentStreak} dias` },
                { l: `maior sequência (${unit})`, v: `${streak.bestStreak} dias` },
              ].map((x) => (
                <div key={x.l} className="flex items-baseline justify-between gap-2 border-b border-border pb-2">
                  <dt className="text-muted">{x.l}</dt>
                  <dd className="font-semibold tabular-nums">{x.v}</dd>
                </div>
              ))}
            </dl>
            {s.best && (
              <div className="mt-6 rounded-2xl border border-border bg-card-2 p-4">
                <div className="text-xs text-muted">🏅 dia com mais commits</div>
                <div className="mt-1 text-xl font-semibold">{s.best.count} commits</div>
                <div className="text-xs text-muted">{brDate(s.best.date)}</div>
              </div>
            )}
          </Card>
          <Card className="lg:col-span-3" delay={0.06}>
            <div className="mb-5 font-medium">Commits acumulados</div>
            <AreaChart
              dates={s.cumulative.map((c) => c.date)}
              series={[{ key: "c", label: "commits", color: COLOR, values: s.cumulative.map((c) => c.value) }]}
              format={(v) => `${Math.round(v)}`}
              height={220}
            />
          </Card>
          <Card delay={0.1}>
            <div className="mb-5 font-medium">Commits por mês</div>
            <BarChart
              labels={s.monthly.map((m) => m.label.slice(0, 3))}
              series={[{ key: "c", label: "commits", color: COLOR, values: s.monthly.map((m) => m.value) }]}
              format={(v) => `${Math.round(v)}`}
              unit={2}
              height={180}
            />
          </Card>
          <Card className="lg:col-span-2" delay={0.14}>
            <div className="mb-1 font-medium">{contrib ? "Contribuições por dia" : "Dias com commit"}</div>
            <p className="mb-5 text-sm text-muted">{contrib ? "Os mesmos quadradinhos do seu perfil no GitHub." : "Commits em repositórios públicos."}</p>
            {activity.length > 0 && (
              <Heatmap
                items={activity}
                from={activity[0].date}
                to={today}
                color={COLOR}
                thresholds={[2, 5, 10]}
                value={(d) => d.count}
                onSelect={(iso) => loggedDates.has(iso) && openDay(iso)}
                tip={(d, iso) => (
                  <>
                    <div className="text-muted first-letter:uppercase">{longDate(iso)}</div>
                    <div className="font-semibold">{d ? `${d.count} ${contrib ? "contribuições" : "commits"}` : `nenhuma atividade`}</div>
                  </>
                )}
              />
            )}
          </Card>
          <Card className="lg:col-span-2">
            <div className="mb-5 font-medium">Repositórios mais ativos</div>
            <ul className="space-y-3">
              {s.repos.slice(0, 8).map((r, i) => (
                <li key={r.repo}>
                  <a href={`https://github.com/${r.repo}`} target="_blank" rel="noreferrer" className="group block">
                    <div className="mb-1 flex justify-between gap-3 text-sm">
                      <span className="truncate group-hover:underline">{r.repo.split("/")[1]}</span>
                      <span className="font-semibold tabular-nums">{r.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--empty)]">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: COLOR }}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${(r.count / s.repos[0].count) * 100}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: i * 0.06, ease: EASE }}
                      />
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="lg:col-span-2" delay={0.06}>
            <div className="mb-1 font-medium">Que horas você commita</div>
            <p className="mb-5 text-sm text-muted">Commits por hora do dia.</p>
            <BarChart
              labels={s.hours.map((_, h) => `${h}h`)}
              series={[{ key: "c", label: "commits", color: COLOR, values: s.hours }]}
              format={(v) => `${Math.round(v)}`}
              values="peak"
              labelEvery={3}
              gapPct={1.5}
              height={160}
            />
          </Card>
          <Card className="lg:col-span-4">
            <div className="mb-4 font-medium">Commits recentes</div>
            <CommitList commits={s.recent} showDate />
            {data?.fetchedAt && (
              <p className="mt-4 text-xs text-faint">Atualizado em {new Date(data.fetchedAt).toLocaleString("pt-BR")} · atualiza a cada 30 min</p>
            )}
          </Card>
        </div>
      )}
      {s && s.total === 0 && !data?.error && <p className="text-muted">Nenhum commit encontrado nesse período.</p>}
    </Section>
  );
}

// Contribuições como o GitHub conta: total, "último ano" e de que são feitas
function ContributionsCard({ c }: { c: Contributions }) {
  const parts = [
    { l: "commits em repositórios públicos", v: c.commits },
    { l: "privadas (o GitHub só mostra o total)", v: c.restricted },
    { l: "pull requests", v: c.pullRequests },
    { l: "repositórios criados", v: c.repositories },
    { l: "issues", v: c.issues },
    { l: "revisões de PR", v: c.reviews },
  ].filter((p) => p.v > 0);
  return (
    <Card>
      <div className="grid gap-6 md:grid-cols-[auto_1fr] md:gap-10">
        <div>
          <div className="text-sm text-muted">contribuições</div>
          <div className="text-6xl font-semibold tracking-tight" style={{ color: COLOR }}>
            <CountUp value={c.total} />
          </div>
          <div className="text-sm text-muted">desde a criação da conta</div>
          <div className="mt-3 rounded-xl bg-card-2 px-3 py-2 text-sm">
            <b className="tabular-nums">{c.lastYear.toLocaleString("pt-BR")}</b> no último ano
            <span className="text-muted"> · igual ao perfil</span>
          </div>
        </div>
        <ul className="space-y-3 self-center">
          {parts.map((p, i) => (
            <li key={p.l}>
              <div className="mb-1 flex justify-between gap-3 text-sm">
                <span className="text-muted">{p.l}</span>
                <span className="font-semibold tabular-nums">{p.v.toLocaleString("pt-BR")}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--empty)]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: COLOR }}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${(p.v / Math.max(1, c.total)) * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, delay: i * 0.06, ease: EASE }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

export function CommitList({ commits, showDate = false }: { commits: Commit[]; showDate?: boolean }) {
  return (
    <ul className="divide-y divide-border">
      {commits.map((c) => (
        <li key={c.sha}>
          <a href={c.url} target="_blank" rel="noreferrer" className="group flex items-baseline gap-3 py-2.5 text-sm">
            <span className="h-2 w-2 shrink-0 translate-y-[-1px] rounded-full" style={{ background: COLOR }} />
            <span className="min-w-0 flex-1 truncate group-hover:underline">{c.message}</span>
            <span className="hidden shrink-0 text-xs text-muted sm:inline">{c.repo.split("/")[1]}</span>
            <span className="shrink-0 font-mono text-xs text-faint tabular-nums">
              {showDate ? `${brDate(c.date).slice(0, 5)} ` : ""}
              {c.time}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

// Commits de um dia, para o painel do dia
export function DayCommits({ date }: { date: string }) {
  const gh = useGithub();
  if (gh.status === "loading") return <p className="text-sm text-muted">Buscando commits…</p>;
  const list = gh.data.commits.filter((c) => c.date === date).sort((a, b) => a.time.localeCompare(b.time));
  if (!list.length) return null;
  return (
    <div>
      <div className="mb-1 text-xs font-medium tracking-wider text-muted uppercase">
        {list.length} commit{list.length > 1 ? "s" : ""} no GitHub
      </div>
      <CommitList commits={list} />
    </div>
  );
}

function Loading() {
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className={`h-40 rounded-3xl bg-card ${i === 1 ? "lg:col-span-3" : i === 3 ? "lg:col-span-3" : ""}`}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

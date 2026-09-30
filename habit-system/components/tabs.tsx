"use client";

// Abas novas: Hoje, Mês e Ano. Reaproveitam as seções de sections.tsx.
import { AnimatePresence, motion } from "motion/react";
import { useActionState, useMemo, useState } from "react";
import { createDay, createMonthSummary, type NewDayState } from "@/app/actions";
import { buildDashboard, habitValue, type Dashboard, type DayLite, type HabitKey, type MonthExtra, type SummaryLite } from "@/lib/dashboard";
import { addDays, addMonths, brDate, formatDuration, formatHours, longDate, monthEnd, monthName } from "@/lib/format";
import { BarChart } from "./charts";
import { DayFields, input, useOverlays } from "./overlays";
import { AllDays, ExtraNote, HABITS, Hero, Months, Overview, Summary, fmt, tickHours } from "./sections";
import { Card, CountUp, EASE, Legend, Reveal, Ring, Section } from "./ui";

const KEYS = Object.keys(HABITS) as HabitKey[];

/* ================================================================ HOJE */

export function TodayTab({ all }: { all: Dashboard }) {
  return (
    <>
      <Hero data={all} />
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <TodayPanel all={all} />
        <Summary data={all} />
      </div>
    </>
  );
}

function TodayPanel({ all }: { all: Dashboard }) {
  const { openDay, openNew } = useOverlays();
  const today = all.today;
  const byDate = new Map(all.days.map((d) => [d.date, d]));
  const day = byDate.get(today);
  const yesterday = byDate.get(addDays(today, -1));
  const done = KEYS.filter((k) => day && habitValue(day, k) > 0);
  const missing = KEYS.filter((k) => !done.includes(k));
  const streak = all.overall.currentStreak;

  // Semana atual (segunda até hoje) x mesmo trecho da semana passada
  const dow = (new Date(today + "T00:00:00Z").getUTCDay() + 6) % 7;
  const weekStart = addDays(today, -dow);
  const sumRange = (from: string, to: string) =>
    all.days.filter((d) => d.date >= from && d.date <= to).reduce((a, d) => a + (d.prog ?? 0) + (d.eng ?? 0), 0);
  const thisWeek = sumRange(weekStart, today);
  const lastWeek = sumRange(addDays(weekStart, -7), addDays(today, -7));
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  return (
    <Section
      id="hoje-painel"
      eyebrow="Hoje"
      title={<span className="first-letter:uppercase">{longDate(today)}</span>}
      subtitle={
        day
          ? done.length === KEYS.length
            ? "Os três hábitos feitos hoje. Dia completo! 🎉"
            : `Você já registrou hoje. ${done.length} de 3 hábitos feitos.`
          : streak > 0
            ? `Ainda não registrou hoje. Estude e registre para a sequência ir para ${streak + 1} dias 🔥`
            : "Ainda não registrou hoje. Bora começar uma sequência nova?"
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="font-medium">O que você fez</div>
            {day ? (
              <button onClick={() => openDay(today)} className="text-sm text-muted hover:text-foreground">ver o dia completo →</button>
            ) : (
              <button onClick={openNew} className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink">Registrar hoje</button>
            )}
          </div>
          <div className="space-y-5">
            {KEYS.map((k, i) => {
              const cfg = HABITS[k];
              const value = day ? habitValue(day, k) : 0;
              const goal = Math.max(1, all.habits[k].avgPerStudiedDay);
              return (
                <div key={k}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: cfg.color }} />
                      {cfg.label}
                    </span>
                    <span className="tabular-nums">
                      <b>{value ? fmt(k)(value) : "—"}</b>
                      <span className="text-muted"> / sua média {fmt(k)(goal)}</span>
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[var(--empty)]">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: cfg.color }}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${Math.min(100, (value / goal) * 100)}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: i * 0.1, ease: EASE }}
                    />
                  </div>
                  {value >= goal && <div className="mt-1 text-xs text-muted">acima da sua média ✓</div>}
                </div>
              );
            })}
          </div>
          {day?.learned && (
            <p className="mt-6 rounded-2xl bg-card-2 px-4 py-3 text-sm whitespace-pre-line">
              <span className="mb-1 block text-xs text-muted uppercase">aprendi</span>
              {day.learned}
            </p>
          )}
        </Card>

        <Card delay={0.08}>
          <div className="mb-4 font-medium">O que faltou</div>
          {missing.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <motion.div className="text-5xl" animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 2 }}>🏆</motion.div>
              <p className="mt-3 text-sm text-muted">Nada! Todos os hábitos feitos hoje.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {missing.map((k) => (
                <li key={k} className="flex items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-3">
                  <span className="text-2xl">{HABITS[k].icon}</span>
                  <div>
                    <div className="font-medium">{HABITS[k].label}</div>
                    <div className="text-xs text-muted">sua média: {fmt(k)(all.habits[k].avgPerStudiedDay)} por dia praticado</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl bg-card-2 py-3">
              <div className="text-xl font-semibold tabular-nums">{formatDuration(day?.minutes ?? 0)}</div>
              <div className="text-[11px] text-muted">hoje</div>
            </div>
            <div className="rounded-2xl bg-card-2 py-3">
              <div className="text-xl font-semibold tabular-nums">{formatDuration(yesterday?.minutes ?? 0)}</div>
              <div className="text-[11px] text-muted">ontem</div>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-4 font-medium">Últimos 7 dias</div>
          <div className="grid grid-cols-7 gap-2">
            {last7.map((iso, i) => {
              const d = byDate.get(iso);
              const max = Math.max(60, ...last7.map((x) => byDate.get(x)?.minutes ?? 0));
              return (
                <motion.button
                  key={iso}
                  disabled={!d}
                  onClick={() => openDay(iso)}
                  whileHover={d ? { y: -3 } : undefined}
                  className={`flex flex-col items-center gap-2 rounded-2xl border p-2 ${iso === today ? "border-accent" : "border-border"} ${d ? "" : "opacity-60"}`}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                >
                  <span className="text-[11px] text-muted">{["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][new Date(iso + "T00:00:00Z").getUTCDay()]}</span>
                  <div className="flex h-20 w-full items-end justify-center gap-[2px]">
                    {d ? (
                      (["programming", "english"] as HabitKey[]).map((k) => (
                        <motion.div
                          key={k}
                          className="w-2.5 rounded-t-[4px]"
                          style={{ background: HABITS[k].color, height: `${(habitValue(d, k) / max) * 100}%`, transformOrigin: "bottom" }}
                          initial={{ scaleY: 0 }}
                          whileInView={{ scaleY: 1 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.2 + i * 0.05, duration: 0.6 }}
                        />
                      ))
                    ) : (
                      <span className="self-center text-xs text-faint">—</span>
                    )}
                  </div>
                  <span className="text-xs font-medium tabular-nums">{d ? formatDuration(d.minutes) : "sem registro"}</span>
                </motion.button>
              );
            })}
          </div>
          <div className="mt-4">
            <Legend items={[{ color: "var(--prog)", label: "programação" }, { color: "var(--eng)", label: "inglês" }]} />
          </div>
        </Card>

        <Card delay={0.08}>
          <div className="mb-4 font-medium">Esta semana</div>
          <div className="text-4xl font-semibold"><CountUp value={thisWeek} format={(n) => formatDuration(Math.round(n))} /></div>
          <p className="mt-1 text-sm text-muted">de segunda até hoje</p>
          <div className="mt-5 rounded-2xl bg-card-2 px-4 py-3 text-sm">
            Mesmo trecho da semana passada: <b className="tabular-nums">{formatDuration(lastWeek)}</b>
            {lastWeek > 0 && (
              <span className={thisWeek >= lastWeek ? "ml-2 text-emerald-700 dark:text-emerald-400" : "ml-2 text-red-700 dark:text-red-400"}>
                {thisWeek >= lastWeek ? "▲" : "▼"} {Math.abs(Math.round(((thisWeek - lastWeek) / lastWeek) * 100))}%
              </span>
            )}
          </div>
        </Card>
      </div>
    </Section>
  );
}

/* ================================================================= MÊS */

export function MonthTab({
  all,
  days,
  extras,
  summaries,
}: {
  all: Dashboard;
  days: DayLite[];
  extras: MonthExtra[];
  summaries: SummaryLite[];
}) {
  const today = all.today;
  const current = today.slice(0, 7);
  const firstYear = Math.min(Number(today.slice(0, 4)), ...days.map((d) => Number(d.date.slice(0, 4))), ...summaries.map((s) => Number(s.key.slice(0, 4))));
  const options: string[] = [];
  for (let k = `${firstYear}-01`; k <= current; k = addMonths(k, 1)) options.push(k);

  const [key, setKey] = useState(current);
  const [dir, setDir] = useState(0);
  const go = (to: string) => {
    if (to < options[0] || to > current) return;
    setDir(to > key ? 1 : -1);
    setKey(to);
  };

  const md = useMemo(
    () => buildDashboard(days.filter((d) => d.date.startsWith(key)), extras.filter((e) => e.key === key), today),
    [days, extras, key, today],
  );
  const card = all.months.find((m) => m.key === key) ?? null;
  const hasData = md.days.length > 0 || md.extras.length > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8">
      <section className="pt-12 md:pt-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button onClick={() => go(addMonths(key, -1))} disabled={key <= options[0]} className="rounded-full border border-border px-3 py-2 text-lg transition hover:border-accent disabled:opacity-30" aria-label="mês anterior">←</button>
            <button onClick={() => go(addMonths(key, 1))} disabled={key >= current} className="rounded-full border border-border px-3 py-2 text-lg transition hover:border-accent disabled:opacity-30" aria-label="próximo mês">→</button>
            <select
              value={key}
              onChange={(e) => go(e.target.value)}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm capitalize"
            >
              {[...options].reverse().map((k) => (
                <option key={k} value={k}>{monthName(k)}</option>
              ))}
            </select>
          </div>
          {key !== current && (
            <button onClick={() => go(current)} className="text-sm text-muted hover:text-foreground">voltar para o mês atual</button>
          )}
        </div>
      </section>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={key}
          initial={{ opacity: 0, x: dir * 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir * -50 }}
          transition={{ duration: 0.3, ease: EASE }}
        >
          <Section
            id="mes-resumo"
            eyebrow={key === current ? "Mês atual" : "Mês"}
            title={<span className="capitalize">{monthName(key)}</span>}
            subtitle={
              !hasData
                ? "Nenhum registro neste mês ainda. Dá para adicionar dias ou o total do mês lá embaixo."
                : card && card.loggedDays === 0
                  ? "Mês registrado só pelo total (resumo mensal), sem dias específicos."
                  : card && `${card.studiedDays} dias com estudo de ${card.loggedDays} registrados.`
            }
          >
            {hasData && card && <MonthStats md={md} card={card} today={today} />}
          </Section>
          {md.days.length > 0 && <MonthCharts md={md} monthKey={key} today={today} />}
          <PastMetrics monthKey={key} today={today} days={md.days} summary={summaries.find((s) => s.key === key) ?? null} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function MonthStats({ md, card, today }: { md: Dashboard; card: Dashboard["months"][number]; today: string }) {
  const { openDay } = useOverlays();
  const elapsed = card.key === today.slice(0, 7) ? Number(today.slice(8)) : card.daysInMonth;
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
      <Card className="col-span-2 flex items-center gap-6">
        <Ring value={elapsed ? card.studiedDays / elapsed : 0} size={116} stroke={11}>
          <div className="text-2xl font-semibold tabular-nums">{card.studiedDays}/{elapsed}</div>
        </Ring>
        <div className="text-sm text-muted">
          dias com estudo{card.key === today.slice(0, 7) ? " até hoje" : ""}
          {card.avgScore != null && <div className="mt-2">nota média <b className="text-foreground">{card.avgScore}</b></div>}
          {card.progDelta != null && (
            <div className={`mt-2 ${card.progDelta >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
              {card.progDelta >= 0 ? "▲" : "▼"} {Math.abs(card.progDelta)}% de código vs mês anterior
            </div>
          )}
        </div>
      </Card>
      {KEYS.map((k, i) => (
        <Card key={k} delay={0.05 * (i + 1)} className="md:col-span-1 lg:col-span-1">
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: HABITS[k].color }} />
            {HABITS[k].label}
          </div>
          <div className="mt-2 text-3xl font-semibold" style={{ color: HABITS[k].color }}>
            <CountUp value={md.habits[k].total} format={HABITS[k].unit === "pages" ? (n) => `${Math.round(n)}` : formatHours} />
          </div>
          <div className="text-xs text-muted">{md.habits[k].studiedDays} dias</div>
        </Card>
      ))}
      <Card delay={0.2} className="md:col-span-1">
        <div className="text-sm text-muted">🏅 melhor dia</div>
        {card.bestDay ? (
          <button onClick={() => openDay(card.bestDay!.date)} className="mt-2 text-left">
            <div className="text-3xl font-semibold">{formatDuration(card.bestDay.minutes)}</div>
            <div className="text-xs text-muted">{brDate(card.bestDay.date)} · abrir →</div>
          </button>
        ) : (
          <div className="mt-2 text-muted">—</div>
        )}
      </Card>
      {card.extra && (
        <div className="col-span-2 md:col-span-6">
          <ExtraNote extra={card.extra} />
        </div>
      )}
    </div>
  );
}

function MonthCharts({ md, monthKey, today }: { md: Dashboard; monthKey: string; today: string }) {
  const { openDay } = useOverlays();
  const byDate = new Map(md.days.map((d) => [d.date, d]));
  const n = Number(monthEnd(monthKey).slice(8));
  const isos = Array.from({ length: n }, (_, i) => `${monthKey}-${String(i + 1).padStart(2, "0")}`);
  const [y, m] = monthKey.split("-").map(Number);
  const offset = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const val = (iso: string, k: HabitKey) => {
    const d = byDate.get(iso);
    return d ? habitValue(d, k) : 0;
  };

  return (
    <Section id="mes-dias" eyebrow="Dia a dia" title="Cada dia do mês">
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <div className="grid grid-cols-7 gap-1.5">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((l, j) => (
              <span key={j} className="text-center text-[11px] text-faint">{l}</span>
            ))}
            {Array.from({ length: offset }, (_, j) => <span key={`o${j}`} />)}
            {isos.map((iso, j) => {
              const d = byDate.get(iso);
              const future = iso > today;
              const lvl = !d || !d.studied ? 0 : d.minutes >= 240 ? 100 : d.minutes >= 120 ? 75 : d.minutes >= 45 ? 50 : 28;
              return (
                <motion.button
                  key={iso}
                  disabled={!d}
                  onClick={() => openDay(iso)}
                  className={`flex aspect-square flex-col items-center justify-center rounded-xl text-xs tabular-nums transition hover:scale-110 disabled:hover:scale-100 ${future ? "opacity-30" : ""}`}
                  style={{
                    background: lvl ? `color-mix(in oklab, var(--accent) ${lvl}%, var(--empty))` : d ? "var(--empty)" : "transparent",
                    border: !d && !future ? "1px dashed var(--border)" : undefined,
                    color: lvl >= 75 ? "var(--accent-ink)" : "var(--muted)",
                  }}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: j * 0.012 }}
                >
                  <span className="font-medium">{j + 1}</span>
                  {d && d.minutes > 0 && <span className="hidden text-[9px] opacity-80 sm:block">{formatDuration(d.minutes)}</span>}
                </motion.button>
              );
            })}
          </div>
        </Card>
        <Card className="lg:col-span-3" delay={0.06}>
          <div className="mb-1 font-medium">Horas por dia</div>
          <div className="mb-5">
            <Legend items={[{ color: "var(--prog)", label: "programação" }, { color: "var(--eng)", label: "inglês" }]} />
          </div>
          <BarChart
            labels={isos.map((iso) => String(Number(iso.slice(8))))}
            series={[
              { key: "p", label: "programação", color: "var(--prog)", values: isos.map((iso) => val(iso, "programming")) },
              { key: "e", label: "inglês", color: "var(--eng)", values: isos.map((iso) => val(iso, "english")) },
            ]}
            format={(v) => formatDuration(Math.round(v))}
            tickFormat={tickHours}
            unit={60}
            values="peak"
            labelEvery={5}
            gapPct={1.2}
            height={200}
          />
          <div className="mt-8 mb-5 font-medium">Páginas por dia</div>
          <BarChart
            labels={isos.map((iso) => String(Number(iso.slice(8))))}
            series={[{ key: "r", label: "páginas", color: "var(--read)", values: isos.map((iso) => val(iso, "reading")) }]}
            format={(v) => `${Math.round(v)}`}
            unit={2}
            values="peak"
            labelEvery={5}
            gapPct={1.2}
            height={120}
          />
        </Card>
      </div>
      <Reveal className="mt-4">
        <ul className="space-y-2">
          {[...md.days].reverse().map((d) => (
            <li key={d.date}>
              <button
                onClick={() => openDay(d.date)}
                className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-card px-5 py-3 text-left transition hover:border-accent/50 hover:bg-card-2"
              >
                <span className="w-10 text-lg font-semibold tabular-nums">{d.date.slice(8)}</span>
                <span className="flex flex-wrap gap-x-3 text-xs text-muted">
                  {d.dayNumber != null && <span>Day {d.dayNumber}</span>}
                  {d.prog ? <span className="text-prog">● {formatDuration(d.prog)}</span> : null}
                  {d.eng ? <span className="text-eng">● {formatDuration(d.eng)}</span> : null}
                  {d.pages ? <span className="text-read">● {d.pages} pág.</span> : null}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{(d.learned || d.study || d.notes).split("\n")[0]}</span>
                <span className="text-muted transition group-hover:translate-x-1">→</span>
              </button>
            </li>
          ))}
        </ul>
      </Reveal>
    </Section>
  );
}

/* ------------------------------------------- métricas do passado */

function PastMetrics({ monthKey, today, days, summary }: { monthKey: string; today: string; days: DayLite[]; summary: SummaryLite | null }) {
  const [mode, setMode] = useState<"day" | "month">(days.length ? "day" : "month");
  const [dayState, dayAction, dayPending] = useActionState<NewDayState, FormData>(createDay, null);
  const [monthState, monthAction, monthPending] = useActionState<NewDayState, FormData>(createMonthSummary, null);
  const isCurrent = monthKey === today.slice(0, 7);
  const end = monthEnd(monthKey) < today ? monthEnd(monthKey) : today;
  const logged = {
    prog: days.reduce((a, d) => a + (d.prog ?? 0), 0),
    eng: days.reduce((a, d) => a + (d.eng ?? 0), 0),
    pages: days.reduce((a, d) => a + (d.pages ?? 0), 0),
  };
  const modes = [
    { k: "day" as const, label: "Um dia específico" },
    { k: "month" as const, label: "Total do mês inteiro" },
  ];

  return (
    <Section
      id="mes-passado"
      eyebrow="Adicionar ao passado"
      title="Completar o histórico"
      subtitle={`Registre um dia de ${monthName(monthKey)} que ficou de fora, ou só o total de horas do mês, quando você não tem os dias exatos. Nada existente é sobrescrito.`}
    >
      <Card>
        <div className="mb-6 inline-flex rounded-full bg-card-2 p-1">
          {modes.map((o) => (
            <button key={o.k} onClick={() => setMode(o.k)} className="relative rounded-full px-4 py-1.5 text-sm" style={{ color: mode === o.k ? "var(--accent-ink)" : "var(--muted)" }}>
              {mode === o.k && <motion.span layoutId="past-pill" className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
              <span className="relative">{o.label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {mode === "day" ? (
            <motion.form key="day" action={dayAction} className="max-w-xl space-y-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <DayFields defaultDate={isCurrent ? today : `${monthKey}-01`} min={`${monthKey}-01`} max={end} />
              <p className="text-xs text-muted">Dias antes do último registro entram como “registro retroativo”, sem número de Day, para não bagunçar a contagem.</p>
              <button disabled={dayPending} className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink disabled:opacity-50">
                {dayPending ? "Salvando…" : "Salvar dia"}
              </button>
              <Result state={dayState} />
            </motion.form>
          ) : (
            <motion.div key="month" className="max-w-xl" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {summary ? (
                <div className="space-y-2 text-sm">
                  <p>
                    <b>{monthName(monthKey)}</b> já tem um resumo mensal:
                  </p>
                  <p className="text-muted">
                    {formatDuration(summary.prog ?? 0)} de programação · {formatDuration(summary.eng ?? 0)} de inglês · {summary.pages ?? 0} páginas
                  </p>
                  <p className="font-mono text-xs text-faint">{summary.file}</p>
                  <p className="text-xs text-muted">Para corrigir, edite esse arquivo direto (o app nunca sobrescreve).</p>
                  <Result state={monthState} />
                </div>
              ) : (
                <form action={monthAction} className="space-y-4">
                  <input type="hidden" name="month" value={monthKey} />
                  <p className="text-sm text-muted">
                    Total de <b className="text-foreground capitalize">{monthName(monthKey)}</b>. Vale como o total do mês inteiro:
                    {days.length
                      ? ` os ${days.length} dias já registrados (${formatDuration(logged.prog)} de código, ${formatDuration(logged.eng)} de inglês, ${logged.pages} pág.) fazem parte dele, então só a diferença entra como “sem dia definido”.`
                      : " como não há dias registrados, tudo entra como “sem dia definido”."}
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { name: "programming", label: "Programação", ph: "20h", color: "var(--prog)" },
                      { name: "english", label: "Inglês", ph: "6h30", color: "var(--eng)" },
                      { name: "pages", label: "Páginas", ph: "120", color: "var(--read)" },
                    ].map((f) => (
                      <label key={f.name} className="block space-y-1.5">
                        <span className="flex items-center gap-1.5 text-sm text-muted">
                          <span className="h-2 w-2 rounded-full" style={{ background: f.color }} />
                          {f.label}
                        </span>
                        <input name={f.name} placeholder={f.ph} inputMode={f.name === "pages" ? "numeric" : "text"} className={input} />
                      </label>
                    ))}
                  </div>
                  <label className="block space-y-1.5">
                    <span className="text-sm text-muted">Notas (opcional)</span>
                    <textarea name="notes" rows={3} className={input} placeholder="Ex.: estudei pelo curso X, sem anotar os dias" />
                  </label>
                  <button disabled={monthPending} className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink disabled:opacity-50">
                    {monthPending ? "Salvando…" : "Salvar total do mês"}
                  </button>
                  <Result state={monthState} />
                </form>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </Section>
  );
}

function Result({ state }: { state: NewDayState }) {
  if (!state) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`text-sm ${state.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
    >
      {state.ok ? "✓ " : ""}
      {state.message} {state.file && <span className="font-mono text-xs text-muted">({state.file})</span>}
    </motion.p>
  );
}

/* ================================================================= ANO */

export function YearTab({ days, extras, today }: { days: DayLite[]; extras: MonthExtra[]; today: string }) {
  const years = [...new Set([...days.map((d) => d.date.slice(0, 4)), ...extras.map((e) => e.key.slice(0, 4))])].sort().reverse();
  const [year, setYear] = useState(years.includes(today.slice(0, 4)) ? today.slice(0, 4) : years[0]);
  const yd = useMemo(
    () => buildDashboard(days.filter((d) => d.date.startsWith(year)), extras.filter((e) => e.key.startsWith(year)), today),
    [days, extras, year, today],
  );
  const end = `${year}-12-31` < today ? `${year}-12-31` : today;
  const bestMonth = yd.months.length ? yd.months.reduce((b, m) => (m.prog + m.eng > b.prog + b.eng ? m : b)) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8">
      <Section
        id="ano-resumo"
        eyebrow="Ano"
        title={
          <span className="flex flex-wrap items-baseline gap-3">
            {years.length > 1 ? (
              <select value={year} onChange={(e) => setYear(e.target.value)} className="rounded-2xl border border-border bg-card px-3 py-1">
                {years.map((y) => <option key={y}>{y}</option>)}
              </select>
            ) : (
              year
            )}
            <span className="text-muted">em números</span>
          </span>
        }
        subtitle={bestMonth ? <>Melhor mês do ano: <b className="text-foreground capitalize">{monthName(bestMonth.key)}</b> ({formatHours(bestMonth.prog + bestMonth.eng)}).</> : undefined}
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { l: "horas de estudo", v: yd.overall.totalMinutes, f: formatHours, c: "var(--accent)" },
            { l: "programação", v: yd.habits.programming.total, f: formatHours, c: "var(--prog)" },
            { l: "inglês", v: yd.habits.english.total, f: formatHours, c: "var(--eng)" },
            { l: "páginas", v: yd.habits.reading.total, f: (n: number) => `${Math.round(n)}`, c: "var(--read)" },
            { l: "dias estudados", v: yd.overall.studiedDays, f: (n: number) => `${Math.round(n)}`, c: "var(--accent)" },
          ].map((s, i) => (
            <Card key={s.l} delay={i * 0.05}>
              <div className="text-3xl font-semibold md:text-4xl" style={{ color: s.c }}><CountUp value={s.v} format={s.f} /></div>
              <div className="text-sm text-muted">{s.l}</div>
            </Card>
          ))}
        </div>
      </Section>
      <AllDays data={yd} to={end} />
      <Overview data={yd} />
      <Months data={yd} />
    </div>
  );
}

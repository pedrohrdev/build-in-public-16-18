"use client";

// Seções do painel. Cada aba (Hoje, Mês, Ano, ...) monta as suas a partir daqui.

import { AnimatePresence, motion } from "motion/react";
import { useDeferredValue, useMemo, useRef, useState } from "react";
import type { Dashboard, DayLite, HabitKey, HabitStats, Report, SummaryLite } from "@/lib/dashboard";
import { brDate, formatDuration, formatHours, longDate, monthName } from "@/lib/format";
import { AreaChart, BarChart, Heatmap } from "./charts";
import { useOverlays } from "./overlays";
import { Card, CountUp, EASE, Legend, Reveal, Ring, Section } from "./ui";

export const HABITS: Record<
  HabitKey,
  { label: string; color: string; icon: string; unit: "min" | "pages"; thresholds: [number, number, number]; of: (d: DayLite) => number }
> = {
  programming: { label: "Programação", color: "var(--prog)", icon: "💻", unit: "min", thresholds: [30, 90, 180], of: (d) => d.prog ?? 0 },
  english: { label: "Inglês", color: "var(--eng)", icon: "🗣️", unit: "min", thresholds: [30, 60, 90], of: (d) => d.eng ?? 0 },
  reading: { label: "Leitura", color: "var(--read)", icon: "📖", unit: "pages", thresholds: [5, 15, 30], of: (d) => d.pages ?? 0 },
};

export const fmt = (k: HabitKey) => (v: number) => (HABITS[k].unit === "pages" ? `${Math.round(v)} pág.` : formatDuration(Math.round(v)));
export const tickHours = (v: number) => `${Math.round(v / 60)}h`;

/* ------------------------------------------------------------------ hero */

export function Hero({ data }: { data: Dashboard }) {
  const { overall } = data;
  const words = ["Construindo", "em", "público,", "dos", "16", "aos", "18."];
  return (
    <header className="relative flex min-h-[92vh] flex-col justify-center overflow-hidden px-4 md:px-8">
      {/* blobs animados de fundo */}
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
        {[
          { c: "var(--prog)", x: ["-10%", "15%", "-10%"], y: ["0%", "20%", "0%"], s: "46vw", top: "5%", left: "-5%" },
          { c: "var(--accent)", x: ["0%", "-15%", "0%"], y: ["10%", "-10%", "10%"], s: "40vw", top: "30%", left: "45%" },
          { c: "var(--eng)", x: ["0%", "10%", "0%"], y: ["0%", "-15%", "0%"], s: "30vw", top: "55%", left: "10%" },
        ].map((b, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full blur-[110px]"
            style={{ background: b.c, width: b.s, height: b.s, top: b.top, left: b.left, opacity: 0.28 }}
            animate={{ x: b.x, y: b.y }}
            transition={{ duration: 18 + i * 4, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>

      <div className="mx-auto w-full max-w-6xl">
        <motion.div
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted backdrop-blur"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          desde {brDate(data.firstDate)} · {overall.span} dias de jornada
        </motion.div>

        <h1 className="text-[18vw] leading-[0.85] font-semibold tracking-tighter md:text-[11rem]">
          <motion.span initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE }} className="inline-block">
            Day{" "}
          </motion.span>
          <span className="bg-gradient-to-br from-[var(--prog)] via-[var(--accent)] to-[var(--eng)] bg-clip-text text-transparent">
            <CountUp value={data.lastDayNumber ?? overall.loggedDays} duration={2} />
          </span>
        </h1>

        <p className="mt-6 max-w-xl text-xl text-muted md:text-2xl">
          {words.map((w, i) => (
            <motion.span
              key={i}
              className="mr-[0.3em] inline-block"
              initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: 0.4 + i * 0.07, duration: 0.5 }}
            >
              {w}
            </motion.span>
          ))}
        </p>

        <div className="mt-12 grid max-w-3xl grid-cols-3 gap-6">
          {[
            { v: overall.currentStreak, f: (n: number) => `${Math.round(n)}`, l: "dias seguidos", flame: true },
            { v: overall.totalMinutes, f: (n: number) => formatHours(n), l: "de estudo" },
            { v: overall.studiedDays, f: (n: number) => `${Math.round(n)}`, l: "dias estudados" },
          ].map((s, i) => (
            <motion.div key={s.l} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 + i * 0.12 }}>
              <div className="flex items-baseline gap-1 text-3xl font-semibold md:text-5xl">
                <CountUp value={s.v} format={s.f} />
                {s.flame && (
                  <motion.span
                    className="text-2xl md:text-4xl"
                    animate={{ scale: [1, 1.15, 1], rotate: [0, -6, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                  >
                    🔥
                  </motion.span>
                )}
              </div>
              <div className="mt-1 text-sm text-muted">{s.l}</div>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs text-faint"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 1.8, repeat: Infinity }}
      >
        role para ver tudo ↓
      </motion.div>
    </header>
  );
}

/* --------------------------------------------------------------- resumo */

export function Summary({ data }: { data: Dashboard }) {
  const { overall, habits } = data;
  const consistency = overall.span ? overall.studiedDays / overall.span : 0;
  return (
    <Section id="resumo" eyebrow="Resumo" title="Onde você está agora">
      <div className="grid gap-4 md:grid-cols-6">
        <Card className="flex items-center gap-6 md:col-span-3">
          <Ring value={consistency} size={132} stroke={12}>
            <div className="text-3xl font-semibold">
              <CountUp value={consistency * 100} format={(n) => `${Math.round(n)}%`} />
            </div>
          </Ring>
          <div>
            <div className="text-lg font-medium">Consistência</div>
            <p className="mt-1 text-sm text-muted">
              Estudou em <b className="text-foreground">{overall.studiedDays}</b> dos <b className="text-foreground">{overall.span}</b> dias desde o começo.
            </p>
          </div>
        </Card>
        <Card className="md:col-span-3" delay={0.08}>
          <div className="text-lg font-medium">Sequência</div>
          <div className="mt-4 space-y-4">
            {[
              { label: "atual", v: overall.currentStreak, color: "var(--accent)" },
              { label: "recorde", v: overall.bestStreak, color: "var(--faint)" },
            ].map((s) => (
              <div key={s.label}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="text-muted">{s.label}</span>
                  <span className="font-semibold tabular-nums">{s.v} dias</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[var(--empty)]">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: s.color }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${(s.v / Math.max(1, overall.bestStreak)) * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, ease: EASE }}
                  />
                </div>
              </div>
            ))}
          </div>
          {overall.bestStart && (
            <p className="mt-4 text-xs text-muted">
              Recorde de {brDate(overall.bestStart)} a {brDate(overall.bestEnd!)}.{" "}
              {overall.currentStreak >= overall.bestStreak
                ? "Você está no seu recorde agora! 🎉"
                : `Faltam ${overall.bestStreak - overall.currentStreak + 1} dias para bater.`}
            </p>
          )}
        </Card>
        {(Object.keys(HABITS) as HabitKey[]).map((k, i) => {
          const h = habits[k];
          const cfg = HABITS[k];
          const spark = h.monthly.map((m) => m.value);
          const smax = Math.max(1, ...spark);
          return (
            <Reveal key={k} delay={0.1 + i * 0.08} className="md:col-span-2">
              <motion.div
                whileHover={{ y: -4 }}
                className="group block rounded-3xl border border-border bg-card p-5 transition-shadow hover:shadow-[0_18px_50px_-20px_var(--glow)]"
              >
                <div className="flex items-center justify-between text-sm text-muted">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: cfg.color }} />
                    {cfg.label}
                  </span>
                </div>
                <div className="mt-3 text-4xl font-semibold">
                  <CountUp value={h.total} format={cfg.unit === "pages" ? (n) => `${Math.round(n)}` : formatHours} />
                  {cfg.unit === "pages" && <span className="ml-1 text-lg text-muted">pág.</span>}
                </div>
                <div className="mt-4 flex h-10 items-end gap-1">
                  {spark.map((v, j) => (
                    <motion.div
                      key={j}
                      className="flex-1 rounded-t-[3px]"
                      style={{ background: cfg.color, height: `${Math.max(4, (v / smax) * 100)}%`, transformOrigin: "bottom", opacity: 0.35 + 0.65 * (v / smax) }}
                      initial={{ scaleY: 0 }}
                      whileInView={{ scaleY: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + j * 0.05, duration: 0.6, ease: EASE }}
                    />
                  ))}
                </div>
                <div className="mt-1 text-[11px] text-faint">por mês</div>
              </motion.div>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------- todos os dias */

export function AllDays({ data, from, to }: { data: Dashboard; from?: string; to?: string }) {
  const { openDay } = useOverlays();
  const [filter, setFilter] = useState<"all" | HabitKey>("all");
  const opts: { k: "all" | HabitKey; label: string; color: string }[] = [
    { k: "all", label: "Geral", color: "var(--accent)" },
    ...(Object.keys(HABITS) as HabitKey[]).map((k) => ({ k, label: HABITS[k].label, color: HABITS[k].color })),
  ];
  const cur = opts.find((o) => o.k === filter)!;
  const cfg = filter === "all" ? null : HABITS[filter];

  return (
    <Section
      id="dias"
      eyebrow="Todos os dias"
      title="Cada quadrado é um dia"
      subtitle="Passe o mouse para ver os números, clique para abrir o dia completo."
    >
      <Card>
        <div className="mb-6 flex flex-wrap gap-2">
          {opts.map((o) => (
            <button
              key={o.k}
              onClick={() => setFilter(o.k)}
              className="relative rounded-full px-4 py-1.5 text-sm transition-colors"
              style={{ color: filter === o.k ? "var(--accent-ink)" : "var(--muted)" }}
            >
              {filter === o.k && (
                <motion.span layoutId="heat-pill" className="absolute inset-0 rounded-full" style={{ background: o.color }} transition={{ type: "spring", stiffness: 400, damping: 32 }} />
              )}
              <span className="relative">{o.label}</span>
            </button>
          ))}
        </div>
        <Heatmap
          key={filter}
          items={data.days}
          from={from ?? data.firstDate}
          to={to ?? data.today}
          color={cur.color}
          thresholds={cfg ? cfg.thresholds : [45, 120, 240]}
          value={cfg ? cfg.of : (d) => (d.studied ? Math.max(1, d.minutes) : 0)}
          onSelect={openDay}
          tip={(d, iso) => (
            <>
              <div className="mb-1 text-muted first-letter:uppercase">{longDate(iso)}</div>
              {!d ? (
                <div className="text-faint">sem registro</div>
              ) : (
                <>
                  <div className="font-semibold">Day {d.dayNumber ?? "?"}</div>
                  {d.prog != null && <div>💻 {formatDuration(d.prog)}</div>}
                  {d.eng != null && <div>🗣️ {formatDuration(d.eng)}</div>}
                  {d.pages != null && <div>📖 {d.pages} pág.</div>}
                  {!d.studied && <div className="text-faint">sem estudo</div>}
                </>
              )}
            </>
          )}
        />
      </Card>
    </Section>
  );
}

/* ------------------------------------------------------- visão geral */

export function Overview({ data }: { data: Dashboard }) {
  const { habits, weekday, months } = data;
  const bestWd = weekday.reduce((b, w) => (w.prog + w.eng > b.prog + b.eng ? w : b));
  const bestMonth = months.reduce((b, m) => (m.prog + m.eng > b.prog + b.eng ? m : b));
  return (
    <Section
      id="geral"
      eyebrow="Visão geral"
      title="O quadro completo"
      subtitle={
        <>
          Seu melhor mês foi <b className="text-foreground">{monthName(bestMonth.key)}</b> e o dia da semana mais forte é{" "}
          <b className="text-foreground">{bestWd.label}</b>.
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="mb-1 font-medium">Horas acumuladas</div>
          <div className="mb-5">
            <Legend items={[{ color: "var(--prog)", label: "programação", line: true }, { color: "var(--eng)", label: "inglês", line: true }]} />
          </div>
          <AreaChart
            dates={data.timeline}
            series={[
              { key: "p", label: "programação", color: "var(--prog)", values: habits.programming.cumulative.map((c) => c.value) },
              { key: "e", label: "inglês", color: "var(--eng)", values: habits.english.cumulative.map((c) => c.value) },
            ]}
            format={(v) => formatDuration(Math.round(v))}
            tickFormat={tickHours}
            unit={60}
            fill={false}
          />
        </Card>
        <Card className="lg:col-span-2" delay={0.08}>
          <div className="mb-1 font-medium">Horas por mês</div>
          <div className="mb-5">
            <Legend items={[{ color: "var(--prog)", label: "programação" }, { color: "var(--eng)", label: "inglês" }]} />
          </div>
          <BarChart
            labels={months.map((m) => m.label.slice(0, 3))}
            series={[
              { key: "p", label: "programação", color: "var(--prog)", values: months.map((m) => m.prog) },
              { key: "e", label: "inglês", color: "var(--eng)", values: months.map((m) => m.eng) },
            ]}
            format={(v) => formatDuration(Math.round(v))}
            tickFormat={tickHours}
            unit={60}
          />
        </Card>
        <Card className="lg:col-span-3">
          <div className="mb-1 font-medium">Média por dia da semana</div>
          <p className="mb-5 text-sm text-muted">Tempo médio de estudo em cada dia da semana (dias registrados).</p>
          <BarChart
            labels={weekday.map((w) => w.label)}
            series={[
              { key: "p", label: "programação", color: "var(--prog)", values: weekday.map((w) => w.prog) },
              { key: "e", label: "inglês", color: "var(--eng)", values: weekday.map((w) => w.eng) },
            ]}
            format={(v) => formatDuration(Math.round(v))}
            tickFormat={(v) => formatDuration(Math.round(v))}
            unit={30}
            height={180}
          />
        </Card>
        <Card className="lg:col-span-2" delay={0.08}>
          <div className="mb-1 font-medium">Dias com estudo, por dia da semana</div>
          <p className="mb-5 text-sm text-muted">De cada 100 segundas registradas, em quantas você estudou.</p>
          <div className="space-y-2.5">
            {weekday.map((w, i) => (
              <div key={w.label} className="grid grid-cols-[2.5rem_1fr_3rem] items-center gap-3 text-sm">
                <span className="text-muted">{w.label}</span>
                <div className="h-2.5 overflow-hidden rounded-full bg-[var(--empty)]">
                  <motion.div
                    className="h-full rounded-full bg-accent"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${w.studiedPct}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, delay: i * 0.06, ease: EASE }}
                  />
                </div>
                <span className="text-right tabular-nums">{w.studiedPct}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------- cada hábito */

export function HabitSection({ k, stats, data }: { k: HabitKey; stats: HabitStats; data: Dashboard }) {
  const extraNote = stats.extra > 0 ? `inclui ${fmt(k)(stats.extra)} de resumos mensais` : null;
  const cfg = HABITS[k];
  const f = fmt(k);
  const { openDay } = useOverlays();
  const titles: Record<HabitKey, string> = {
    programming: "Horas de código",
    english: "Inglês, dia após dia",
    reading: "Páginas viradas",
  };

  return (
    <Section id={k} eyebrow={cfg.label} color={cfg.color} title={titles[k]}>
      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="flex flex-col justify-between lg:row-span-2">
          <div>
            <div className="text-sm text-muted">total</div>
            <div className="text-5xl font-semibold tracking-tight md:text-6xl" style={{ color: cfg.color }}>
              <CountUp value={stats.total} format={cfg.unit === "pages" ? (n) => `${Math.round(n)}` : formatHours} />
            </div>
            <div className="text-sm text-muted">{cfg.unit === "pages" ? "páginas lidas" : "de estudo registrado"}</div>
            {extraNote && <div className="mt-1 text-xs text-faint">{extraNote}</div>}
          </div>
          <dl className="mt-8 space-y-4 text-sm">
            {[
              { l: "dias praticando", v: `${stats.studiedDays}` },
              { l: "média por dia praticado", v: f(stats.avgPerStudiedDay) },
              { l: "sequência atual", v: `${stats.currentStreak} dias` },
              { l: "maior sequência", v: `${stats.bestStreak} dias` },
            ].map((s) => (
              <div key={s.l} className="flex items-baseline justify-between gap-2 border-b border-border pb-2">
                <dt className="text-muted">{s.l}</dt>
                <dd className="font-semibold tabular-nums">{s.v}</dd>
              </div>
            ))}
          </dl>
          {stats.best && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => openDay(stats.best!.date)}
              className="mt-6 rounded-2xl border border-border bg-card-2 p-4 text-left"
            >
              <div className="text-xs text-muted">🏅 melhor dia</div>
              <div className="mt-1 text-xl font-semibold">{f(stats.best.value)}</div>
              <div className="text-xs text-muted">{brDate(stats.best.date)} · abrir →</div>
            </motion.button>
          )}
        </Card>
        <Card className="lg:col-span-3" delay={0.06}>
          <div className="mb-5 font-medium">Acumulado</div>
          <AreaChart
            dates={stats.cumulative.map((c) => c.date)}
            series={[{ key: k, label: cfg.label.toLowerCase(), color: cfg.color, values: stats.cumulative.map((c) => c.value) }]}
            format={cfg.unit === "pages" ? (v) => `${Math.round(v)} pág.` : (v) => formatDuration(Math.round(v))}
            tickFormat={cfg.unit === "pages" ? (v) => `${Math.round(v)}` : tickHours}
            unit={cfg.unit === "pages" ? 1 : 60}
            height={220}
          />
        </Card>
        <Card className="lg:col-span-1" delay={0.1}>
          <div className="mb-5 font-medium">Por mês</div>
          <BarChart
            labels={stats.monthly.map((m) => m.label.slice(0, 3))}
            series={[{ key: k, label: cfg.label.toLowerCase(), color: cfg.color, values: stats.monthly.map((m) => m.value) }]}
            format={cfg.unit === "pages" ? (v) => `${Math.round(v)}` : (v) => formatHours(v)}
            unit={cfg.unit === "pages" ? 1 : 60}
            height={180}
          />
        </Card>
        <Card className="lg:col-span-2" delay={0.14}>
          <div className="mb-5 font-medium">Dias de {cfg.label.toLowerCase()}</div>
          <Heatmap
            items={data.days}
            from={data.firstDate}
            to={data.today}
            color={cfg.color}
            thresholds={cfg.thresholds}
            value={cfg.of}
            onSelect={openDay}
            tip={(d, iso) => (
              <>
                <div className="text-muted">{brDate(iso)}</div>
                <div className="font-semibold">{d ? (cfg.of(d) ? f(cfg.of(d)) : "—") : "sem registro"}</div>
              </>
            )}
          />
        </Card>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------ meses */

export function Months({ data }: { data: Dashboard }) {
  const { openDay } = useOverlays();
  const byDate = useMemo(() => new Map(data.days.map((d) => [d.date, d])), [data.days]);
  const months = [...data.months].reverse();
  // Setas para navegar no carrossel (no computador não dá para arrastar com a roda do mouse)
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const updateEdges = () => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
  };
  const slide = (dir: 1 | -1) => {
    const el = scroller.current;
    const card = el?.querySelector("article");
    if (el && card) el.scrollBy({ left: dir * (card.getBoundingClientRect().width + 16), behavior: "smooth" });
  };
  const arrow = "rounded-full border border-border bg-card px-3 py-2 text-lg transition hover:border-accent disabled:opacity-30";

  return (
    <Section
      id="meses"
      eyebrow="Mês a mês"
      title="Cada mês, um capítulo"
      subtitle={
        <span className="flex flex-wrap items-center justify-between gap-3">
          <span>Use as setas ou arraste para o lado para ver os {months.length} meses.</span>
          <span className="flex gap-2">
            <button onClick={() => slide(-1)} disabled={edges.start} className={arrow} aria-label="meses mais recentes">←</button>
            <button onClick={() => slide(1)} disabled={edges.end} className={arrow} aria-label="meses anteriores">→</button>
          </span>
        </span>
      }
    >
      <div className="relative -mx-4 md:-mx-8">
      <div className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background to-transparent transition-opacity ${edges.start ? "opacity-0" : "opacity-100"}`} />
      <div className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent transition-opacity ${edges.end ? "opacity-0" : "opacity-100"}`} />
      <div ref={scroller} onScroll={updateEdges} className="no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 md:scroll-px-8 md:px-8">
        {months.map((m, i) => {
          const [y, mo] = m.key.split("-").map(Number);
          const offset = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay();
          return (
            <motion.article
              key={m.key}
              className="w-[85vw] max-w-sm shrink-0 snap-start rounded-3xl border border-border bg-card p-6"
              initial={{ opacity: 0, x: 60 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: EASE }}
            >
              <div className="flex items-start justify-between">
                <h3 className="text-2xl font-semibold capitalize">{monthName(m.key)}</h3>
                {m.progDelta != null && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.progDelta >= 0 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-red-500/15 text-red-700 dark:text-red-400"}`}
                    title="programação vs mês anterior"
                  >
                    {m.progDelta >= 0 ? "▲" : "▼"} {Math.abs(m.progDelta)}%
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted">
                {m.studiedDays} de {m.daysInMonth} dias com estudo
                {m.avgScore != null && ` · nota média ${m.avgScore}`}
              </p>
              <div className="mt-5 grid grid-cols-7 gap-1.5">
                {["D", "S", "T", "Q", "Q", "S", "S"].map((l, j) => (
                  <span key={j} className="text-center text-[10px] text-faint">{l}</span>
                ))}
                {Array.from({ length: offset }, (_, j) => <span key={`o${j}`} />)}
                {Array.from({ length: m.daysInMonth }, (_, j) => {
                  const iso = `${m.key}-${String(j + 1).padStart(2, "0")}`;
                  const d = byDate.get(iso);
                  const future = iso > data.today;
                  const lvl = !d || !d.studied ? 0 : d.minutes >= 240 ? 100 : d.minutes >= 120 ? 75 : d.minutes >= 45 ? 50 : 28;
                  return (
                    <button
                      key={iso}
                      disabled={!d}
                      onClick={() => openDay(iso)}
                      title={d ? `${brDate(iso)} · ${formatDuration(d.minutes)}` : brDate(iso)}
                      className={`aspect-square rounded-lg text-[10px] tabular-nums transition hover:scale-110 disabled:hover:scale-100 ${future ? "opacity-30" : ""}`}
                      style={{
                        background: lvl ? `color-mix(in oklab, var(--accent) ${lvl}%, var(--empty))` : d ? "var(--empty)" : "transparent",
                        border: !d && !future ? "1px dashed var(--border)" : undefined,
                        color: lvl >= 75 ? "var(--accent-ink)" : "var(--muted)",
                      }}
                    >
                      {j + 1}
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 grid grid-cols-3 gap-2 text-center">
                {[
                  { v: formatHours(m.prog), l: "código", c: "var(--prog)" },
                  { v: formatHours(m.eng), l: "inglês", c: "var(--eng)" },
                  { v: `${m.pages}`, l: "páginas", c: "var(--read)" },
                ].map((s) => (
                  <div key={s.l} className="rounded-2xl bg-card-2 py-3">
                    <div className="text-lg font-semibold tabular-nums">{s.v}</div>
                    <div className="flex items-center justify-center gap-1 text-[11px] text-muted">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.c }} />
                      {s.l}
                    </div>
                  </div>
                ))}
              </div>
              {m.extra && <ExtraNote extra={m.extra} />}
              {m.bestDay && (
                <button onClick={() => openDay(m.bestDay!.date)} className="mt-4 w-full text-left text-xs text-muted hover:text-foreground">
                  🏅 melhor dia: {brDate(m.bestDay.date)} ({formatDuration(m.bestDay.minutes)}) →
                </button>
              )}
            </motion.article>
          );
        })}
      </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------- conquistas */

export function Achievements({ data }: { data: Dashboard }) {
  const unlocked = data.achievements.filter((a) => a.unlockedAt).length;
  return (
    <Section
      id="conquistas"
      eyebrow="Conquistas"
      title={
        <>
          <CountUp value={unlocked} /> de {data.achievements.length} desbloqueadas
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {data.achievements.map((a, i) => {
          const done = !!a.unlockedAt;
          return (
            <motion.div
              key={a.id}
              className={`relative overflow-hidden rounded-3xl border p-5 ${done ? "border-accent/40 bg-card" : "border-border bg-card/50"}`}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true }}
              whileHover={{ y: -4, rotate: done ? -1 : 0 }}
              transition={{ duration: 0.5, delay: (i % 4) * 0.06, ease: EASE }}
              style={done ? { boxShadow: "0 12px 40px -18px var(--glow)" } : undefined}
            >
              <div className={`text-4xl ${done ? "" : "opacity-40 grayscale"}`}>{a.icon}</div>
              <div className="mt-3 font-medium">{a.title}</div>
              <div className="text-xs text-muted">{a.desc}</div>
              {done ? (
                <div className="mt-3 text-xs font-medium text-accent">✓ {brDate(a.unlockedAt!)}</div>
              ) : (
                <div className="mt-3">
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--empty)]">
                    <motion.div
                      className="h-full rounded-full bg-accent"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(a.current / a.target) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, ease: EASE }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-faint tabular-nums">{Math.round((a.current / a.target) * 100)}%</div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}

/* ----------------------------------------------------------- diário */

export function Journal({ data }: { data: Dashboard }) {
  const { openDay } = useOverlays();
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(12);
  const query = useDeferredValue(q.trim().toLowerCase());
  const list = useMemo(
    () => [...data.days].reverse().filter((d) => !query || d.raw.toLowerCase().includes(query)),
    [data.days, query],
  );

  return (
    <Section id="diario" eyebrow="Diário" title="Tudo que você escreveu" subtitle="Busque qualquer palavra em todos os dias — “typescript”, “git”, “ufc”…">
      <Reveal>
        <input
          value={q}
          onChange={(e) => (setQ(e.target.value), setLimit(12))}
          placeholder="Buscar nos registros…"
          className="mb-6 w-full rounded-2xl border border-border bg-card px-5 py-4 text-lg outline-none transition focus:border-accent focus:ring-4 focus:ring-[var(--glow)]"
        />
      </Reveal>
      {query && <p className="mb-4 text-sm text-muted">{list.length} dias encontrados</p>}
      <motion.ul layout className="space-y-2">
        <AnimatePresence initial={false}>
          {list.slice(0, limit).map((d) => {
            const text = (d.learned || d.study || d.notes).split("\n")[0];
            return (
              <motion.li
                key={d.date}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25 }}
              >
                <button
                  onClick={() => openDay(d.date)}
                  className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 text-left transition hover:border-accent/50 hover:bg-card-2"
                >
                  <div className="w-14 shrink-0 text-center">
                    <div className="text-xl font-semibold tabular-nums">{d.date.slice(8)}</div>
                    <div className="text-[11px] text-muted uppercase">{monthName(d.date.slice(0, 7)).slice(0, 3)}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted">
                      <span>Day {d.dayNumber ?? "?"}</span>
                      {d.prog ? <span className="text-prog">● {formatDuration(d.prog)}</span> : null}
                      {d.eng ? <span className="text-eng">● {formatDuration(d.eng)}</span> : null}
                      {d.pages ? <span className="text-read">● {d.pages} pág.</span> : null}
                    </div>
                    <div className="mt-0.5 truncate">{text || <span className="text-faint">sem anotações neste dia</span>}</div>
                  </div>
                  <span className="text-muted transition group-hover:translate-x-1">→</span>
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </motion.ul>
      {list.length > limit && (
        <div className="mt-6 text-center">
          <button onClick={() => setLimit((l) => l + 24)} className="rounded-full border border-border px-5 py-2 text-sm text-muted transition hover:border-accent hover:text-foreground">
            mostrar mais ({list.length - limit} restantes)
          </button>
        </div>
      )}
    </Section>
  );
}

/* -------------------------------------------------------- bastidores */

export function Backstage({ data, report: r, summaries }: { data: Dashboard; report: Report; summaries: SummaryLite[] }) {
  return (
    <Section id="bastidores" eyebrow="Bastidores" title="Nada ficou para trás" subtitle={`Lido direto de ${r.root}. Os arquivos originais nunca são alterados.`}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { l: "arquivos lidos", v: r.files },
          { l: "dias gerados", v: data.overall.loggedDays },
          { l: "datas duplicadas", v: r.duplicates.length },
          { l: "dias sem arquivo", v: r.missing.length },
        ].map((s, i) => (
          <Card key={s.l} delay={i * 0.05}>
            <div className="text-3xl font-semibold"><CountUp value={s.v} /></div>
            <div className="text-sm text-muted">{s.l}</div>
          </Card>
        ))}
      </div>
      <Reveal className="mt-4">
        <details className="group rounded-3xl border border-border bg-card">
          <summary className="cursor-pointer list-none p-5 text-sm">
            <span className="mr-2 inline-block transition group-open:rotate-90">›</span>
            {r.warnings.length} arquivos com avisos · {r.missing.length} dias sem arquivo · {r.ignored.length} outros .md
          </summary>
          <div className="space-y-4 border-t border-border p-5 text-sm">
            <p className="text-muted">Dias sem arquivo: {r.missing.map(brDate).join(", ") || "nenhum"}</p>
            <p className="text-muted">Outros .md (não são registros diários): {r.ignored.join(", ")}</p>
            <p className="text-muted">
              Resumos mensais (retroativos): {summaries.length ? summaries.map((x) => x.file).join(", ") : "nenhum"}
            </p>
            <ul className="divide-y divide-border">
              {r.warnings.map((w) => (
                <li key={w.file} className="py-2">
                  <span className="font-mono text-xs">{w.file}</span>
                  {w.warnings.map((x) => (
                    <div key={x} className="text-amber-700 dark:text-amber-400">⚠ {x}</div>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        </details>
      </Reveal>
    </Section>
  );
}

/* -------------------------------------------------- botão flutuante */

export function Fab({ logged }: { logged: boolean }) {
  const { openNew } = useOverlays();
  return (
    <motion.button
      onClick={openNew}
      className="fixed right-5 bottom-5 z-30 flex items-center gap-2 rounded-full bg-accent px-5 py-3.5 text-sm font-medium text-accent-ink shadow-[0_12px_40px_-8px_var(--glow)]"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ delay: 1.4, type: "spring", stiffness: 300, damping: 20 }}
    >
      {!logged && (
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent-ink)] opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--accent-ink)]" />
        </span>
      )}
      {logged ? "+ Registrar dia" : "Registrar hoje"}
    </motion.button>
  );
}

/* ------------------------------------------- aviso de resumo mensal */

export function ExtraNote({ extra }: { extra: NonNullable<Dashboard["months"][number]["extra"]> }) {
  const parts = [
    extra.prog ? `${formatDuration(extra.prog)} de código` : null,
    extra.eng ? `${formatDuration(extra.eng)} de inglês` : null,
    extra.pages ? `${extra.pages} pág.` : null,
  ].filter(Boolean);
  return (
    <p className="mt-4 rounded-xl bg-card-2 px-3 py-2 text-xs text-muted" title={extra.summary.file}>
      🗂️ resumo mensal{parts.length ? `: ${parts.join(" · ")} sem dia definido` : " (já coberto pelos dias registrados)"}
    </p>
  );
}

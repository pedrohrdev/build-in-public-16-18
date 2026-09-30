"use client";

import { motion } from "motion/react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { brDate } from "@/lib/format";
import { EASE, Tooltip, TipRow, useSize, type TipState } from "./ui";

function niceMax(v: number, unit = 1): number {
  if (unit !== 1) return niceMax(v / unit) * unit;
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * exp >= v) return m * exp;
  return 10 * exp;
}

export type Series = { key: string; label: string; color: string; values: number[] };

/* ---------------------------------------------------------------- barras */

export function BarChart({
  labels,
  series,
  format,
  height = 220,
  tickFormat,
  unit = 1,
  values = "all",
  labelEvery = 1,
  gapPct = 6,
}: {
  labels: string[];
  series: Series[];
  format: (v: number) => string;
  tickFormat?: (v: number) => string;
  height?: number;
  unit?: number;
  values?: "all" | "peak"; // rótulo direto em todas as barras ou só na maior
  labelEvery?: number; // mostra 1 a cada N rótulos do eixo
  gapPct?: number;
}) {
  const [ref, width] = useSize<HTMLDivElement>();
  const [tip, setTip] = useState<TipState>(null);
  const [hover, setHover] = useState<number | null>(null);
  const totals = labels.map((_, i) => series.reduce((a, s) => a + s.values[i], 0));
  const max = niceMax(Math.max(...totals), unit * 2);
  const ticks = [0, max / 2, max];
  const peak = totals.indexOf(Math.max(...totals));

  return (
    <div ref={ref} className="relative select-none" onPointerLeave={() => (setTip(null), setHover(null))}>
      <div className="relative ml-10" style={{ height }}>
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 border-t border-[var(--grid)]" style={{ bottom: `${(t / max) * 100}%` }}>
            <span className="absolute -left-10 -translate-y-1/2 text-[10px] text-faint tabular-nums">
              {(tickFormat ?? format)(t)}
            </span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end px-1" style={{ gap: `${gapPct}%` }}>
          {labels.map((label, i) => (
            <div
              key={label}
              className="relative flex h-full flex-1 cursor-default flex-col justify-end"
              onPointerMove={(e) => {
                const box = ref.current!.getBoundingClientRect();
                setHover(i);
                setTip({
                  x: e.clientX - box.left,
                  y: e.clientY - box.top,
                  content: (
                    <>
                      <div className="mb-1 text-muted">{label}</div>
                      {series.map((s) => (
                        <TipRow key={s.key} color={s.color} label={s.label} value={format(s.values[i])} />
                      ))}
                      {series.length > 1 && <div className="mt-1 border-t border-border pt-1 font-semibold">{format(totals[i])} no total</div>}
                    </>
                  ),
                });
              }}
            >
              {/* rótulo direto: só o total do topo */}
              <motion.span
                className={`absolute inset-x-0 text-center text-[11px] tabular-nums ${i === peak ? "font-semibold text-foreground" : "text-muted"}`}
                style={{ bottom: `calc(${(totals[i] / max) * 100}% + 4px)` }}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6 + Math.min(i, 12) * 0.06 }}
              >
                {totals[i] > 0 && (values === "all" || i === peak) ? format(totals[i]) : ""}
              </motion.span>
              <motion.div
                className="flex w-full flex-col-reverse gap-[2px] overflow-hidden rounded-t-[4px]"
                style={{ height: `${(totals[i] / max) * 100}%`, transformOrigin: "bottom" }}
                initial={{ scaleY: 0 }}
                whileInView={{ scaleY: 1 }}
                viewport={{ once: true, margin: "0px 0px -40px 0px" }}
                transition={{ duration: 0.9, delay: Math.min(i * 0.06, 0.02 * i + 0.2), ease: EASE }}
              >
                {series.map((s) =>
                  s.values[i] > 0 ? (
                    <div
                      key={s.key}
                      className="w-full transition-[filter] duration-200"
                      style={{
                        flexGrow: s.values[i],
                        flexBasis: 0,
                        background: s.color,
                        filter: hover === i ? "brightness(1.15)" : hover != null ? "saturate(0.6) opacity(0.6)" : undefined,
                      }}
                    />
                  ) : null,
                )}
              </motion.div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 ml-10 flex px-1" style={{ gap: `${gapPct}%` }}>
        {labels.map((l, i) => (
          <span key={l} className="flex-1 overflow-visible text-center text-[11px] whitespace-nowrap text-muted">
            {i % labelEvery === 0 ? l : ""}
          </span>
        ))}
      </div>
      <Tooltip tip={tip} containerWidth={width} />
    </div>
  );
}

/* ------------------------------------------------------ área / acumulado */

export function AreaChart({
  dates,
  series,
  format,
  height = 240,
  fill = true,
  tickFormat,
  unit = 1,
}: {
  dates: string[];
  series: Series[];
  format: (v: number) => string;
  tickFormat?: (v: number) => string;
  height?: number;
  fill?: boolean;
  unit?: number;
}) {
  const [ref, width] = useSize<HTMLDivElement>();
  const [idx, setIdx] = useState<number | null>(null);
  const padL = 44;
  const padB = 22;
  const padT = 10;
  const w = Math.max(0, width - padL - 8);
  const h = height - padB - padT;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)), unit * 4) ;
  const x = (i: number) => padL + (dates.length > 1 ? (i / (dates.length - 1)) * w : 0);
  const y = (v: number) => padT + h - (v / max) * h;

  const paths = useMemo(
    () =>
      series.map((s) => {
        const line = s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
        return { ...s, line, area: `${line}L${x(s.values.length - 1)},${padT + h}L${x(0)},${padT + h}Z` };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, width, height],
  );

  // Um rótulo por mês, pulando os que ficariam colados no anterior
  const monthTicks = dates
    .map((d, i) => ({ d, i }))
    .filter(({ d }, k) => k === 0 || d.slice(0, 7) !== dates[k - 1].slice(0, 7))
    .reduce<{ d: string; i: number }[]>((acc, t) => {
      const prev = acc[acc.length - 1];
      return !prev || x(t.i) - x(prev.i) >= 28 ? [...acc, t] : acc;
    }, []);
  const MON = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

  return (
    <div ref={ref} className="relative select-none" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          className="overflow-visible"
          onPointerMove={(e) => {
            const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const px = e.clientX - box.left - padL;
            setIdx(Math.max(0, Math.min(dates.length - 1, Math.round((px / w) * (dates.length - 1)))));
          }}
          onPointerLeave={() => setIdx(null)}
        >
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`g-${s.key}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line x1={padL} x2={padL + w} y1={y(max * t)} y2={y(max * t)} stroke="var(--grid)" />
              <text x={padL - 8} y={y(max * t)} dy="0.32em" textAnchor="end" fontSize={10} fill="var(--faint)">
                {(tickFormat ?? format)(max * t)}
              </text>
            </g>
          ))}
          {monthTicks.map(({ d, i }) => (
            <text key={d} x={x(i)} y={height - 4} fontSize={10} fill="var(--muted)">
              {MON[Number(d.slice(5, 7)) - 1]}
            </text>
          ))}
          {paths.map((p) => (
            <g key={p.key}>
              {fill && (
                <motion.path
                  d={p.area}
                  fill={`url(#g-${p.key})`}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.2, delay: 0.8 }}
                />
              )}
              <motion.path
                d={p.line}
                fill="none"
                stroke={p.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.8, ease: EASE }}
              />
              {/* rótulo direto no fim da linha */}
              <motion.text
                x={x(p.values.length - 1) - 4}
                y={y(p.values[p.values.length - 1]) - 10}
                textAnchor="end"
                fontSize={12}
                fontWeight={600}
                fill="var(--foreground)"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 1.6 }}
              >
                {format(p.values[p.values.length - 1])}
              </motion.text>
            </g>
          ))}
          {idx != null && (
            <g pointerEvents="none">
              <line x1={x(idx)} x2={x(idx)} y1={padT} y2={padT + h} stroke="var(--muted)" strokeDasharray="3 3" />
              {series.map((s) => (
                <circle key={s.key} cx={x(idx)} cy={y(s.values[idx])} r={5} fill={s.color} stroke="var(--card)" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
      )}
      {idx != null && (
        <Tooltip
          containerWidth={width}
          tip={{
            x: x(idx),
            y: Math.min(...series.map((s) => y(s.values[idx]))),
            content: (
              <>
                <div className="mb-1 text-muted">{brDate(dates[idx])}</div>
                {series.map((s) => (
                  <TipRow key={s.key} color={s.color} label={s.label} value={format(s.values[idx])} />
                ))}
              </>
            ),
          }}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------- heatmap */

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function Heatmap<T extends { date: string }>({
  items,
  from,
  to,
  color,
  value,
  tip,
  onSelect,
  thresholds,
}: {
  items: T[];
  from: string;
  to: string;
  color: string;
  value: (d: T) => number;
  tip: (d: T | undefined, date: string) => ReactNode;
  onSelect?: (date: string) => void;
  thresholds: [number, number, number]; // limites para os níveis 2, 3 e 4
}) {
  const [ref, width] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<TipState>(null);
  const byDate = useMemo(() => new Map(items.map((d) => [d.date, d])), [items]);
  // Em telas estreitas a grade rola para o lado; começa mostrando os dias mais recentes
  const scroller = useCallback((el: HTMLDivElement | null) => {
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  const start = addDays(from, -new Date(from + "T00:00:00Z").getUTCDay());
  const weeks: string[][] = [];
  for (let s = start; s <= to; s = addDays(s, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(s, i)));

  const gap = 3;
  const labelW = 26;
  const cell = Math.max(11, Math.min(30, Math.floor((width - labelW - gap * weeks.length) / Math.max(1, weeks.length))));
  const level = (v: number) => (v <= 0 ? 0 : v < thresholds[0] ? 1 : v < thresholds[1] ? 2 : v < thresholds[2] ? 3 : 4);
  const mix = [0, 30, 55, 80, 100];
  const bg = (l: number) => (l === 0 ? "var(--empty)" : `color-mix(in oklab, ${color} ${mix[l]}%, var(--empty))`);
  const MON = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

  return (
    <div ref={ref} className="relative" onPointerLeave={() => setHover(null)}>
      {width > 0 && (
        <div ref={scroller} className="no-scrollbar overflow-x-auto overflow-y-visible py-1">
        <div className="flex w-max" style={{ gap }}>
          <div className="sticky left-0 z-10 flex flex-col bg-card text-[10px] text-faint" style={{ width: labelW - gap, gap, paddingTop: 16 }}>
            {["", "seg", "", "qua", "", "sex", ""].map((l, i) => (
              <span key={i} style={{ height: cell, lineHeight: `${cell}px` }}>{l}</span>
            ))}
          </div>
          {weeks.map((week, wi) => {
            const first = week.find((d) => d.endsWith("-01") && d >= from && d <= to);
            return (
              <div key={week[0]} className="flex flex-col" style={{ gap }}>
                <span className="h-[13px] overflow-visible text-[10px] whitespace-nowrap text-muted">
                  {first ? MON[Number(first.slice(5, 7)) - 1] : wi === 0 ? MON[Number(from.slice(5, 7)) - 1] : ""}
                </span>
                {week.map((iso) => {
                  if (iso < from || iso > to) return <span key={iso} style={{ width: cell, height: cell }} />;
                  const d = byDate.get(iso);
                  const l = d ? level(value(d)) : -1;
                  return (
                    <motion.button
                      key={iso}
                      type="button"
                      aria-label={iso}
                      onClick={() => d && onSelect?.(iso)}
                      onPointerEnter={(e) => {
                        const box = ref.current!.getBoundingClientRect();
                        const c = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setHover({ x: c.left - box.left + c.width / 2, y: c.top - box.top, content: tip(d, iso) });
                      }}
                      className={`rounded-[4px] outline-offset-2 transition-transform hover:z-10 hover:scale-125 ${d ? "cursor-pointer" : "cursor-default"}`}
                      style={{
                        width: cell,
                        height: cell,
                        background: l < 0 ? "transparent" : bg(l),
                        border: l < 0 ? "1px dashed var(--border)" : undefined,
                        boxShadow: l === 4 ? `0 0 10px color-mix(in oklab, ${color} 45%, transparent)` : undefined,
                      }}
                      initial={{ opacity: 0, scale: 0.3 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.35, delay: wi * 0.025, ease: EASE }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-muted">
        menos
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className="h-3 w-3 rounded-[3px]" style={{ background: bg(l) }} />
        ))}
        mais
        <span className="ml-3 h-3 w-3 rounded-[3px] border border-dashed border-border" /> sem registro
      </div>
      <Tooltip tip={hover} containerWidth={width} />
    </div>
  );
}

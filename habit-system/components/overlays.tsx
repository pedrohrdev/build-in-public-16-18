"use client";

import { AnimatePresence, motion } from "motion/react";
import { createContext, useActionState, useContext, useEffect, useState, type ReactNode } from "react";
import { createDay, type NewDayState } from "@/app/actions";
import type { DayLite } from "@/lib/dashboard";
import { brDate, formatDuration, longDate } from "@/lib/format";
import { DayCommits } from "./commits";
import { EASE } from "./ui";

/* ------------------------------------------------------------ contexto */

type Ctx = { openDay: (date: string) => void; openNew: () => void };
const OverlayCtx = createContext<Ctx>({ openDay: () => {}, openNew: () => {} });
export const useOverlays = () => useContext(OverlayCtx);

export function OverlayProvider({ days, today, children }: { days: DayLite[]; today: string; children: ReactNode }) {
  const [date, setDate] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const open = date || newOpen;

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  return (
    <OverlayCtx.Provider value={{ openDay: setDate, openNew: () => setNewOpen(true) }}>
      {children}
      <AnimatePresence>
        {date && <DayModal key="day" days={days} date={date} onChange={setDate} onClose={() => setDate(null)} />}
        {newOpen && <NewDayDrawer key="new" today={today} onClose={() => setNewOpen(false)} />}
      </AnimatePresence>
    </OverlayCtx.Provider>
  );
}

function Backdrop({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    />
  );
}

/* ------------------------------------------------------------- dia */

function DayModal({
  days,
  date,
  onChange,
  onClose,
}: {
  days: DayLite[];
  date: string;
  onChange: (d: string) => void;
  onClose: () => void;
}) {
  const i = days.findIndex((d) => d.date === date);
  const d = days[i];
  const prev = days[i - 1];
  const next = days[i + 1];
  const [dir, setDir] = useState(0);
  const go = (to: DayLite | undefined, step: number) => {
    if (!to) return;
    setDir(step);
    onChange(to.date);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(prev, -1);
      if (e.key === "ArrowRight") go(next, 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!d) return null;
  const chips = [
    { label: "programação", value: d.prog != null ? formatDuration(d.prog) : null, color: "var(--prog)" },
    { label: "inglês", value: d.eng != null ? formatDuration(d.eng) : null, color: "var(--eng)" },
    { label: "leitura", value: d.pages != null ? `${d.pages} pág.` : null, color: "var(--read)" },
    { label: "nota do dia", value: d.score != null ? `${d.score}/10` : null, color: "var(--accent)" },
  ].filter((c) => c.value);

  return (
    <>
      <Backdrop onClose={onClose} />
      <motion.div
        role="dialog"
        aria-modal
        className="fixed inset-x-3 top-[6vh] bottom-[6vh] z-50 mx-auto flex max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.97 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
          <button
            disabled={!prev}
            onClick={() => go(prev, -1)}
            className="rounded-full px-3 py-1.5 text-sm text-muted transition hover:bg-card-2 hover:text-foreground disabled:opacity-30"
          >
            ← anterior
          </button>
          <button onClick={onClose} className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-card-2 hover:text-foreground">
            fechar ✕
          </button>
          <button
            disabled={!next}
            onClick={() => go(next, 1)}
            className="rounded-full px-3 py-1.5 text-sm text-muted transition hover:bg-card-2 hover:text-foreground disabled:opacity-30"
          >
            próximo →
          </button>
        </div>
        <div className="relative flex-1 overflow-y-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={d.date}
              className="space-y-6 p-6 md:p-8"
              initial={{ opacity: 0, x: dir * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -40 }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              <div>
                <div className="text-sm text-muted">Day {d.dayNumber ?? "?"} · {brDate(d.date)}</div>
                <h3 className="mt-1 text-3xl font-semibold tracking-tight first-letter:uppercase">{longDate(d.date)}</h3>
              </div>
              {chips.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {chips.map((c, k) => (
                    <motion.div
                      key={c.label}
                      className="rounded-2xl border border-border bg-card-2 px-4 py-3"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * k }}
                    >
                      <div className="text-xl font-semibold tabular-nums">{c.value}</div>
                      <div className="flex items-center gap-1.5 text-xs text-muted">
                        <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                        {c.label}
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl bg-card-2 px-4 py-3 text-sm text-muted">Dia sem tempo registrado.</p>
              )}
              {d.study && <Block label="Estudo">{d.study}</Block>}
              {d.learned && <Block label="O que aprendi">{d.learned}</Block>}
              {d.notes && <Block label="Notas">{d.notes}</Block>}
              <DayCommits date={d.date} />
              {d.groupedWith.length > 0 && (
                <p className="text-sm text-muted">Registrado no mesmo arquivo que {d.groupedWith.map(brDate).join(", ")}.</p>
              )}
              {d.warnings.map((w) => (
                <p key={w} className="text-sm text-amber-600 dark:text-amber-400">⚠ {w}</p>
              ))}
              <details className="group rounded-2xl border border-border">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm text-muted">
                  <span className="inline-block transition group-open:rotate-90">›</span> arquivo original ·{" "}
                  <span className="font-mono text-xs">{d.file}</span>
                </summary>
                <pre className="overflow-x-auto border-t border-border px-4 py-3 font-mono text-xs whitespace-pre">{d.raw}</pre>
              </details>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium tracking-wider text-muted uppercase">{label}</div>
      <p className="leading-relaxed whitespace-pre-line">{children}</p>
    </div>
  );
}

/* ------------------------------------------------------- registrar dia */

export const input =
  "w-full rounded-xl border border-border bg-card-2 px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-[var(--glow)]";

function NewDayDrawer({ today, onClose }: { today: string; onClose: () => void }) {
  const [state, action, pending] = useActionState<NewDayState, FormData>(createDay, null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <Backdrop onClose={onClose} />
      <motion.aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto border-l border-border bg-card p-6 shadow-2xl"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 260, damping: 32 }}
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-semibold">Registrar dia</h3>
            <p className="mt-1 text-sm text-muted">Cria o .md no formato de sempre. Nunca sobrescreve um dia existente.</p>
          </div>
          <button onClick={onClose} className="rounded-full px-2 py-1 text-muted hover:bg-card-2">✕</button>
        </div>

        <AnimatePresence mode="wait">
          {state?.ok ? (
            <motion.div key="ok" className="relative flex flex-1 flex-col items-center justify-center text-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <Burst />
              <motion.div className="text-6xl" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 12 }}>
                🔥
              </motion.div>
              <p className="mt-4 text-xl font-semibold">{state.message}</p>
              <p className="mt-1 font-mono text-xs text-muted">{state.file}</p>
              <button onClick={onClose} className="mt-8 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink">
                Ver no painel
              </button>
            </motion.div>
          ) : (
            <motion.form key="form" action={action} className="space-y-4" exit={{ opacity: 0, y: -10 }}>
              <DayFields defaultDate={today} max={today} />
              <motion.button
                whileTap={{ scale: 0.97 }}
                disabled={pending}
                className="w-full rounded-xl bg-accent py-3 text-sm font-medium text-accent-ink transition disabled:opacity-50"
              >
                {pending ? "Salvando…" : "Salvar dia"}
              </motion.button>
              {state && !state.ok && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-red-600 dark:text-red-400">
                  {state.message}
                </motion.p>
              )}
            </motion.form>
          )}
        </AnimatePresence>
      </motion.aside>
    </>
  );
}

// Campos de um dia (usados na gaveta "Registrar dia" e no registro retroativo da aba Mês)
export function DayFields({ defaultDate, max, min }: { defaultDate: string; max: string; min?: string }) {
  return (
    <>
      <label className="block space-y-1.5">
        <span className="text-sm text-muted">Data</span>
        <input type="date" name="date" defaultValue={defaultDate} min={min} max={max} required className={input} />
      </label>
      <div className="grid grid-cols-3 gap-3">
        {[
          { name: "programming", label: "Programação", ph: "2h30", color: "var(--prog)" },
          { name: "english", label: "Inglês", ph: "1h", color: "var(--eng)" },
          { name: "pages", label: "Páginas", ph: "10", color: "var(--read)" },
        ].map((f) => (
          <label key={f.name} className="block space-y-1.5">
            <span className="flex items-center gap-1.5 text-sm text-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: f.color }} />
              {f.label}
            </span>
            <input
              name={f.name}
              placeholder={f.ph}
              inputMode={f.name === "pages" ? "numeric" : "text"}
              className={input}
            />
          </label>
        ))}
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm text-muted">O que aprendi</span>
        <textarea name="learned" rows={5} className={input} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-muted">Notas</span>
        <textarea name="notes" rows={3} className={input} />
      </label>
    </>
  );
}

// Explosão de partículas ao salvar
export function Burst() {
  const colors = ["var(--prog)", "var(--eng)", "var(--read)", "var(--accent)"];
  return (
    <div className="pointer-events-none absolute top-1/2 left-1/2">
      {Array.from({ length: 28 }, (_, i) => {
        const angle = (i / 28) * Math.PI * 2;
        const dist = 90 + (i % 4) * 30;
        return (
          <motion.span
            key={i}
            className="absolute h-2 w-2 rounded-full"
            style={{ background: colors[i % 4] }}
            initial={{ x: 0, y: -60, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist - 60, opacity: 0, scale: 0.4 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
          />
        );
      })}
    </div>
  );
}

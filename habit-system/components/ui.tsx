"use client";

import { animate, motion, useInView, useReducedMotion, useScroll, useSpring } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export const EASE = [0.22, 1, 0.36, 1] as const;

// Número que conta do zero até o valor quando aparece na tela
export function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString("pt-BR"),
  duration = 1.4,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, { duration: reduce ? 0 : duration, ease: EASE, onUpdate: setShown });
    return () => controls.stop();
  }, [inView, value, duration, reduce]);

  return (
    <span ref={ref} className={`tabular-nums ${className ?? ""}`}>
      {format(shown)}
    </span>
  );
}

// Sobe e aparece quando entra na tela
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export function Section({
  id,
  eyebrow,
  title,
  subtitle,
  color,
  children,
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  color?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8 py-16 md:py-24">
      <Reveal className="mb-8 md:mb-10">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium tracking-[0.18em] text-muted uppercase">
          <span className="h-2 w-2 rounded-full" style={{ background: color ?? "var(--accent)" }} />
          {eyebrow}
        </div>
        <h2 className="text-3xl font-semibold tracking-tight text-balance md:text-5xl">{title}</h2>
        {subtitle && <p className="mt-3 max-w-2xl text-muted">{subtitle}</p>}
      </Reveal>
      {children}
    </section>
  );
}

export function Card({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <Reveal delay={delay} className={`min-w-0 rounded-3xl border border-border bg-card p-5 md:p-6 ${className}`}>
      {children}
    </Reveal>
  );
}

// Anel de progresso animado
export function Ring({
  value,
  size = 120,
  stroke = 10,
  color = "var(--accent)",
  children,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--empty)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: Math.max(0.001, Math.min(1, value)) }}
          viewport={{ once: true }}
          transition={{ duration: 1.6, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30 });
  return (
    <motion.div
      className="fixed inset-x-0 top-0 z-50 h-[3px] origin-left"
      style={{ scaleX, background: "linear-gradient(90deg, var(--prog), var(--accent), var(--eng))" }}
    />
  );
}

export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

// Tooltip que segue o ponteiro dentro de um container relativo
export type TipState = { x: number; y: number; content: ReactNode } | null;

export function Tooltip({ tip, containerWidth }: { tip: TipState; containerWidth: number }) {
  if (!tip) return null;
  const flip = tip.x > containerWidth - 180;
  return (
    <div
      className="pointer-events-none absolute z-20 min-w-36 rounded-xl border border-border bg-card/95 px-3 py-2 text-xs shadow-xl backdrop-blur"
      style={{
        left: tip.x,
        top: tip.y,
        transform: `translate(${flip ? "calc(-100% - 12px)" : "12px"}, -110%)`,
      }}
    >
      {tip.content}
    </div>
  );
}

export function TipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="h-0.5 w-3 rounded" style={{ background: color }} />
      <span className="font-semibold text-foreground tabular-nums">{value}</span>
      <span className="text-muted">{label}</span>
    </div>
  );
}

export function Legend({ items }: { items: { color: string; label: string; line?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className={i.line ? "h-0.5 w-4 rounded" : "h-2.5 w-2.5 rounded-[3px]"} style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

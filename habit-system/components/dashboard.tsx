"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { buildDashboard, computeExtras, type DayLite, type Report, type SummaryLite } from "@/lib/dashboard";
import { OverlayProvider } from "./overlays";
import { Achievements, Backstage, Fab, HABITS, HabitSection, Journal } from "./sections";
import { MonthTab, TodayTab, YearTab } from "./tabs";
import { EASE, ScrollProgress } from "./ui";

const TABS = [
  { id: "hoje", label: "Hoje" },
  { id: "mes", label: "Mês" },
  { id: "ano", label: "Ano" },
  { id: "habitos", label: "Hábitos" },
  { id: "conquistas", label: "Conquistas" },
  { id: "diario", label: "Diário" },
  { id: "dados", label: "Dados" },
] as const;
type TabId = (typeof TABS)[number]["id"];

// Seções que moram dentro de uma aba (links antigos como /#diario continuam funcionando)
const SECTION_TAB: Record<string, TabId> = {
  resumo: "hoje",
  "hoje-painel": "hoje",
  dias: "ano",
  geral: "ano",
  meses: "ano",
  programming: "habitos",
  english: "habitos",
  reading: "habitos",
  bastidores: "dados",
};

// A aba ativa vive no #hash da URL: recarregar mantém a aba e o "voltar" do navegador funciona.
// Ao salvar algo o Next atualiza a página e tira o #; por isso guardamos o último valor.
let lastHash = "";
const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const readHash = () => {
  const h = window.location.hash.slice(1);
  if (h) lastHash = h;
  return lastHash;
};
const useHash = () => useSyncExternalStore(subscribe, readHash, () => "");

function tabOf(hash: string): TabId {
  if (TABS.some((t) => t.id === hash)) return hash as TabId;
  return SECTION_TAB[hash] ?? "hoje";
}

export default function DashboardView({
  days,
  summaries,
  report,
  today,
}: {
  days: DayLite[];
  summaries: SummaryLite[];
  report: Report;
  today: string;
}) {
  const extras = useMemo(() => computeExtras(days, summaries), [days, summaries]);
  const all = useMemo(() => buildDashboard(days, extras, today), [days, extras, today]);
  const hash = useHash();
  const tab = tabOf(hash);

  // Trocou de aba: volta ao topo. Veio de um link para uma seção: rola até ela.
  useEffect(() => {
    if (!hash || TABS.some((t) => t.id === hash)) {
      window.scrollTo({ top: 0 });
      return;
    }
    const t = setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" }), 350);
    return () => clearTimeout(t);
  }, [hash]);

  // Recoloca o # na URL se o Next o tirou (para recarregar continuar na mesma aba)
  useEffect(() => {
    if (hash && window.location.hash.slice(1) !== hash) history.replaceState(null, "", `#${hash}`);
  });

  return (
    <OverlayProvider days={all.days} today={today}>
      <ScrollProgress />
      <nav className="sticky top-0 z-40 border-b border-border bg-background/75 backdrop-blur-xl">
        <div className="no-scrollbar mx-auto flex max-w-6xl items-center gap-4 overflow-x-auto px-4 py-3 md:px-8">
          <a href="#hoje" className="shrink-0 font-semibold tracking-tight">
            16 <span className="text-accent">→</span> 18
          </a>
          <div className="flex gap-1">
            {TABS.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                aria-current={tab === t.id ? "page" : undefined}
                className="relative shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors md:px-4"
                style={{ color: tab === t.id ? "var(--accent-ink)" : "var(--muted)" }}
              >
                {tab === t.id && (
                  <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                )}
                <span className="relative">{t.label}</span>
              </a>
            ))}
          </div>
        </div>
      </nav>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: EASE }}
        >
          {tab === "hoje" && <TodayTab all={all} />}
          {tab === "mes" && <MonthTab all={all} days={days} extras={extras} summaries={summaries} />}
          {tab === "ano" && <YearTab days={days} extras={extras} today={today} />}
          {tab !== "hoje" && tab !== "mes" && tab !== "ano" && (
            <main className="mx-auto max-w-6xl px-4 md:px-8">
              {tab === "habitos" &&
                (Object.keys(HABITS) as (keyof typeof HABITS)[]).map((k) => <HabitSection key={k} k={k} stats={all.habits[k]} data={all} />)}
              {tab === "conquistas" && <Achievements data={all} />}
              {tab === "diario" && <Journal data={all} />}
              {tab === "dados" && <Backstage data={all} report={report} summaries={summaries} />}
            </main>
          )}
        </motion.div>
      </AnimatePresence>

      <footer className="py-16 text-center text-sm text-faint">
        Construído a partir de {report.files} arquivos de registro · os originais nunca são alterados
      </footer>
      <Fab logged={all.loggedToday} />
    </OverlayProvider>
  );
}

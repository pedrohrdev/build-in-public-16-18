"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { savePreferences } from "@/app/actions";
import { activeHabits, type Preferences, type Habit } from "@/lib/preferences";
import { input } from "./overlays";

export function Onboarding({ initial, editing = false, onClose }: { initial: Preferences; editing?: boolean; onClose?: () => void }) {
  const [draft, setDraft] = useState(initial);
  const [step, setStep] = useState(0);
  const [label, setLabel] = useState("");
  const [unit, setUnit] = useState<Habit["unit"]>("min");
  const [error, setError] = useState("");
  const [state, action, pending] = useActionState(savePreferences, null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [step]);
  useEffect(() => { if (state?.ok) onClose?.(); }, [state, onClose]);
  const selected = activeHabits(draft);
  function next() {
    if (step === 1 && !selected.length) { setError("Escolha pelo menos um hábito."); return; }
    setError(""); setStep(step + 1);
  }
  function addHabit() {
    const name = label.trim();
    if (!name || draft.habits.some(h => h.label.toLowerCase() === name.toLowerCase())) { setError("Digite um nome de hábito que ainda não esteja na lista."); return; }
    if (draft.habits.length >= 30) { setError("Você pode cadastrar até 30 hábitos."); return; }
    setDraft({ ...draft, habits: [...draft.habits, { id: `custom-${crypto.randomUUID()}`, label: name, unit, enabled: true }] });
    setLabel(""); setError("");
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-12 md:px-8">
      <div className="mb-6 flex items-center justify-between text-sm text-muted">
        <span>Hábitos 16 → 18 · {editing ? "Suas preferências" : "Seu começo"}</span>
        {editing && <button type="button" onClick={onClose} className="rounded-xl border border-border px-3 py-2">Cancelar</button>}
      </div>
      <ol aria-label="Etapas da configuração" className="mb-8 flex gap-2 text-xs">
        {["Você", "Hábitos", "Pronto"].map((name, i) => <li key={name} aria-current={i === step ? "step" : undefined} className={`flex-1 rounded-xl border px-3 py-2 ${i === step ? "border-accent text-foreground" : "border-border text-muted"}`}>{i + 1}. {name}</li>)}
      </ol>
      <form action={action} onSubmit={e => { if (step < 2) { e.preventDefault(); next(); } }} className="rounded-3xl border border-border bg-card p-5 md:p-8">
        <input type="hidden" name="preferences" value={JSON.stringify(draft)} />
        <h1 ref={heading} tabIndex={-1} className="text-3xl font-semibold tracking-tight outline-none">{step === 0 ? "Uma rotina com a sua cara" : step === 1 ? "O que você quer acompanhar?" : "Tudo pronto para começar"}</h1>
        {step === 0 && <div className="mt-6 space-y-5">
          <p className="text-muted">Escolha seus hábitos e acompanhe sua evolução. Você pode mudar essas escolhas depois, sem apagar seu histórico.</p>
          <label className="block space-y-2"><span>Como quer ser chamado? <span className="text-muted">(opcional)</span></span><input className={input} maxLength={60} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} autoComplete="given-name" placeholder="Seu nome" /></label>
          <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" checked={draft.github} onChange={e => setDraft({ ...draft, github: e.target.checked })} /><span>Mostrar atividade do GitHub<span className="mt-1 block text-sm text-muted">Opcional. Usa o perfil configurado na instalação.</span></span></label>
        </div>}
        {step === 1 && <div className="mt-6 space-y-5">
          <p className="text-muted">Marque só o que faz parte da sua rotina. Pode ser apenas programação, ou algo completamente diferente.</p>
          <fieldset className="space-y-2"><legend className="sr-only">Hábitos disponíveis</legend>{draft.habits.map(h => <label key={h.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={h.enabled} onChange={e => setDraft({ ...draft, habits: draft.habits.map(item => item.id === h.id ? { ...item, enabled: e.target.checked } : item) })} /><span className="min-w-0 flex-1 break-words">{h.label}</span><span className="text-xs text-muted">{h.unit === "min" ? "tempo" : h.unit === "pages" ? "páginas" : "quantidade"}</span></label>)}</fieldset>
          <fieldset className="space-y-3 rounded-xl bg-card-2 p-4"><legend className="px-1 text-sm font-medium">Criar outro hábito</legend>
            <label className="block space-y-1"><span className="text-sm text-muted">Nome</span><input value={label} maxLength={40} onChange={e => setLabel(e.target.value)} className={input} placeholder="Ex.: caminhada, música, matemática" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addHabit(); } }} /></label>
            <label className="block space-y-1"><span className="text-sm text-muted">Como medir</span><select value={unit} onChange={e => setUnit(e.target.value as Habit["unit"])} className={input}><option value="min">Tempo (horas e minutos)</option><option value="count">Quantidade (vezes)</option><option value="pages">Páginas</option></select></label>
            <button type="button" onClick={addHabit} className="rounded-xl border border-border px-4 py-2 text-sm">Adicionar hábito</button>
          </fieldset>
        </div>}
        {step === 2 && <div className="mt-6 space-y-4"><p className="text-muted">{draft.name ? `${draft.name}, seu` : "Seu"} painel vai acompanhar:</p><ul className="space-y-2">{selected.map(h => <li key={h.id} className="rounded-xl bg-card-2 px-4 py-3">✓ {h.label}</li>)}</ul><p className="text-sm text-muted">GitHub {draft.github ? "ativado" : "desativado"}. Seus registros existentes continuam guardados. Você pode reativar qualquer hábito em Personalizar.</p></div>}
        {(error || state && !state.ok) && <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">{error || state?.message}</p>}
        <div className="mt-8 flex justify-between gap-3">
          {step > 0 ? <button type="button" disabled={pending} onClick={() => { setStep(step - 1); setError(""); }} className="rounded-xl border border-border px-4 py-3 text-sm">Voltar</button> : <span />}
          {step < 2 ? <button key="continue" type="button" onClick={next} className="rounded-xl bg-accent px-5 py-3 text-sm font-medium text-accent-ink">Continuar</button> : <button key="save" type="submit" disabled={pending} className="rounded-xl bg-accent px-5 py-3 text-sm font-medium text-accent-ink disabled:opacity-50">{pending ? "Salvando…" : editing ? "Salvar preferências" : "Abrir meu painel"}</button>}
        </div>
      </form>
    </main>
  );
}

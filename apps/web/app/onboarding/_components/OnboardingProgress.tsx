import { Check } from "lucide-react";

import type { OnboardingStep, StepKey } from "../types";

export function OnboardingProgress({ active, onSelect, steps }: { active: StepKey; onSelect: (key: StepKey) => void; steps: OnboardingStep[] }) {
  const complete = steps.filter((step) => step.status === "complete").length;
  return <div><p className="text-sm text-stone-500">{complete} passaggi completati su {steps.length}</p><ol className="mt-5 grid grid-cols-3 gap-2 lg:grid-cols-1">{steps.map((step, index) => {
    const selected = active === step.key;
    const done = step.status === "complete";
    return <li key={step.key}><button aria-current={selected ? "step" : undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-semibold ${selected ? "bg-stone-950 text-white" : "text-stone-600 hover:bg-stone-100"}`} onClick={() => onSelect(step.key)} type="button"><span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs ${done ? "bg-[#792f59] text-white" : selected ? "bg-white text-stone-950" : "bg-stone-200"}`}>{done ? <Check aria-hidden="true" className="size-4" /> : index + 1}</span><span className="hidden lg:inline">{step.label}</span><span className="sr-only">{step.status === "needs_attention" ? "Richiede attenzione" : done ? "Completato" : "Da completare"}</span></button></li>;
  })}</ol></div>;
}

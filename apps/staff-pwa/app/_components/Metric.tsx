import { Surface } from "./Surface";

export function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Surface className="p-4">
      <b className="block text-3xl font-black tracking-[-.03em] text-stone-950">{value}</b>
      <span className="text-xs font-bold text-stone-400">{label}</span>
    </Surface>
  );
}

import { KpiStrip } from "@esse-beauty/ui";

export function HomeKpiStrip({ items }: { items: Array<{ detail: string; label: string; value: number | string }> }) {
  return <KpiStrip items={items} />;
}

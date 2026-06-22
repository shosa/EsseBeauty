"use client";

import {
  Brush,
  Droplets,
  Eye,
  Flower2,
  Hand,
  Heart,
  Palette,
  Scissors,
  Sparkles,
  Sun,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const SERVICE_CATEGORY_ICONS = [
  { key: "scissors", label: "Capelli e taglio", icon: Scissors },
  { key: "brush", label: "Piega e styling", icon: Brush },
  { key: "palette", label: "Trucco", icon: Palette },
  { key: "hand", label: "Unghie e manicure", icon: Hand },
  { key: "eye", label: "Ciglia e sopracciglia", icon: Eye },
  { key: "sparkles", label: "Viso ed estetica", icon: Sparkles },
  { key: "flower-2", label: "Spa e massaggi", icon: Flower2 },
  { key: "zap", label: "Depilazione e laser", icon: Zap },
  { key: "droplets", label: "Trattamenti e skincare", icon: Droplets },
  { key: "waves", label: "Corpo e benessere", icon: Waves },
  { key: "sun", label: "Abbronzatura", icon: Sun },
  { key: "heart", label: "Benessere", icon: Heart },
] as const;

const iconMap = Object.fromEntries(
  SERVICE_CATEGORY_ICONS.map((item) => [item.key, item.icon]),
) as Record<string, LucideIcon>;

export function ServiceCategoryIcon({
  className,
  name,
}: {
  className?: string;
  name?: string | null;
}) {
  const Icon = iconMap[name ?? ""] ?? Sparkles;
  return <Icon aria-hidden="true" className={className} strokeWidth={1.8} />;
}

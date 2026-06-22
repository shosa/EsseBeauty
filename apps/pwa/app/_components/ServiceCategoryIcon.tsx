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

const icons: Record<string, LucideIcon> = {
  brush: Brush,
  droplets: Droplets,
  eye: Eye,
  "flower-2": Flower2,
  hand: Hand,
  heart: Heart,
  palette: Palette,
  scissors: Scissors,
  sparkles: Sparkles,
  sun: Sun,
  waves: Waves,
  zap: Zap,
};

export function ServiceCategoryIcon({ className, name }: { className?: string; name?: string | null }) {
  const Icon = icons[name ?? ""] ?? Sparkles;
  return <Icon aria-hidden="true" className={className} strokeWidth={1.8} />;
}

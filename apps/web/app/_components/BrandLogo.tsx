import type { CSSProperties } from "react";

const logoMask: CSSProperties = {
  WebkitMaskImage: "url('/esse-logo.svg')",
  WebkitMaskPosition: "center",
  WebkitMaskRepeat: "no-repeat",
  WebkitMaskSize: "contain",
  maskImage: "url('/esse-logo.svg')",
  maskPosition: "center",
  maskRepeat: "no-repeat",
  maskSize: "contain",
};

export function BrandLogo({
  className = "size-8",
  tone = "color",
}: {
  className?: string;
  tone?: "color" | "rail" | "secondary" | "white";
}) {
  if (tone === "rail" || tone === "secondary" || tone === "white") {
    const toneClass = tone === "white" ? "bg-white" : tone === "secondary" ? "bg-[#792f59]" : "bg-[#2d1d27]";
    return <span aria-hidden="true" className={`block ${toneClass} ${className}`} style={logoMask} />;
  }

  return <img alt="" aria-hidden="true" className={`object-contain ${className}`} src="/esse-logo.svg" />;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar, Style } from "@dicebear/core";
import adventurer from "@dicebear/styles/adventurer.json" with { type: "json" };
import avatars from "@dicebear/styles/initial-face.json" with { type: "json" };
import lorelei from "@dicebear/styles/lorelei.json" with { type: "json" };
import micah from "@dicebear/styles/micah.json" with { type: "json" };

export type DiceBearStyleKey = "adventurer" | "initial-face" | "lorelei" | "micah";

const avatarStyles: Record<DiceBearStyleKey, Style> = {
  adventurer: new Style(adventurer),
  "initial-face": new Style(avatars),
  lorelei: new Style(lorelei),
  micah: new Style(micah),
};

export interface CustomerAvatarPreference {
  diceBearEnabled?: boolean;
  diceBearStyle?: DiceBearStyleKey;
  primaryColor?: string;
}

export function customerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}` : parts[0]?.slice(0, 2) ?? "EB").toUpperCase();
}

function diceBearPreference(): { diceBearEnabled: boolean; diceBearStyle: DiceBearStyleKey; primaryColor: string } {
  if (typeof document === "undefined") {
    return { diceBearEnabled: true, diceBearStyle: "initial-face", primaryColor: "#543147" };
  }
  const style = document.documentElement.dataset.dicebearStyle;
  const enabled = document.documentElement.dataset.dicebearEnabled !== "false";
  const primary = getComputedStyle(document.documentElement).getPropertyValue("--esse-mulberry").trim() || "#543147";
  return {
    diceBearEnabled: enabled,
    diceBearStyle: style && style in avatarStyles ? style as DiceBearStyleKey : "initial-face",
    primaryColor: primary,
  };
}

function useDiceBearPreference() {
  const [preference, setPreference] = useState(diceBearPreference);

  useEffect(() => {
    setPreference(diceBearPreference());
    const observer = new MutationObserver(() => setPreference(diceBearPreference()));
    observer.observe(document.documentElement, {
      attributeFilter: ["data-dicebear-enabled", "data-dicebear-style", "style"],
      attributes: true,
    });
    return () => observer.disconnect();
  }, []);

  return preference;
}

function validHex(value?: string): value is string {
  return Boolean(value && /^#[0-9a-f]{6}$/i.test(value));
}

function resolvePreference(
  documentPreference: ReturnType<typeof diceBearPreference>,
  preference?: CustomerAvatarPreference,
) {
  if (!preference) return documentPreference;
  return {
    diceBearEnabled: preference.diceBearEnabled ?? documentPreference.diceBearEnabled,
    diceBearStyle: preference.diceBearStyle && preference.diceBearStyle in avatarStyles ? preference.diceBearStyle : documentPreference.diceBearStyle,
    primaryColor: validHex(preference.primaryColor) ? preference.primaryColor : documentPreference.primaryColor,
  };
}

export function CustomerAvatar({
  className = "size-10",
  id,
  name,
  preference,
  size = 40,
}: {
  className?: string;
  id: string;
  name: string;
  preference?: CustomerAvatarPreference;
  size?: number;
}) {
  const documentPreference = useDiceBearPreference();
  const resolvedPreference = resolvePreference(documentPreference, preference);
  const src = useMemo(() => {
    if (!resolvedPreference.diceBearEnabled) return "";
    return new Avatar(avatarStyles[resolvedPreference.diceBearStyle], {
      borderRadius: 50,
      seed: name,
      size: Math.max(size, 64),
    }).toDataUri();
  }, [id, name, resolvedPreference.diceBearEnabled, resolvedPreference.diceBearStyle, size]);

  if (!resolvedPreference.diceBearEnabled) {
    return (
      <span
        aria-label={`Avatar di ${name}`}
        className={`${className} grid shrink-0 place-items-center rounded-full border-2 object-cover text-sm font-black text-white`}
        style={{ backgroundColor: resolvedPreference.primaryColor, borderColor: resolvedPreference.primaryColor }}
      >
        {customerInitials(name)}
      </span>
    );
  }

  return (
    <img
      alt={`Avatar di ${name}`}
      className={`${className} shrink-0 rounded-full border-2 object-cover`}
      height={size}
      src={src}
      style={{ borderColor: resolvedPreference.primaryColor }}
      width={size}
    />
  );
}

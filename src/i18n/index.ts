import { useSyncExternalStore } from "react";
import { sv } from "./sv";

/**
 * Minimal typed i18n. Source strings are written in English (the default and
 * fallback); translations map the English source to the target language.
 * Placeholders use {name} syntax: t("{n} garages", { n: 3 }).
 */
export type Language = "en" | "sv";
export const LANGUAGES: { id: Language; label: string }[] = [
  { id: "en", label: "English" },
  { id: "sv", label: "Svenska" },
];

const STORAGE_KEY = "garageai.language";
const dictionaries: Record<Language, Record<string, string>> = { en: {}, sv };

function readStored(): Language {
  try {
    const v = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (v === "sv" || v === "en") return v;
    const nav = globalThis.navigator?.language?.toLowerCase() ?? "";
    return nav.startsWith("sv") ? "sv" : "en";
  } catch {
    return "en";
  }
}

let current: Language = readStored();
const listeners = new Set<() => void>();

export function getLanguage(): Language {
  return current;
}

export function setLanguage(lang: Language) {
  if (lang === current) return;
  current = lang;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") document.documentElement.lang = lang;
  listeners.forEach((l) => l());
}

export function t(source: string, vars?: Record<string, string | number>): string {
  let out = dictionaries[current][source] ?? source;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Re-renders the caller when the language changes. */
export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, getLanguage, getLanguage);
}

export function isLanguage(v: unknown): v is Language {
  return v === "en" || v === "sv";
}

/** Locale for number/date formatting. */
export function locale(): string {
  return current === "sv" ? "sv-SE" : "en-GB";
}

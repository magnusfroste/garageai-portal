/**
 * Minimal typed i18n. The portal is English only: t() returns the English
 * source string with {name} placeholders filled: t("{n} garages", { n: 3 }).
 */
export type Language = "en";

export function getLanguage(): Language {
  return "en";
}

export function t(source: string, vars?: Record<string, string | number>): string {
  let out = source;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

/** Locale for number/date formatting. */
export function locale(): string {
  return "en-GB";
}

export type MailMode = "off" | "test" | "on";
export type MailLanguage = "en" | "sv";
export const MAIL_KEYS = ["first_request_nudge", "connect_garage_nudge", "garage_offline"] as const;
export const MAIL_RUN_LIMIT = 20;
export const MAIL_DEFAULTS = { mode: "off" as MailMode, test_delay_minutes: 10, max_per_week: 1, max_total: 3, from_email: "support@garageai.eu", from_name: "GarageAI" };
export type MailSettings = typeof MAIL_DEFAULTS;
export interface MailTemplate { key: string; enabled: boolean; subject_en: string; subject_sv: string; body_en: string; body_sv: string }
export interface MailCandidate { user_id: string; email: string; template_key: string; event_ref: string; key_hint: string; garage_name: string; days_offline: number }

export function mailCapReached(total: number, recent: string[], settings: Pick<MailSettings, "max_per_week" | "max_total">, now = Date.now()): boolean {
  return total >= settings.max_total || recent.filter(at => Date.parse(at) >= now - 7 * 86400_000).length >= settings.max_per_week;
}

export function mailDelayMinutes(key: string, settings: MailSettings): number {
  return settings.mode === "test" ? settings.test_delay_minutes : (key === "first_request_nudge" ? 2 : 3) * 1440;
}

export function mailAccountAllowed(settings: MailSettings, mailTest: boolean, optOut: string | null): boolean {
  return settings.mode !== "off" && (settings.mode !== "test" || mailTest) && optOut === null;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));

export function renderMail(template: MailTemplate, language: MailLanguage, values: Record<string, string>, unsubscribeUrl: string) {
  const replace = (text: string) => text.replace(/\{\{(key_hint|garage_name|days_offline)\}\}/g, (_, key: string) => values[key] ?? "");
  const subject = replace(language === "sv" ? template.subject_sv : template.subject_en).replace(/[\r\n]/g, " ");
  const body = replace(language === "sv" ? template.body_sv : template.body_en);
  const footer = language === "sv" ? "Avsluta mejl om ditt konto och dina garage" : "Unsubscribe from mail about your account and garages";
  return { subject, textContent: `GarageAI\n\n${body}\n\n${footer}: ${unsubscribeUrl}`,
    htmlContent: `<!doctype html><html lang="${language}"><body style="color-scheme:light;background-color:Canvas;color:CanvasText;padding:20px"><main><p><strong>GarageAI</strong></p><div style="white-space:pre-wrap;font-family:Arial,sans-serif;line-height:1.6">${escapeHtml(body)}</div><hr><p><a href="${escapeHtml(unsubscribeUrl)}">${footer}</a></p></main></body></html>` };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
async function signingKey(secret: string) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export async function mailToken(userId: string, secret: string): Promise<string> {
  if (!UUID.test(userId)) throw new Error("Invalid account");
  const id = userId.toLowerCase();
  return `${id}.${hex(await crypto.subtle.sign("HMAC", await signingKey(secret), new TextEncoder().encode(`mail-unsubscribe:${id}`)))}`;
}
export async function verifyMailToken(token: string, secret: string): Promise<string | null> {
  const [id, signature, extra] = token.split(".");
  if (extra !== undefined || !id || !UUID.test(id) || !signature || !/^[a-f0-9]{64}$/.test(signature)) return null;
  const bytes = Uint8Array.from(signature.match(/../g) ?? [], part => parseInt(part, 16));
  const valid = await crypto.subtle.verify("HMAC", await signingKey(secret), bytes, new TextEncoder().encode(`mail-unsubscribe:${id}`));
  return valid ? id : null;
}
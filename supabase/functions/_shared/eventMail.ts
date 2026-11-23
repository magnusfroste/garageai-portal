export type MailMode = "off" | "test" | "on";
export type MailLanguage = "en" | "sv";
export const MAIL_KEYS = ["first_request_nudge", "connect_garage_nudge", "garage_offline"] as const;
export const MAIL_RUN_LIMIT = 20;
export const MAIL_DEFAULTS = { mode: "off" as MailMode, test_delay_minutes: 10, max_per_week: 1, max_total: 3, from_email: "support@garageai.eu", from_name: "GarageAI", provider: "cloudflare" as "cloudflare" | "brevo" };
export type MailSettings = typeof MAIL_DEFAULTS;
export interface MailTemplate { key: string; enabled: boolean; kind: string; subject_en: string; subject_sv: string; body_en: string; body_sv: string }
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
export type MailProvider = "cloudflare" | "brevo";
export const MAIL_PROVIDERS = ["cloudflare", "brevo"] as const;
export interface OutgoingMail { from_email: string; from_name: string; to: string; subject: string; textContent: string; htmlContent: string; headers: Record<string, string> }
export type SendResult = { ok: true; id: string | null } | { ok: false; error: string; definite: boolean };
type Env = (name: string) => string | undefined;

/** Marketing mail may never go through Cloudflare (transactional-only terms). */
export function providerAllowsKind(provider: MailProvider, kind: string): boolean {
  return !(provider === "cloudflare" && kind === "marketing");
}

export function mailProviderReady(provider: MailProvider, env: Env): boolean {
  return provider === "cloudflare" ? !!env("CLOUDFLARE_MAIL_TOKEN") && !!env("CLOUDFLARE_MAIL_ACCOUNT_ID") : !!env("BREVO_API_KEY");
}

/** One branch per provider; never returns or logs credentials. */
export async function sendMail(provider: MailProvider, message: OutgoingMail, env: Env, doFetch: typeof fetch = fetch): Promise<SendResult> {
  if (!mailProviderReady(provider, env)) return { ok: false, error: "no mail key", definite: true };
  try {
    if (provider === "cloudflare") {
      const account = encodeURIComponent(env("CLOUDFLARE_MAIL_ACCOUNT_ID")!);
      const response = await doFetch(`https://api.cloudflare.com/client/v4/accounts/${account}/email/sending/send`, { method: "POST", signal: AbortSignal.timeout(10_000), headers: { Authorization: `Bearer ${env("CLOUDFLARE_MAIL_TOKEN")}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: { address: message.from_email, name: message.from_name }, to: message.to, subject: message.subject, text: message.textContent, html: message.htmlContent, headers: message.headers }) });
      const result = await response.json().catch(() => null) as { success?: boolean; errors?: { message?: string }[]; result?: { id?: string; message_id?: string } } | null;
      if (!response.ok || result?.success === false) {
        const first = result?.errors?.[0]?.message;
        return { ok: false, error: typeof first === "string" && first ? first.slice(0, 300) : `Cloudflare HTTP ${response.status}`, definite: true };
      }
      const id = result?.result?.message_id ?? result?.result?.id;
      return { ok: true, id: typeof id === "string" ? id : null };
    }
    const response = await doFetch("https://api.brevo.com/v3/smtp/email", { method: "POST", signal: AbortSignal.timeout(10_000), headers: { "api-key": env("BREVO_API_KEY")!, "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify({ sender: { email: message.from_email, name: message.from_name }, to: [{ email: message.to }], subject: message.subject, textContent: message.textContent, htmlContent: message.htmlContent, headers: message.headers }) });
    if (!response.ok) { await response.text(); return { ok: false, error: `Brevo HTTP ${response.status}`, definite: true }; }
    const result = await response.json().catch(() => ({}));
    return { ok: true, id: typeof result.messageId === "string" ? result.messageId : null };
  } catch { return { ok: false, error: "delivery outcome unknown", definite: false }; }
}

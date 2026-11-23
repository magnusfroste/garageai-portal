export type MailMode = "off" | "test" | "on";
export type MailProvider = "cloudflare" | "brevo";
export type MailTemplateKind = "service" | "marketing";
export interface EventMailSettings { mode: MailMode; test_delay_minutes: number; max_per_week: number; max_total: number; from_email: string; from_name: string; provider: MailProvider }
export interface EventMailTemplate { key: string; enabled: boolean; kind: MailTemplateKind | string; subject_en: string; body_en: string; updated_at: string }
export interface EventMailLog { id: string; created_at: string; template_key: string; status: string; mode: string; provider: string | null }
export interface MailCounts { accounts: number; by_rule: Record<string, { matching_accounts: number; eligible_accounts: number }> }
export interface MailPreview { subject: string; htmlContent: string; textContent: string; one_click_url: string }
export const defaultEventMailSettings: EventMailSettings = { mode: "off", test_delay_minutes: 10, max_per_week: 1, max_total: 3, from_email: "support@garageai.eu", from_name: "GarageAI", provider: "cloudflare" };
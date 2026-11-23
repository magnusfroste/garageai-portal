import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { EventMailTemplate, EventMailSettings } from "@/models/types/eventMail.types";

export const eventMailRepository = {
  async adminData() {
    const [settings, templates, logs, counts] = await Promise.all([
      supabase.from("admin_settings").select("value").eq("key", "event_mail").single(),
      supabase.from("mail_templates").select("*").order("key"),
      supabase.from("mail_log").select("id,created_at,template_key,status,mode,provider").order("created_at", { ascending: false }).limit(100),
      supabase.rpc("event_mail_eligible_counts"),
    ]);
    for (const result of [settings, templates, logs, counts]) if (result.error) throw result.error;
    return { settings: settings.data?.value as unknown as EventMailSettings, templates: templates.data ?? [], logs: logs.data ?? [], counts: counts.data };
  },
  async invoke<T>(body: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.functions.invoke("event-mail", { body });
    if (error) {
      if (error instanceof FunctionsHttpError) {
        const detail = await error.context.json().catch(() => null);
        throw new Error(typeof detail?.error === "string" ? detail.error : "Mail operation failed");
      }
      throw error;
    }
    return data as T;
  },
  async saveTemplate(template: EventMailTemplate) {
    const { error } = await supabase.from("mail_templates").update({ enabled: template.enabled, subject_en: template.subject_en, subject_sv: template.subject_sv, body_en: template.body_en, body_sv: template.body_sv, updated_at: new Date().toISOString() }).eq("key", template.key);
    if (error) throw error;
  },
  async searchAccounts(search: string) {
    const { data, error } = await supabase.from("profiles").select("id,email,mail_test").ilike("email", `%${search.replace(/[%_\\]/g, "")}%`).order("email").limit(20);
    if (error) throw error;
    return data ?? [];
  },
  async markTest(userId: string, enabled: boolean) {
    const { error } = await supabase.rpc("set_mail_test", { _user_id: userId, _enabled: enabled });
    if (error) throw error;
  },
  async preference(userId: string) {
    const { data, error } = await supabase.from("profiles").select("mail_opt_out_at").eq("id", userId).single();
    if (error) throw error;
    return data?.mail_opt_out_at ?? null;
  },
  async setPreference(userId: string, enabled: boolean) {
    const { error } = await supabase.from("profiles").update({ mail_opt_out_at: enabled ? null : new Date().toISOString() }).eq("id", userId);
    if (error) throw error;
  },
};
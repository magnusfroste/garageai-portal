import { eventMailRepository } from "@/data/repositories/eventMailRepository";
import { authService } from "./authService";
import { defaultEventMailSettings, type EventMailSettings, type EventMailTemplate, type MailCounts, type MailPreview } from "@/models/types/eventMail.types";

export const eventMailService = {
  async adminData() {
    const data = await eventMailRepository.adminData();
    return { ...data, settings: { ...defaultEventMailSettings, ...(data.settings ?? {}) }, counts: data.counts as unknown as MailCounts };
  },
  saveSettings: (settings: EventMailSettings, confirmOn = false) => eventMailRepository.invoke({ action: "save_settings", settings, confirm_on: confirmOn }),
  saveTemplate: (template: EventMailTemplate) => eventMailRepository.saveTemplate(template),
  preview: (key: string, language: "en" | "sv") => eventMailRepository.invoke<MailPreview>({ action: "preview", template_key: key, language }),
  sendTest: (key: string, language: "en" | "sv") => eventMailRepository.invoke<{ sent: number }>({ action: "send_test", template_key: key, language }),
  capabilities: () => eventMailRepository.invoke<{ mail_key: boolean; link_secret: boolean; provider?: string }>({ action: "capabilities" }),
  searchAccounts: (search: string) => eventMailRepository.searchAccounts(search),
  markTest: (id: string, enabled: boolean) => eventMailRepository.markTest(id, enabled),
  async preference() { const user = await authService.getCurrentUser(); if (!user) throw new Error("Authentication required"); return eventMailRepository.preference(user.id); },
  async setPreference(enabled: boolean) { const user = await authService.getCurrentUser(); if (!user) throw new Error("Authentication required"); return eventMailRepository.setPreference(user.id, enabled); },
  unsubscribe: (token: string, action: "status" | "unsubscribe" | "undo") => eventMailRepository.invoke<{ opted_out: boolean; language: "en" | "sv" }>({ action, token }),
};
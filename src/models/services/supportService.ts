import type { SupportContext, SupportDiagnostics, SupportThread } from '@/models/types/support.types';
import type { GarageRow } from '@/data/repositories/garageRepository';

export const SUPPORT_TAGS = ['onboarding','connect','models','billing','chat','other'] as const;
export const SUPPORT_STATUSES = ['open','answered','closed'] as const;
export const supportUnread = (t: SupportThread, admin = false) => {
  const message = admin ? t.last_user_message_at : t.last_admin_message_at;
  const read = admin ? t.admin_read_at : t.user_read_at;
  return !!message && (!read || message > read);
};
export const sortSupport = (threads: SupportThread[], admin = false) => [...threads].sort((a,b) => Number(supportUnread(b,admin))-Number(supportUnread(a,admin)) || b.created_at.localeCompare(a.created_at));
export const redactSupport = (text: string) => text.replace(/sk-[\w-]+|eyJ[\w.-]+/g,'[redacted]').replace(/Bearer\s+\S+|\w*(?:key|token|secret|password)\s*[:=]\s*[^\s,;]+/gi,'[redacted]').slice(0,500);
export function supportContext(page: string, step: string, lastError: string, ua: string, garages: GarageRow[]): SupportContext {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Other';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Other';
  return { page: redactSupport(page.split(/[?#]/)[0]), step: redactSupport(step), last_error: redactSupport(lastError), browser, os, garages: garages.slice(0,20).map(g => ({name:redactSupport(g.name),bridge_version:redactSupport(g.agent?.version ?? ''),problem_codes:(g.agent?.problems ?? []).slice(0,20).map(p=>redactSupport(p.code))})) };
}
export function supportStuck(d: SupportDiagnostics | undefined, waitingSince: number | null, repeatedError: boolean, now=Date.now()): boolean {
  if (repeatedError || (waitingSince !== null && now-waitingSince > 10*60_000)) return true;
  if (!d) return false;
  if (d.failed_model || (d.key_created_at && !d.has_successful_request && now-Date.parse(d.key_created_at)>=15*60_000)) return true;
  const steps = new Map<string,number>();
  for(const e of d.events) if(e.status==='failed') { const key=`${e.garage_id}:${e.step}`; steps.set(key,(steps.get(key) ?? 0)+1); }
  return [...steps.values()].some(n=>n>=2);
}
export function shouldPrompt(stuck: boolean, storedDay: string | null, now=Date.now()) { return stuck && storedDay!==new Date(now).toISOString().slice(0,10); }
export const supportErrorEvent = 'garageai:support-error';
export function reportSupportError(text: string) { if(typeof window!=='undefined') window.dispatchEvent(new CustomEvent(supportErrorEvent,{detail:redactSupport(text)})); }
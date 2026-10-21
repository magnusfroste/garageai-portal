import { supabase } from '@/integrations/supabase/client';
import type { SupportContext, SupportDiagnostics, SupportMessage, SupportStatus, SupportTag, SupportThread } from '@/models/types/support.types';

export const supportRepository = {
  async availability() { const {data,error}=await supabase.from('admin_settings').select('value').eq('key','support_chat').maybeSingle(); if(error) throw error; return data?.value; },
  async setAvailability(mode:string,awayUntil:string|null) { const {error}=await supabase.rpc('set_support_availability',{_mode:mode,_away_until:awayUntil ?? undefined}); if(error) throw error; },
  async threads(userId?: string) {
    let q = supabase.from('support_threads').select('*').order('created_at',{ascending:false});
    if(userId) q=q.eq('user_id',userId);
    const {data,error}=await q; if(error) throw error; return (data ?? []) as SupportThread[];
  },
  async messages(threadId: string) { const {data,error}=await supabase.from('support_messages').select('*').eq('thread_id',threadId).order('created_at'); if(error) throw error; return (data ?? []) as unknown as SupportMessage[]; },
  async send(body: string, threadId: string | null, context: SupportContext | null, tag: SupportTag, admin=false) { const {data,error}=await supabase.rpc('support_send',{_body:body,_thread_id:threadId ?? undefined,_context:context ? JSON.parse(JSON.stringify(context)) : undefined,_tag:tag,_admin:admin}); if(error) throw error; return data; },
  async manage(id: string, options: {status?:SupportStatus;tag?:SupportTag;read?:boolean;admin?:boolean}) { const {error}=await supabase.rpc('support_manage',{_thread_id:id,_status:options.status,_tag:options.tag,_read:options.read ?? false,_admin:options.admin ?? false}); if(error) throw error; },
  async diagnostics() { const {data,error}=await supabase.rpc('support_diagnostics'); if(error) throw error; return data as unknown as SupportDiagnostics; },
  async claimPrompt() { const {data,error}=await supabase.rpc('support_claim_prompt'); if(error) throw error; return data; },
  async avatar() { const {data,error}=await supabase.rpc('support_founder_avatar'); if(error) throw error; return data; },
  async users(ids:string[]) { if(!ids.length) return new Map<string,string>(); const {data,error}=await supabase.from('profiles').select('id,email').in('id',ids); if(error) throw error; return new Map((data ?? []).map(p=>[p.id,p.email])); },
};
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSupport } from '@/hooks/useSupport';
import { supportRepository } from '@/data/repositories/supportRepository';
import { sortSupport, SUPPORT_STATUSES, SUPPORT_TAGS, supportUnread } from '@/models/services/supportService';
import { SupportConversation } from './SupportConversation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { SupportStatus, SupportTag } from '@/models/types/support.types';
import { t } from '@/i18n';
import { SupportAvailabilitySetting } from './SupportAvailabilitySetting';

export function SupportInbox(){
  const support=useSupport(undefined,true);const threads=sortSupport(support.threads,true);const [selected,setSelected]=useState<string|null>(null);const [error,setError]=useState<string|null>(null);
  const thread=threads.find(t=>t.id===selected) ?? threads[0];
  const ids=[...new Set(threads.map(t=>t.user_id))];const users=useQuery({queryKey:['support-users',ids.join(',')],queryFn:()=>supportRepository.users(ids)});
  const update=async(status?:SupportStatus,tag?:SupportTag)=>{if(!thread)return;try{await supportRepository.manage(thread.id,{admin:true,status,tag});setError(null);support.invalidate();}catch{setError(t('Could not update the thread.'));}};
  useEffect(()=>{setError(null);},[thread?.id]);
  return <><SupportAvailabilitySetting/><div className="grid md:grid-cols-[17rem_1fr] min-h-[32rem] border-t">
    <div className="md:border-r py-3 space-y-1 max-h-96 md:max-h-[40rem] overflow-auto">{support.loading && <p>{t('Loading…')}</p>}{support.error && <p className="text-destructive">{t('Could not load messages.')}</p>}{!threads.length && !support.loading && <p className="text-sm text-muted-foreground">{t('No support conversations yet.')}</p>}{threads.map(item=><Button key={item.id} variant={thread?.id===item.id?'secondary':'ghost'} className="w-full h-auto justify-start text-left gap-2 py-3" onClick={()=>setSelected(item.id)}>{supportUnread(item,true) && <span className="h-2 w-2 shrink-0 rounded-full bg-primary"/>}<span className="min-w-0"><span className="block truncate">{users.data?.get(item.user_id) ?? item.user_id.slice(0,8)}</span><span className="block text-xs text-muted-foreground">{t(item.tag)} · {t(item.status)} · {new Date(item.created_at).toLocaleDateString()}</span></span></Button>)}</div>
    {thread && <div className="flex flex-col min-w-0 h-[min(42rem,80dvh)]"><div className="flex flex-wrap gap-2 p-3 border-b"><Select value={thread.tag} onValueChange={v=>void update(undefined,v as SupportTag)}><SelectTrigger aria-label={t('Support tag')} className="w-36"><SelectValue/></SelectTrigger><SelectContent>{SUPPORT_TAGS.map(tag=><SelectItem value={tag} key={tag}>{t(tag)}</SelectItem>)}</SelectContent></Select><Select value={thread.status} onValueChange={v=>void update(v as SupportStatus)}><SelectTrigger aria-label={t('Thread status')} className="w-36"><SelectValue/></SelectTrigger><SelectContent>{SUPPORT_STATUSES.map(status=><SelectItem value={status} key={status}>{t(status)}</SelectItem>)}</SelectContent></Select></div><SupportConversation threadId={thread.id} admin pending={support.send.isPending} error={error || (support.send.error?t('Could not send your message. Please try again.'):null)} onSend={async body=>{await support.send.mutateAsync({body,threadId:thread.id,context:null,tag:thread.tag});}}/></div>}
  </div></>;
}
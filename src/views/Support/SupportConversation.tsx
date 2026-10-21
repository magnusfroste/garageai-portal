import { useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { t } from '@/i18n';
import { useSupportMessages } from '@/hooks/useSupport';
import { supportRepository } from '@/data/repositories/supportRepository';
import type { SupportContext } from '@/models/types/support.types';

export function SupportContextView({context}:{context:SupportContext}) {
  return <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">{t('Attached: page, step, last error')}</summary><dl className="mt-2 space-y-1 break-words"><dt>{t('Page')}: {context.page}</dt><dt>{t('Step')}: {context.step || '—'}</dt><dt>{t('Last error')}: {context.last_error || '—'}</dt><dt>{context.browser} · {context.os}</dt>{context.garages.map((g,i)=><dt key={i}>{g.name} · {g.bridge_version} · {g.problem_codes.join(', ')}</dt>)}</dl></details>;
}

export function SupportConversation({threadId,admin=false,context,onRemoveContext,onSend,pending,error}:{threadId:string|null;admin?:boolean;context?:SupportContext|null;onRemoveContext?:()=>void;onSend:(body:string)=>Promise<void>;pending:boolean;error?:string|null}) {
  const messages=useSupportMessages(threadId);const [body,setBody]=useState('');const [localError,setLocalError]=useState<string|null>(null);const bottom=useRef<HTMLDivElement>(null);const rows=messages.data ?? [];
  useEffect(()=>{setBody('');setLocalError(null);},[threadId]);
  useEffect(()=>{bottom.current?.scrollIntoView({block:'nearest'});if(threadId && rows.length) void supportRepository.manage(threadId,{read:true,admin}).catch(()=>setLocalError(t('Could not mark messages as read.')));},[threadId,rows.length,rows[rows.length-1]?.id,admin]);
  const submit=async()=>{if(!body.trim())return;try{await onSend(body.trim());setBody('');setLocalError(null);}catch{setLocalError(t('Could not send your message. Please try again.'));}};
  return <div className="flex flex-col min-h-0 flex-1">
    <div className="flex-1 overflow-y-auto p-4 space-y-4" aria-live="polite">
      {messages.isLoading && <p className="text-sm text-muted-foreground">{t('Loading…')}</p>}
      {messages.error && <p className="text-sm text-destructive">{t('Could not load messages.')} <Button variant="link" onClick={()=>messages.refetch()}>{t('Try again')}</Button></p>}
      {!rows.length && !messages.isLoading && <p className="text-sm text-muted-foreground">{t('What can I help you with?')}</p>}
      {rows.map(m=><div key={m.id} className={m.sender===(admin?'admin':'user')?'ml-6':'mr-6'}><div className={m.sender==='admin'?'rounded-md bg-primary/10 p-3':'rounded-md bg-muted p-3'}><p className="text-xs font-medium mb-1">{m.sender==='admin'?'Magnus':t('You')}</p><p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>{m.context && <div className="mt-2"><SupportContextView context={m.context}/></div>}</div><time className="block mt-1 text-xs text-muted-foreground" dateTime={m.created_at}>{new Date(m.created_at).toLocaleString()}</time></div>)}
      <div ref={bottom}/>
    </div>
    <div className="border-t p-3 space-y-2 bg-background">
      {!admin && <p className="text-xs text-muted-foreground">{t('Magnus usually answers within a few hours.')}</p>}
      {!rows.length && context && <div className="flex items-start gap-2"><div className="flex-1 min-w-0"><SupportContextView context={context}/></div><Button variant="ghost" size="icon" className="h-6 w-6" aria-label={t('Remove attached context')} onClick={onRemoveContext}><X className="h-3 w-3"/></Button></div>}
      <form onSubmit={e=>{e.preventDefault();void submit();}} className="flex gap-2 items-end"><Textarea aria-label={t(admin?'Reply to user':'Message Magnus')} placeholder={t(admin?'Reply to user':'Message Magnus')} maxLength={4000} rows={3} value={body} onChange={e=>setBody(e.target.value)} className="min-h-20 max-h-40 resize-none"/><Button type="submit" size="icon" disabled={pending || !body.trim()} aria-label={t('Send message')}><Send className="h-4 w-4"/></Button></form>
      <div className="flex justify-between gap-2 text-xs"><p role="alert" className="text-destructive">{error || localError}</p><span className="text-muted-foreground tabular-nums">{body.length}/4000</span></div>
    </div>
  </div>;
}
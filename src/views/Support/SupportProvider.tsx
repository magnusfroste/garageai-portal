import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle, Minus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSession } from '@/hooks/useSession';
import { useMyGarages } from '@/hooks/useMyGarages';
import { useSupport, useSupportMessages } from '@/hooks/useSupport';
import { supportRepository } from '@/data/repositories/supportRepository';
import { reportSupportError, shouldPrompt, sortSupport, supportContext, supportErrorEvent, supportStuck, supportUnread } from '@/models/services/supportService';
import { SupportConversation } from './SupportConversation';
import { t } from '@/i18n';

const SupportUIContext=createContext<{open:()=>void;unread:boolean;header:boolean}>({open:()=>{},unread:false,header:false});
export function SupportHeaderButton(){const ui=useContext(SupportUIContext);return <Button variant="ghost" size="icon" className={ui.header?'relative h-8 w-8':'relative h-8 w-8 md:hidden'} onClick={ui.open} aria-label={t('Ask Magnus')} title={t('Ask Magnus')}><MessageCircle className="h-4 w-4"/>{ui.unread && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary"/>}</Button>;}

export function SupportProvider({children}:{children:React.ReactNode}) {
  const {session}=useSession(); const uid=session?.user.id;
  const {pathname}=useLocation(); const {garages}=useMyGarages();
  const support=useSupport(uid); const threads=sortSupport(support.threads); const current=threads.find(t=>t.status!=='closed') ?? null;
  const [expanded,setExpanded]=useState(false);const [bubble,setBubble]=useState(false);const [attach,setAttach]=useState(true);
  const [lastError,setLastError]=useState(''); const [repeated,setRepeated]=useState(false);const [waitingSince,setWaitingSince]=useState<number|null>(null); const [now,setNow]=useState(Date.now());
  const errors=useRef(new Map<string,number>());const seenToast=useRef(new Map<string|number,string>());const claiming=useRef(false);
  const diagnostics=useQuery({queryKey:['support-diagnostics',uid],enabled:!!uid,queryFn:supportRepository.diagnostics,refetchInterval:60_000});
  const avatar=useQuery({queryKey:['support-avatar',uid],enabled:!!uid,queryFn:supportRepository.avatar,staleTime:300_000});
  const header=pathname.startsWith('/dashboard/chat'); const unread=support.threads.some(t=>supportUnread(t));
  useEffect(()=>{setBubble(false);setExpanded(false);setLastError('');setRepeated(false);errors.current.clear();seenToast.current.clear();},[uid]);
  useEffect(()=>{
    const onError=(e:Event)=>{const text=(e as CustomEvent<string>).detail;if(!text)return;setLastError(text);const n=(errors.current.get(text)??0)+1;errors.current.set(text,n);if(n>=2)setRepeated(true);};
    const onWait=(e:Event)=>setWaitingSince((e as CustomEvent<number|null>).detail);
    window.addEventListener(supportErrorEvent,onError);window.addEventListener('garageai:support-waiting',onWait);
    const timer=setInterval(()=>{setNow(Date.now());for(const v of toast.getHistory()){if('type' in v && v.type==='error' && typeof v.title==='string' && seenToast.current.get(v.id)!==v.title){seenToast.current.set(v.id,v.title);reportSupportError(v.title);}}},1000);
    return ()=>{clearInterval(timer);window.removeEventListener(supportErrorEvent,onError);window.removeEventListener('garageai:support-waiting',onWait);};
  },[]);
  const stuck=supportStuck(diagnostics.data,waitingSince,repeated,now);
  useEffect(()=>{
    if(!uid || expanded || claiming.current || !stuck)return;
    const key=`garageai:support-prompt:${uid}`;let day:string|null=null;try{day=localStorage.getItem(key);}catch{}
    if(!shouldPrompt(stuck,day,now))return; claiming.current=true;
    void supportRepository.claimPrompt().then(claimed=>{try{localStorage.setItem(key,new Date(now).toISOString().slice(0,10));}catch{}if(claimed)setBubble(true);}).catch(()=>{}).finally(()=>{claiming.current=false;});
  },[uid,expanded,stuck,now]);
  const open=()=>{setExpanded(true);setBubble(false);setAttach(true);};
  const context=supportContext(pathname,diagnostics.data?.events[0]?.step ?? (waitingSince?'waiting':''),lastError,navigator.userAgent,garages);
  const face=<Avatar className="h-7 w-7"><AvatarImage src={avatar.data ?? undefined}/><AvatarFallback className="text-xs">MF</AvatarFallback></Avatar>;
  return <SupportUIContext.Provider value={{open,unread,header}}>{children}
    {!expanded && !header && <div className="fixed bottom-0 right-5 z-40 hidden md:block">{bubble && <div className="mb-2 flex items-center rounded-md border bg-background shadow-lg"><Button variant="ghost" size="sm" onClick={open}>{t('Stuck? Ask Magnus')}</Button><Button variant="ghost" size="icon" className="h-7 w-7" onClick={()=>setBubble(false)} aria-label={t('Dismiss support suggestion')}><X className="h-3 w-3"/></Button></div>}<Button variant="outline" aria-label={t('Ask Magnus')} className="h-12 w-56 justify-start gap-3 rounded-b-none bg-background shadow-lg" onClick={open}>{face}<span>{t('Ask Magnus')}</span>{unread && <span className="ml-auto h-2 w-2 rounded-full bg-primary"/>}</Button></div>}
    {!expanded && bubble && <div className={header?'fixed right-4 top-14 z-50 flex rounded-md border bg-background shadow-lg':'fixed right-4 top-14 z-50 flex rounded-md border bg-background shadow-lg md:hidden'}><Button variant="ghost" size="sm" onClick={open}>{t('Stuck? Ask Magnus')}</Button><Button variant="ghost" size="icon" className="h-8 w-8" onClick={()=>setBubble(false)} aria-label={t('Dismiss support suggestion')}><X className="h-3 w-3"/></Button></div>}
    {expanded && <section role="dialog" aria-label={t('Ask Magnus')} className="fixed inset-0 z-50 flex flex-col bg-background md:inset-auto md:bottom-0 md:right-5 md:w-96 md:h-[min(36rem,85dvh)] md:rounded-t-md md:border md:shadow-xl">
      <header className="flex items-center gap-3 border-b px-3 py-2">{face}<h2 className="text-sm font-semibold flex-1">{t('Ask Magnus')}</h2>{current && <Button variant="ghost" size="sm" onClick={async()=>{try{await supportRepository.manage(current.id,{status:'closed'});support.invalidate();}catch{setLastError(t('Could not close the thread.'));}}}>{t('Close thread')}</Button>}<Button variant="ghost" size="icon" className="h-8 w-8" onClick={()=>{setExpanded(false);support.invalidate();}} aria-label={t('Minimize support')}><Minus className="h-4 w-4"/></Button></header>
      {support.error && <p className="p-3 text-sm text-destructive">{t('Could not load messages.')}</p>}
      {!current && support.threads.length>0 && <details className="border-b p-3 text-xs"><summary>{t('Previous conversations')}</summary>{support.threads.map(thread=><details key={thread.id} className="mt-2"><summary>{new Date(thread.created_at).toLocaleDateString()} · {t(thread.status)}</summary><SupportHistory id={thread.id}/></details>)}</details>}
      <SupportConversation threadId={current?.id ?? null} context={attach?context:null} onRemoveContext={()=>setAttach(false)} pending={support.send.isPending || support.loading} error={support.send.error ? t('Could not send your message. Please try again.'):null} onSend={async(body)=>{await support.send.mutateAsync({body,threadId:current?.id ?? null,context:attach?context:null,tag:pathname.includes('connect')||pathname.includes('offer')?'connect':pathname.includes('chat')?'chat':pathname.includes('credits')?'billing':pathname.includes('garages')?'models':'other'});}}/>
    </section>}
  </SupportUIContext.Provider>;
}
function SupportHistory({id}:{id:string}){const q=useSupportMessages(id);return <div className="py-2 space-y-2">{q.data?.map(m=><p className="whitespace-pre-wrap break-words" key={m.id}><strong>{m.sender==='admin'?'Magnus':t('You')}: </strong>{m.body}</p>)}</div>;}
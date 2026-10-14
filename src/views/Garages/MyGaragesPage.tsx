import {useState} from 'react';
import {lifecycleLine} from '@/models/services/agentLifecycle';
import {Link,useSearchParams} from 'react-router-dom';
import {Pause,Play,Plus} from 'lucide-react';
import {BarChart,Bar,XAxis,Tooltip,ResponsiveContainer} from 'recharts';
import {Button} from '@/components/ui/button';
import {AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle} from '@/components/ui/alert-dialog';
import {garageRepository} from '@/data/repositories/garageRepository';
import {Switch} from '@/components/ui/switch';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {useMyGarages} from '@/hooks/useMyGarages';
import {useGarageModels} from '@/hooks/useGarageModels';
import {useManagedModels} from '@/hooks/useManagedModels';
import {useModelCatalog} from '@/hooks/useModelCatalog';
import {useMyGarageOverview} from '@/hooks/useMyGarageOverview';
import {myGarageStatus,runtimeStatKey} from '@/models/services/myGaragePresentation';
import type {GarageRow} from '@/data/repositories/garageRepository';
import {ManagedModelsSection} from './components/ManagedModels';
import {MyGarageDetails} from './components/MyGarageDetails';
import {GarageTermsBanner} from './components/GarageTermsBanner';
import {t} from '@/i18n';
import {toast} from 'sonner';

function GaragePage({garage:g,onDone}:{garage:GarageRow;onDone:()=>void}){
 const {byGarage,setOffered,pending}=useGarageModels([g.id]);
 const models=byGarage.get(g.id)??[];
 const managed=useManagedModels([g.id]);
 const {models:catalog}=useModelCatalog();
 const {overview,events,smart}=useMyGarageOverview(g.id);
 const stats=overview.data;
 const status=myGarageStatus(g,models);
 const memory=g.agent?.machine?.mem_total_mb!=null?g.agent.machine.mem_total_mb/1000:managed.machines.get(g.id)?.memoryGb??null;
 const money=(n:number|undefined)=>n==null?'—':new Intl.NumberFormat(undefined,{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
 const [noticeCount,setNoticeCount]=useState(1);
 const life=lifecycleLine(g.agent_state);
 return <>
  <section aria-label={t('Is it working?')} className="space-y-3">
   <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-sm"><span className={`h-2.5 w-2.5 rounded-full shrink-0 ${life?'bg-muted-foreground':status.online?'bg-success':'bg-warning'}`}/><span className="font-medium">{life?t(life.key,life.params):status.online?t('Online, answering requests'):g.paused_at?t('Paused'):t('Not answering requests')}</span>{life&&g.agent_state?.reason&&<span className="text-sm text-muted-foreground">{g.agent_state.reason}</span>}<span className="text-xs text-muted-foreground">{stats?.last_request_at?t('Last request {n} min ago',{n:Math.max(0,Math.round((Date.now()-Date.parse(stats.last_request_at))/60000))}):stats?.last_request_hour?t('Last request around {time}',{time:new Date(stats.last_request_hour).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}):t('No requests yet')}</span></div>
   {status.problems.map(p=><div key={p.code} className="text-sm text-warning-foreground"><p>{p.message}</p><p className="text-xs mt-1">{p.fix??t('Run garageai doctor on this machine to check and fix the problem.')}</p></div>)}
   {!life&&!status.online&&status.reason&&<p className="text-sm text-warning-foreground">{t(status.reason.text,status.reason.params)}</p>}
   {status.tunnelFailed&&<p className="text-xs text-warning-foreground">{t('Tunnel unavailable. Run garageai doctor on this machine.')}</p>}
   {status.runtimeFailed&&<p className="text-xs text-warning-foreground">{g.runtime_error??t('Start the model runtime on this machine, then run garageai doctor.')}</p>}
   {status.heartbeatMissing&&<p className="text-xs text-warning-foreground">{t('Bridge has stopped reporting. Wake the machine and run garageai doctor.')}</p>}
   {g.transport==='netbird'&&<p className="text-xs text-muted-foreground">{t('Transport')}: NetBird</p>}
  </section>
  <section aria-label={t('Is it earning?')} className="border-t border-border pt-5 space-y-4">
   <h2 className="text-base font-medium">{t('Earnings')}</h2>
   {overview.isError?<p className="text-sm text-destructive">{t('Could not load earnings.')} <Button variant="link" size="sm" onClick={()=>overview.refetch()}>{t('Try again')}</Button></p>:<div className="grid grid-cols-3 gap-3">{[['Today',stats?.today],['This week',stats?.week],['Total',stats?.total]].map(([label,value])=><div key={String(label)}><p className="text-xs text-muted-foreground">{t(String(label))}</p><p className="mt-1 text-xl sm:text-2xl font-semibold tabular-nums">{money(value as number|undefined)}</p></div>)}</div>}
   <div className="flex justify-between gap-3 flex-wrap text-xs text-muted-foreground"><span>{t('Requests per day · 14 days')}</span>{stats?.response_ms!=null&&<span>{t('Answers in {s} s',{s:(stats.response_ms/1000).toFixed(1)})}</span>}</div>
   <div className="h-24 w-full" role="img" aria-label={t('Requests per day · 14 days')}><ResponsiveContainer width="100%" height="100%"><BarChart data={stats?.daily??[]} margin={{top:0,right:0,bottom:0,left:0}}><XAxis dataKey="day" tickFormatter={day=>String(day).slice(8)} axisLine={false} tickLine={false} tick={{fill:'hsl(var(--muted-foreground))',fontSize:10}} interval={2}/><Tooltip cursor={false} content={({active,payload})=>active&&payload?.length?<div className="rounded border border-border bg-popover px-3 py-2 text-xs">{String(payload[0].payload.day)} · {t('{n} requests',{n:Number(payload[0].value)})}</div>:null}/><Bar dataKey="requests" fill="hsl(var(--primary))" radius={[2,2,0,0]} maxBarSize={28}/></BarChart></ResponsiveContainer></div>
  </section>
  <section aria-label={t('What does it offer?')} className="border-t border-border pt-5 space-y-4">
   <div className="flex items-center justify-between gap-3"><h2 className="text-base font-medium">{t('Models')}</h2>{!g.disabled&&g.connection_type!=='endpoint'&&<ManagedModelsSection garageId={g.id} runtime={g.runtime} installed={g.models} rows={managed.byGarage.get(g.id)??[]} memoryGb={memory} catalog={catalog} onRequest={managed.request} onCancel={managed.cancel} busy={managed.pending} showHistory={false}/>}</div>
   <div className="divide-y divide-border">{models.length===0?<p className="py-3 text-sm text-muted-foreground">{t('No models registered yet')}</p>:models.map(m=>{
    const cm=catalog.find(c=>c.name===m.canonical_model),pool=cm?.pool,member=pool?.members.find(p=>p.garage===g.name);
    const requests=stats?.models.filter(s=>s.model===m.model||s.model===runtimeStatKey(m.model)).reduce((n,s)=>n+s.requests,0)??0;
    const live=status.online&&m.offered&&m.installed&&m.status==='live'&&!m.paused_at;
    return <div key={m.model} className="py-3 flex items-center gap-3"><div className="min-w-0 flex-1 space-y-1"><p className="text-sm font-medium break-words">{m.canonical_model}</p><p className="text-xs text-muted-foreground">{member&&pool?t('{share}% of the pool, {n} garages',{share:Math.round(member.share*100),n:pool.members.length}):t('Not in the pool')} · {t('{n} requests this week',{n:requests})}</p></div><span className={`text-xs shrink-0 ${live?'text-success-foreground':'text-muted-foreground'}`}>{live?t('Live'):m.status==='testing'?t('Testing...'):m.status==='failed'?t('Failed'):t('Not offered')}</span>{g.connection_type!=='endpoint'&&<Switch aria-label={`${t('Offer')} ${m.canonical_model}`} checked={m.offered} disabled={!!pending||g.disabled} onCheckedChange={async on=>{try{await setOffered(g.name,m.model,on);}catch(e){toast.error(e instanceof Error?e.message:t('Unknown error'));}}}/>}</div>;
   })}</div>
   {g.connection_type!=='endpoint'&&<div className="flex items-start gap-3 border-t border-border pt-4"><Switch id={`smart-${g.id}`} checked={g.smart??false} disabled={smart.isPending||g.disabled} onCheckedChange={on=>smart.mutate({on,disk:g.smart_disk_gb??40})}/><div className="min-w-0"><label htmlFor={`smart-${g.id}`} className="text-sm font-medium cursor-pointer">{t('GarageAI manages my models')}</label><p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t('We fetch models that are in demand and fit your machine, and tell you why. Uses up to {gb} GB of disk.',{gb:g.smart_disk_gb??40})}</p></div></div>}
   {(events.data??[]).slice(0,noticeCount).map(e=><p key={e.id} className="text-xs text-muted-foreground">{e.action==='pull'?t('We requested {model} for {garage}: {n} requests/day, {garages} garages were not enough.',{model:e.model,garage:g.name,n:e.reason.requests_per_day??0,garages:e.reason.healthy_garages??0}):t('We requested removal of {model} from {garage}: no requests in 14 days.',{model:e.model,garage:g.name})}</p>)}
   {(events.data?.length??0)>noticeCount&&<Button size="sm" variant="link" className="px-0" onClick={()=>setNoticeCount(events.data?.length??1)}>{t('All Smart activity')}</Button>}
  </section>
  <MyGarageDetails garage={g} models={models} managed={managed} onDone={onDone}/>
  {!g.terms_accepted_at&&<GarageTermsBanner garages={[g]} onAccepted={onDone}/>}
 </>;
}
export default function MyGaragesPage(){
 const {garages,isLoading,isError,invalidate}=useMyGarages();
 const [params,setParams]=useSearchParams();
 const selected=garages.find(g=>g.id===params.get('garage'))??garages[0];
 return <div className="p-4 sm:p-6 space-y-5 max-w-4xl">
  <div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">{t('My garage')}</h1>{selected&&<p className="text-xs text-muted-foreground mt-1 font-mono">{selected.name}</p>}</div><Button asChild size="icon" variant="ghost" title={t('Add garage')} aria-label={t('Add garage')}><Link to="/connect"><Plus className="w-4 h-4"/></Link></Button></div>
  {garages.length>1&&<Tabs value={selected?.id} onValueChange={id=>setParams({garage:id})}><TabsList className="w-full justify-start overflow-x-auto bg-transparent border-b border-border rounded-none h-auto p-0">{garages.map(g=><TabsTrigger className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none py-2 text-xs" key={g.id} value={g.id}>{g.name}</TabsTrigger>)}</TabsList></Tabs>}
  {isLoading?<p className="text-sm text-muted-foreground">{t('Loading...')}</p>:isError?<p className="text-sm text-destructive">{t('Could not load your garages.')} <Button variant="link" onClick={invalidate}>{t('Try again')}</Button></p>:selected?<GaragePage key={selected.id} garage={selected} onDone={invalidate}/>:<div className="space-y-4 py-8"><p className="text-muted-foreground">{t('You have no garages yet')}</p><Button asChild><Link to="/connect">{t('Offer your GPU')}</Link></Button></div>}
 </div>;
}

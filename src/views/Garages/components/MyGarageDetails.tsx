import {useState} from 'react';
import {ChevronDown,Save,FlaskConical} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Collapsible,CollapsibleContent,CollapsibleTrigger} from '@/components/ui/collapsible';
import type {GarageRow,GarageModelRow} from '@/data/repositories/garageRepository';
import {garageRepository} from '@/data/repositories/garageRepository';
import {useSuggestedPrice} from '@/hooks/useSuggestedPrice';
import {useMyGarageOverview} from '@/hooks/useMyGarageOverview';
import {ManagedModelStatusList} from './ManagedModels';
import {BridgeAgentSection} from './BridgeAgentSection';
import {BridgeUpdateNotice} from './BridgeUpdateNotice';
import {useBridgeVersion} from '@/hooks/useBridgeVersion';
import {DeleteGarageButton} from './DeleteGarageButton';
import {LocationDisplaySetting} from './GarageOperatorControls';
import type {useManagedModels} from '@/hooks/useManagedModels';
import {toast} from 'sonner';
import {t} from '@/i18n';

function ModelPrice({garage:g,model:m}:{garage:GarageRow;model:GarageModelRow}){
 const {prices}=useMyGarageOverview(g.id);
 const suggestion=useSuggestedPrice(m.canonical_model,g.name);
 const [values,setValues]=useState([m.pool_input_cost_per_million??g.pool_input_cost_per_million??0,m.pool_output_cost_per_million??g.pool_output_cost_per_million??0,m.dedicated_input_cost_per_million??g.dedicated_input_cost_per_million??0,m.dedicated_output_cost_per_million??g.dedicated_output_cost_per_million??0].map(String));
 const labels=['Pool input','Pool output','Direct input','Direct output'];
 return <div className="py-4 border-b border-border space-y-2">
  <p className="text-sm font-medium break-words">{m.canonical_model}</p>
  <p className="text-xs text-muted-foreground">{t('Context window')}: {m.context_length?.toLocaleString()??'—'}</p>
  {suggestion.data && <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{t('Suggested input / output')}: ${suggestion.data.input} / ${suggestion.data.output}</span><Button size="sm" variant="ghost" onClick={()=>{const s=suggestion.data;if(s)setValues([s.input,s.output,s.input,s.output].map(String));}}>{t('Use suggestion')}</Button></div>}
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{labels.map((label,i)=><label key={label} className="space-y-1 text-xs text-muted-foreground">{t(label)}<Input aria-label={`${t(label)} ${m.canonical_model}`} type="number" min="0" max="10000" step="0.01" value={values[i]} onChange={e=>setValues(values.map((v,n)=>n===i?e.target.value:v))}/></label>)}</div>
  <Button size="sm" variant="outline" disabled={prices.isPending||values.some(v=>v.trim()===''||!Number.isFinite(Number(v))||Number(v)<0||Number(v)>10000)} onClick={()=>prices.mutate({model:m.model,values:values.map(Number)})}><Save className="w-3.5 h-3.5 mr-2"/>{t('Save prices')}</Button>
 </div>;
}
export function MyGarageDetails({garage:g,models,managed,onDone}:{garage:GarageRow;models:GarageModelRow[];managed:ReturnType<typeof useManagedModels>;onDone:()=>void}){
 const [open,setOpen]=useState(false),[testing,setTesting]=useState(false),[disk,setDisk]=useState(String(g.smart_disk_gb??40));
 const {latest,stable}=useBridgeVersion();
 const {smart}=useMyGarageOverview(g.id);
 const machine=g.agent?.machine;
 return <Collapsible open={open} onOpenChange={setOpen} className="border-t border-border">
  <CollapsibleTrigger asChild><Button variant="ghost" className="w-full justify-between px-0 h-14">{t('Details')}<ChevronDown className={`w-4 h-4 transition-transform ${open?'rotate-180':''}`}/></Button></CollapsibleTrigger>
  <CollapsibleContent className="space-y-6 pb-8">
   <section className="space-y-3"><h3 className="text-sm font-medium">Bridge</h3>{g.agent&&<BridgeAgentSection agent={g.agent} at={g.agent_at??null}/>}<BridgeUpdateNotice version={g.agent?.version} latest={latest} stable={stable}/>
   <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-xs"><dt className="text-muted-foreground">{t('Transport')}</dt><dd>{g.transport==='netbird'?'NetBird':t('Tunnel')}</dd><dt className="text-muted-foreground">{t('Tunnel address')}</dt><dd className="break-all">{g.tunnel_ip??g.mesh_ip??'—'}</dd><dt className="text-muted-foreground">{t('Machine ID')}</dt><dd className="break-all font-mono">{g.machine_id??'—'}</dd><dt className="text-muted-foreground">{t('Last heartbeat:')}</dt><dd>{g.last_heartbeat_at?new Date(g.last_heartbeat_at).toLocaleString():'—'}</dd></dl>
   {machine?<dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">{[['Power',machine.power==='ac'?t('Connected to power'):machine.power==='battery'?t('Battery'):'—'],['Load',machine.load_pct!=null?`${machine.load_pct}%`:'—'],['Memory',machine.mem_total_mb!=null?`${((machine.mem_total_mb-(machine.mem_free_mb??0))/1000).toFixed(1)} / ${(machine.mem_total_mb/1000).toFixed(1)} GB`:'—'],['Free disk',machine.disk_free_gb!=null?`${machine.disk_free_gb} GB`:'—']].map(([label,value])=><div key={label}><dt className="text-muted-foreground">{t(label)}</dt><dd className="mt-1">{value}</dd></div>)}</dl>:<p className="text-xs text-muted-foreground">{t('Machine report not received yet.')}</p>}
   </section>
   <section className="space-y-2"><h3 className="text-sm font-medium">{t('Smart disk budget')}</h3><div className="flex gap-2 items-center"><Input aria-label={t('Smart disk budget')} type="number" min="1" className="w-28" value={disk} onChange={e=>setDisk(e.target.value)}/><span className="text-xs text-muted-foreground">GB</span><Button size="sm" variant="outline" disabled={smart.isPending||!(Number(disk)>0)} onClick={()=>smart.mutate({on:g.smart??false,disk:Number(disk)})}>{t('Save')}</Button></div></section>
   <section><h3 className="text-sm font-medium">{t('Model prices · USD per million tokens')}</h3>{models.map(m=><ModelPrice key={m.model} garage={g} model={m}/>)}</section>
   <section className="space-y-3"><h3 className="text-sm font-medium">{t('Managed-model history')}</h3><ManagedModelStatusList rows={managed.byGarage.get(g.id)??[]} busy={managed.pending} onCancel={model=>managed.cancel({garageId:g.id,model})} onRemove={model=>managed.request({garageId:g.id,model,action:'remove'})}/></section>
   <LocationDisplaySetting garageId={g.id} value={g.location_display??'country'}/>
   <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={testing||!g.models.length} onClick={async()=>{setTesting(true);try{await garageRepository.retest(g.name);onDone();toast.success(t('Test done'));}catch(e){toast.error(e instanceof Error?e.message:t('Unknown error'));}finally{setTesting(false);}}}><FlaskConical className="w-4 h-4 mr-2"/>{testing?t('Testing...'):t('Test again')}</Button><DeleteGarageButton garage={g} operator onDone={onDone}/></div>
  </CollapsibleContent>
 </Collapsible>;
}
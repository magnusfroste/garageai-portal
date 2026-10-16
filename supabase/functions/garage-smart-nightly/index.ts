import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { planSmart, type SmartCandidate, type SmartManaged } from '../_shared/garageSmart.ts';
const json = (data:unknown,status=200) => new Response(JSON.stringify(data),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
Deno.serve(async req => {
 if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST') return json({error:'Method not allowed'},405);
 const admin=createClient(Deno.env.get('SUPABASE_URL') ?? '',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
 const secret=req.headers.get('x-cron-secret');
 if(!secret) return json({error:'Unauthorized'},401);
 const auth=await admin.rpc('verify_cron_secret',{secret});
 if(auth.error || auth.data!==true) return json({error:'Unauthorized'},401);
 try {
  const checked = <T>(r:{data:T;error:unknown}):T => {if(r.error) throw r.error;return r.data;};
  const garages=checked(await admin.from('garages').select('id,name,operator_id,smart,smart_disk_gb,created_at,runtime,models,agent,agent_at').eq('smart',true).eq('disabled',false).is('paused_at',null).eq('runtime','ollama')) ?? [];
  const demand=checked(await admin.rpc('smart_model_demand')) ?? [];
  const curated=checked(await admin.from('curated_models').select('model_name,ollama_tag,download_bytes,enabled').not('ollama_tag','is',null).limit(5000)) ?? [];
  const dm=new Map(demand.map((d:any)=>[d.model,d]));
  const unique=new Map<string,SmartCandidate>();
  for(const c of curated){if(!c.model_name || !c.ollama_tag || c.model_name.startsWith('probe/')) continue;const d:any=dm.get(c.model_name);const prev=unique.get(c.ollama_tag); if(prev && !c.enabled) continue; unique.set(c.ollama_tag,{model:c.model_name,tag:c.ollama_tag,bytes:c.download_bytes,requests7:c.enabled?Number(d?.requests_7d ?? 0):0,requests14:Number(d?.requests_14d ?? 0),healthy:Number(d?.healthy_garages ?? 0),keys7:c.enabled?Number(d?.distinct_keys_7d ?? 0):0});}
  const now=Date.now(), day=new Date(now).toISOString().slice(0,10);
  let changed=0;
  for(const g of garages){
   const rows=checked(await admin.from('garage_managed_models').select('*').eq('garage_id',g.id)) ?? [];
   const prior=checked(await admin.from('garage_smart_events').select('id').eq('garage_id',g.id).eq('day',day).maybeSingle());
   const report=checked(await admin.from('onboarding_events').select('memory_gb').eq('garage_id',g.id).not('memory_gb','is',null).order('created_at',{ascending:false}).limit(1).maybeSingle());
   const machine=g.agent?.machine;
   // A stale disk report cannot authorize a download. Removal remains possible.
   const fresh=g.agent_at && now-Date.parse(g.agent_at)<=24*3600000;
   const memory=Number(machine?.mem_total_mb)>0?Number(machine.mem_total_mb)/1000:Number(report?.memory_gb)>0?Number(report?.memory_gb):null;
   const choice=planSmart({smart:g.smart,createdAt:g.created_at,version:g.agent?.version,runtime:g.runtime,memoryGb:memory,diskFreeGb:fresh && typeof machine?.disk_free_gb==='number'?machine.disk_free_gb:null,diskBudgetGb:Number(g.smart_disk_gb),installed:g.models,managed:rows as SmartManaged[],candidates:[...unique.values()],changedToday:!!prior,now});
   if(!choice) continue;
   const event=checked(await admin.rpc('apply_smart_model_change',{_garage_id:g.id,_model:choice.model,_action:choice.action,_reason:choice.reason}));
   if(event) changed++;
  }
  return json({checked:garages.length,changed,email_delivery:'pending_sender_domain'});
 }catch(e){console.error('[garage-smart-nightly]',e instanceof Error?e.message:'Smart failed');return json({error:'Smart could not finish'},500);}
});
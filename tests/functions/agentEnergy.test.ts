import {expect,test} from 'bun:test';
import {parseEnergy,energyWindow} from '../../supabase/functions/_shared/agentEnergy';
import {parseAgent} from '../../supabase/functions/_shared/agentReport';
const sample={window_min:5,source:'nvidia-smi',wh:3.21,busy_wh:1.05,idle_wh:2.16,avg_w:38.5,peak_w:61,in_tokens:12000,out_tokens:2400,tokens_per_kwh:2285714,models:[{model:'qwen3:4b',out_tokens:2400,busy_wh:1.05,tokens_per_kwh:2285714}]};
test('sample heartbeat produces one complete window at heartbeat time',()=>{
 const agent=parseAgent({energy:sample,version:'v1.3.0'}).agent;
 expect(agent?.energy).toEqual(sample);
 if (!agent?.energy) throw new Error('Missing energy');
 expect(energyWindow('garage-id','2026-10-24T09:42:00Z',agent.energy)).toEqual({garage_id:'garage-id',at:'2026-10-24T09:42:00Z',window_min:5,source:'nvidia-smi',wh:3.21,busy_wh:1.05,out_tokens:2400,in_tokens:12000,models:sample.models});
});
test('negative Wh drops only energy and keeps heartbeat',()=>{
 expect(parseAgent({version:'v1.3.0',energy:{...sample,wh:-5},machine:{gpu_power_w:142}}).agent).toEqual({version:'v1.3.0',problems:[],machine:{gpu_power_w:142}});
});
test('all energy fields optional and unknown fields stripped',()=>{
 expect(parseEnergy({secret:'discard'})).toEqual({});
 expect(parseEnergy({models:[{model:'qwen3:4b'}]})).toEqual({models:[{model:'qwen3:4b'}]});
});
test('window_min bounds 1 through 60',()=>{
 for(const n of [1,60]) expect(parseEnergy({window_min:n})?.window_min).toBe(n);
 for(const n of [0,61,1.5]) expect(parseEnergy({window_min:n})).toBeUndefined();
});
for(const field of ['wh','busy_wh','idle_wh'] as const) test(`${field} bounds 0 through 5000`,()=>{
 for(const n of [0,5000]) expect(parseEnergy({[field]:n})?.[field]).toBe(n);
 for(const n of [-1,5001,NaN,Infinity,'3']) expect(parseEnergy({[field]:n})).toBeUndefined();
});
for(const field of ['avg_w','peak_w'] as const) test(`${field} bounds 0 through 10000`,()=>{
 for(const n of [0,10000]) expect(parseEnergy({[field]:n})?.[field]).toBe(n);
 for(const n of [-1,10001]) expect(parseEnergy({[field]:n})).toBeUndefined();
});
for(const field of ['in_tokens','out_tokens'] as const) test(`${field} integer counts 0 through 1e9`,()=>{
 for(const n of [0,1e9]) expect(parseEnergy({[field]:n})?.[field]).toBe(n);
 for(const n of [-1,1e9+1,0.5]) expect(parseEnergy({[field]:n})).toBeUndefined();
});
test('energy sources are exactly nvidia-smi and powermetrics',()=>{
 for(const source of ['nvidia-smi','powermetrics']) expect(parseEnergy({source})?.source).toBe(source);
 expect(parseEnergy({source:'other'})).toBeUndefined();
});
test('model list limited to 50 and model strings to 200',()=>{
 expect(parseEnergy({models:Array(50).fill({model:'x'.repeat(200)})})?.models?.length).toBe(50);
 for(const models of [Array(51).fill({model:'x'}),[{model:'x'.repeat(201)}],[{model:''}],[{model:3}],{}]) expect(parseEnergy({models})).toBeUndefined();
});
test('invalid model energy drops the whole energy object',()=>{
 for(const model of [{model:'x',out_tokens:1e9+1},{model:'x',busy_wh:-5},{model:'x',tokens_per_kwh:Infinity}]) expect(parseEnergy({models:[model]})).toBeUndefined();
});
test('malformed energy containers are ignored',()=>{
 for(const energy of [null,'bad',[],5]) expect(parseAgent({energy,version:'v1.3.0'}).agent).toEqual({problems:[],version:'v1.3.0'});
});
test('Bridge update details including refused self update are kept',()=>{
 const update={auto:true,last_check:'2026-10-24T09:42:00Z',last_update:'2026-10-23T09:42:00Z',last_error:'Self-update refused'};
 expect(parseAgent({update}).agent?.update).toEqual(update);
});
import type {GarageRow,GarageModelRow} from '@/data/repositories/garageRepository';
import {garageHealth} from './garageHealth';
export function myGarageStatus(g:GarageRow,models:GarageModelRow[],now=Date.now()){
 const h=garageHealth(g,models);
 const fresh=!!g.last_gateway_check_at && now-Date.parse(g.last_gateway_check_at)<15*60000;
 const online=fresh && h.live>0 && !g.paused_at && !g.disabled;
 const problems=(g.agent?.problems ?? []).filter(p=>p.severity!=='info');
 return {online,problems,reason:online?null:h.reason, heartbeatMissing:!!g.last_heartbeat_at && now-Date.parse(g.last_heartbeat_at)>15*60000, tunnelFailed:h.tunnel==='fail', runtimeFailed:h.runtime==='fail'};
}
export const runtimeStatKey=(model:string)=>model.replace(/[^A-Za-z0-9._-]/g,'-');
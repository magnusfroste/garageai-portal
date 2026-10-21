import { describe, expect, test } from 'bun:test';
import { shouldPrompt, supportContext, supportStuck, supportUnread } from '../../../src/models/services/supportService';
import type { SupportDiagnostics, SupportThread } from '../../../src/models/types/support.types';

const now=Date.parse('2026-10-21T21:48:00Z');
const d:SupportDiagnostics={key_created_at:null,has_successful_request:false,failed_model:false,events:[]};
describe('Ask Magnus stuck prompts',()=>{
 test('never fires just on login',()=>expect(supportStuck(d,null,false,now)).toBe(false));
 test('buyer waits fifteen minutes without a successful request',()=>{expect(supportStuck({...d,key_created_at:new Date(now-14*60_000).toISOString()},null,false,now)).toBe(false);expect(supportStuck({...d,key_created_at:new Date(now-15*60_000).toISOString()},null,false,now)).toBe(true);expect(supportStuck({...d,key_created_at:new Date(now-20*60_000).toISOString(),has_successful_request:true},null,false,now)).toBe(false);});
 test('connect waits more than ten minutes',()=>{expect(supportStuck(d,now-10*60_000,false,now)).toBe(false);expect(supportStuck(d,now-10*60_000-1,false,now)).toBe(true);});
 test('same step fails twice, not unrelated steps',()=>{const e={garage_id:'g',step:'runtime',status:'failed',created_at:'2026-10-21'};expect(supportStuck({...d,events:[e]},null,false,now)).toBe(false);expect(supportStuck({...d,events:[e,{...e,step:'register'}]},null,false,now)).toBe(false);expect(supportStuck({...d,events:[e,e]},null,false,now)).toBe(true);});
 test('acceptance failure prompts',()=>expect(supportStuck({...d,failed_model:true},null,false,now)).toBe(true));
 test('second error prompts',()=>expect(supportStuck(d,null,true,now)).toBe(true));
 test('each trigger claims only once per day, dismissal remains closed',()=>{for(const stuck of [supportStuck({...d,failed_model:true},null,false,now),supportStuck(d,null,true,now),supportStuck(d,now-11*60_000,false,now)]){expect(shouldPrompt(stuck,null,now)).toBe(true);expect(shouldPrompt(stuck,'2026-10-21',now)).toBe(false);expect(shouldPrompt(stuck,'2026-10-21',now+24*60*60_000)).toBe(true);}});
 test('context never includes query strings or keys',()=>{const c=supportContext('/dashboard/chat?key=sk-secret','runtime','Authorization: Bearer sk-sensitive token=hidden','Chrome/100 Windows',[]);expect(c.page).toBe('/dashboard/chat');expect(JSON.stringify(c)).not.toContain('sk-sensitive');expect(JSON.stringify(c)).not.toContain('hidden');expect(Object.keys(c).sort()).toEqual(['browser','garages','last_error','os','page','step']);});
 test('read receipts distinguish founder reply and user message',()=>{const t={last_user_message_at:'2026-10-21T10:00:00Z',last_admin_message_at:'2026-10-21T11:00:00Z',user_read_at:'2026-10-21T10:00:00Z',admin_read_at:'2026-10-21T11:00:00Z'} as SupportThread;expect(supportUnread(t)).toBe(true);expect(supportUnread(t,true)).toBe(false);});
});
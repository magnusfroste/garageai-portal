import {test,expect} from 'bun:test';
import {myGarageStatus} from '../../../src/models/services/myGaragePresentation';
import type {GarageRow,GarageModelRow} from '../../../src/data/repositories/garageRepository';
const now=Date.parse('2026-10-14T15:00:00Z');
const g={status:'online',runtime:'ollama',disabled:false,runtime_ok:true,mesh_connected:true,last_gateway_check_at:new Date(now).toISOString(),last_heartbeat_at:new Date(now).toISOString()} as GarageRow;
const models=[{installed:true,offered:true,status:'live'}] as GarageModelRow[];
test('My garage reports online only with fresh healthy signal and an offered live model',()=>{expect(myGarageStatus(g,models,now).online).toBe(true);expect(myGarageStatus({...g,last_gateway_check_at:new Date(now-16*60000).toISOString()},models,now).online).toBe(false);expect(myGarageStatus({...g,paused_at:new Date(now).toISOString()},models,now).online).toBe(false);});
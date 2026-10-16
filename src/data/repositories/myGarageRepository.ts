import {supabase} from '@/integrations/supabase/client';
export interface GarageOverview {today:number;week:number;total:number;last_request_at:string|null;last_request_hour:string|null;response_ms:number|null;daily:Array<{day:string;requests:number;earned?:number}>;models:Array<{model:string;requests:number}>}
export interface SmartEvent {id:string;model:string;action:string;created_at:string;reason:{requests_per_day?:number;requests_7d?:number;distinct_keys_7d?:number;healthy_garages?:number;kind?:string}}
export const myGarageRepository={
 async overview(id:string):Promise<GarageOverview|null>{const {data,error}=await supabase.rpc('operator_garage_overview',{_garage_id:id});if(error) throw error;return data as unknown as GarageOverview|null;},
 async events(id:string):Promise<SmartEvent[]>{const {data,error}=await supabase.from('garage_smart_events').select('id,model,action,reason,created_at').eq('garage_id',id).order('created_at',{ascending:false}).limit(20);if(error) throw error;return data as unknown as SmartEvent[];},
 async smart(id:string,smart:boolean,disk:number){const {error}=await supabase.rpc('set_garage_smart',{_garage_id:id,_smart:smart,_disk_gb:disk});if(error) throw error;},
 async prices(id:string,model:string,poolInput:number,poolOutput:number,directInput:number,directOutput:number){const {error}=await supabase.rpc('set_operator_model_prices',{_garage_id:id,_model:model,_pool_input:poolInput,_pool_output:poolOutput,_direct_input:directInput,_direct_output:directOutput});if(error) throw error;},
};
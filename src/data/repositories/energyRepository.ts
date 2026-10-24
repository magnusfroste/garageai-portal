import { supabase } from '@/integrations/supabase/client';
import type { GarageEnergy } from '@/models/services/garageEnergy';
export const energyRepository = {
 async garage(id: string): Promise<GarageEnergy | null> {
  const {data,error} = await supabase.rpc('garage_energy_summary',{_garage_id:id});
  if (error) throw error;
  return data as unknown as GarageEnergy | null;
 },
 async publicModel(model: string) {
  const {data,error} = await supabase.rpc('garage_public_energy',{_model:model});
  if (error) throw error;
  return data ?? [];
 }
};

import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {myGarageRepository} from '@/data/repositories/myGarageRepository';
import {t} from '@/i18n';
export function useMyGarageOverview(id:string){
 const qc=useQueryClient();
 const overview=useQuery({queryKey:['my-garage-overview',id],enabled:!!id,queryFn:()=>myGarageRepository.overview(id),refetchInterval:60000});
 const events=useQuery({queryKey:['smart-events',id],enabled:!!id,queryFn:()=>myGarageRepository.events(id),refetchInterval:60000});
 const smart=useMutation({mutationFn:({on,disk}:{on:boolean;disk:number})=>myGarageRepository.smart(id,on,disk),onSuccess:()=>qc.invalidateQueries({queryKey:['my-garages']}),onError:(e)=>toast.error(e.message)});
 const prices=useMutation({mutationFn:({model,values}:{model:string;values:number[]})=>myGarageRepository.prices(id,model,values[0],values[1],values[2],values[3]),onSuccess:()=>{qc.invalidateQueries({queryKey:['garage-models']});toast.success(t('Prices saved'));},onError:(e)=>toast.error(e.message)});
 return {overview,events,smart,prices};
}
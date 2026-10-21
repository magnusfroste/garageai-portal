import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supportRepository } from '@/data/repositories/supportRepository';
import type { SupportContext, SupportTag } from '@/models/types/support.types';
import { useEffect, useState } from 'react';
import { supportAvailability } from '@/models/services/supportService';

export function useSupportAvailability(){
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),30_000);return ()=>clearInterval(id);},[]);
  const q=useQuery({queryKey:['support-availability'],queryFn:supportRepository.availability,refetchInterval:15_000});
  return {...q,...supportAvailability(q.data,now)};
}

export function useSupport(userId?:string, admin=false) {
  const qc=useQueryClient();
  const threads=useQuery({queryKey:['support-threads',admin?'admin':userId],enabled:admin || !!userId,queryFn:()=>supportRepository.threads(admin?undefined:userId),refetchInterval:15_000});
  const invalidate=()=>qc.invalidateQueries({queryKey:['support-threads']});
  const send=useMutation({mutationFn:(v:{body:string;threadId:string|null;context:SupportContext|null;tag:SupportTag})=>supportRepository.send(v.body,v.threadId,v.context,v.tag,admin),onSuccess:()=>{invalidate();qc.invalidateQueries({queryKey:['support-messages']});}});
  return {threads:threads.data ?? [],loading:threads.isLoading,error:threads.error,send,invalidate};
}
export function useSupportMessages(id:string|null) { return useQuery({queryKey:['support-messages',id],enabled:!!id,queryFn:()=>id?supportRepository.messages(id):Promise.resolve([]),refetchInterval:10_000}); }
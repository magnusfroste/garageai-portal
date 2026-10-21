import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSupportAvailability } from '@/hooks/useSupport';
import { supportRepository } from '@/data/repositories/supportRepository';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SupportMode } from '@/models/services/supportService';
import { t } from '@/i18n';

export function SupportAvailabilitySetting(){
  const setting=useSupportAvailability();const qc=useQueryClient();const [mode,setMode]=useState<SupportMode>('on');const [date,setDate]=useState('');const [saving,setSaving]=useState(false);const [error,setError]=useState('');
  useEffect(()=>{setMode(setting.mode);setDate(setting.away_until ?? '');},[setting.mode,setting.away_until]);
  const save=async()=>{setSaving(true);setError('');try{await supportRepository.setAvailability(mode,mode==='away'?date:null);await qc.invalidateQueries({queryKey:['support-availability']});}catch{setError(t('Could not save support availability. Please try again.'));}finally{setSaving(false);}};
  return <section className="pb-4 space-y-2"><h2 className="text-sm font-semibold">{t('Support chat')}</h2><div className="flex flex-wrap items-center gap-2"><Select value={mode} onValueChange={v=>setMode(v as SupportMode)}><SelectTrigger aria-label={t('Support chat')} className="w-40"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="on">{t('On')}</SelectItem><SelectItem value="away">{t('Away until')}</SelectItem><SelectItem value="off">{t('Off')}</SelectItem></SelectContent></Select>{mode==='away' && <Input type="date" aria-label={t('Away until')} value={date} min={new Date().toISOString().slice(0,10)} onChange={e=>setDate(e.target.value)} className="w-44"/>}<Button size="sm" onClick={()=>void save()} disabled={saving || setting.isLoading || (mode==='away' && !date)}>{t('Save')}</Button></div>{setting.error || error ? <p role="alert" className="text-sm text-destructive">{error || t('Could not load support availability.')}</p>:null}</section>;
}
import { useGarageEnergy } from '@/hooks/useGarageEnergy';
import { formatEnergyEfficiency, type GarageEnergy } from '@/models/services/garageEnergy';
import { t } from '@/i18n';
export function GarageEnergyToday({energy,source=false}:{energy:GarageEnergy|null|undefined;source?:boolean}) {
 if (!energy) return null;
 const {today}=energy;
 const efficiency=formatEnergyEfficiency(today.tokens_per_kwh);
 return <div className="space-y-1 text-sm tabular-nums">
  <p>{t('Energy today')}: {today.wh==null?'—':`${new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(today.wh)} Wh`}{efficiency&&<> · {efficiency}</>}</p>
  {source&&today.sources?.some(Boolean)&&<p className="text-xs text-muted-foreground">{t('Source')}: {today.sources.filter(Boolean).join(' · ')}</p>}
 </div>;
}
export function AdminGarageEnergy({id}:{id:string}) {
 const energy=useGarageEnergy(id);
 return <section className="space-y-3" aria-label={t('Energy')}>
  <h3 className="text-sm font-semibold">{t('Energy')}</h3>
  {energy.isError?<p className="text-xs text-destructive">{t('Could not load energy readings.')}</p>:<GarageEnergyToday energy={energy.data} source/>}
  {energy.data?.models.map(m=>{const efficiency=formatEnergyEfficiency(m.tokens_per_kwh);return efficiency?<p key={m.model} className="text-xs break-words">{m.canonical_model} · {efficiency} · {t('Last 7 days')}</p>:null;})}
  <p className="text-xs text-muted-foreground">{t('Tokens per kWh while serving: higher is more efficient. Idle power is not counted against the model.')}</p>
 </section>;
}

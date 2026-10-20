import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { garageRepository, type GarageRow, type GarageModelRow } from '@/data/repositories/garageRepository';
import { normaliseModelId } from '@/models/services/modelIdentity';
import { privateRoute } from '@/models/services/myMachineService';
import { t } from '@/i18n';
import { toast } from 'sonner';

export function MyMachineAccess({ garage: g, models, onDone }: { garage: GarageRow; models: GarageModelRow[]; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const qc = useQueryClient();
  const change = async (visibility: string) => {
    if (visibility !== 'market' && visibility !== 'private') return;
    setBusy(true);
    try {
      await garageRepository.setVisibility(g.id, visibility);
      onDone();
      for (const key of ['my-machines', 'catalog-rows', 'garage-public-stats', 'garage-public-models', 'garage-public-providers', 'curated-models', 'public-garages']) qc.invalidateQueries({ queryKey: [key] });
    } catch { toast.error(t('Could not update machine access. Please try again.')); }
    finally { setBusy(false); }
  };
  if (g.connection_type === 'endpoint') return null;
  return <section className="border-t border-border pt-5 space-y-4" aria-label={t('Who can use this machine')}>
    <h2 className="text-base font-medium">{t('Who can use this machine')}</h2>
    <RadioGroup value={g.visibility ?? 'market'} onValueChange={change} disabled={busy || g.disabled} className="gap-3">
      {(['market', 'private'] as const).map(value => <div key={value} className="flex items-start gap-3">
        <RadioGroupItem id={`${g.id}-${value}`} value={value} className="mt-0.5" />
        <div><Label htmlFor={`${g.id}-${value}`}>{t(value === 'market' ? 'Me and the market' : 'Only me')}</Label>
          <p className="mt-1 text-xs text-muted-foreground">{t(value === 'market' ? 'Use it free yourself, and offer models to buyers.' : 'Only you can use it. Your machine is hidden from buyers.')}</p></div>
      </div>)}
    </RadioGroup>
    <div className="space-y-2">
      {[...new Set(g.models.map(runtime => privateRoute(g.name, models.find(m => m.model === runtime)?.canonical_model ?? normaliseModelId(runtime))))].map(id =>
        <div key={id} className="flex items-start gap-2 text-xs text-muted-foreground">
          <p className="min-w-0 leading-relaxed">{t('Use it from anywhere: model')} <code className="break-all text-foreground">{id}</code>{t(', with any of your keys, free.')}</p>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title={t('Copy model ID')} aria-label={`${t('Copy model ID')} ${id}`} onClick={async () => {
            try { await navigator.clipboard.writeText(id); setCopied(id); setTimeout(() => setCopied(null), 1500); }
            catch { toast.error(t('Could not copy model ID.')); }
          }}>{copied === id ? <Check className="h-3.5 w-3.5 text-success-foreground" /> : <Copy className="h-3.5 w-3.5" />}</Button>
        </div>)}
    </div>
  </section>;
}
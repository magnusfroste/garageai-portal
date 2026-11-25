import { useState } from 'react';
import { Copy, KeyRound, RotateCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useManagementKeys } from '@/hooks/useManagementKeys';
import { expiryFromDate, isExpired, shortDate } from '@/models/services/managementKeyService';
import type { IssuedManagementKey, ManagementKey } from '@/models/types/managementKey.types';
import { lastUsedText } from '@/models/services/keyActivityService';

export const ManagementKeysSection = () => {
  const { list, create, rotate, revoke } = useManagementKeys();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [shown, setShown] = useState<IssuedManagementKey | null>(null);
  const [confirm, setConfirm] = useState<{ key: ManagementKey; action: 'rotate' | 'revoke' } | null>(null);
  const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not update management key');

  const submit = async () => {
    try { setShown(await create.mutateAsync({ name: name.trim(), expiresAt: expiryFromDate(expiry) })); setCreating(false); setName(''); setExpiry(''); }
    catch (e) { fail(e); }
  };
  const confirmAction = async () => {
    if (!confirm) return;
    try {
      if (confirm.action === 'rotate') setShown(await rotate.mutateAsync(confirm.key.id));
      else { await revoke.mutateAsync(confirm.key.id); toast.success('Management key revoked'); }
    } catch (e) { fail(e); } finally { setConfirm(null); }
  };
  const copy = async () => {
    if (!shown) return;
    try { await navigator.clipboard.writeText(shown.key); toast.success('Key copied'); } catch { toast.error('Could not copy. Select the key and copy it by hand.'); }
  };
  const keys = list.data ?? [];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Management key</h2>
          <p className="text-sm text-muted-foreground">Lets your server create and manage keys through the API. It cannot call models.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCreating(true)}><KeyRound className="mr-2 h-4 w-4" />Create management key</Button>
      </div>
      {list.isError && <p role="alert" className="text-sm text-destructive">{list.error.message}</p>}
      {keys.length === 0 && !list.isPending && <p className="text-sm text-muted-foreground">No management keys yet.</p>}
      <div className="space-y-2">
        {keys.map(key => (
          <div key={key.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/50 bg-card/50 p-3">
            <div className="min-w-0 space-y-1">
              <p className="break-words text-sm font-medium">{key.name}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="font-mono">gai-mgmt-…{key.key_last4}</span>
                <span>Created {shortDate(key.created_at)}</span>
                <span>Expires {key.expires_at ? shortDate(key.expires_at) : 'never'}</span>
                <span>Last used {key.last_used_at ? lastUsedText(key.last_used_at) : 'never'}</span>
                {isExpired(key) && <Badge variant="outline">expired</Badge>}
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setConfirm({ key, action: 'rotate' })}><RotateCw className="mr-1 h-4 w-4" />Rotate</Button>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirm({ key, action: 'revoke' })}><Trash2 className="mr-1 h-4 w-4" />Revoke</Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create management key</DialogTitle><DialogDescription>Use it from your server to create and manage API keys. It cannot call models.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label htmlFor="mk-name">Name</Label><Input id="mk-name" value={name} maxLength={80} onChange={e => setName(e.target.value)} placeholder="Production server" /></div>
            <div className="space-y-1"><Label htmlFor="mk-exp">Expires (optional)</Label><Input id="mk-exp" type="date" value={expiry} min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} onChange={e => setExpiry(e.target.value)} /></div>
          </div>
          <DialogFooter><Button onClick={submit} disabled={!name.trim() || create.isPending}>{create.isPending ? 'Creating…' : 'Create'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!shown} onOpenChange={o => { if (!o) setShown(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Management key “{shown?.name}”</DialogTitle><DialogDescription>Copy it now. It is shown only once.</DialogDescription></DialogHeader>
          <div className="flex items-center gap-2"><code className="min-w-0 flex-1 break-all rounded bg-muted p-2 font-mono text-xs">{shown?.key}</code><Button size="icon" variant="outline" onClick={copy} aria-label="Copy key"><Copy className="h-4 w-4" /></Button></div>
          <DialogFooter><Button onClick={() => setShown(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={o => { if (!o) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.action === 'rotate' ? 'Rotate management key?' : 'Revoke management key?'}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.action === 'rotate' ? 'A new value is created and the current one stops working at once.' : 'It stops working at once. Keys it created keep working.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmAction}>{confirm?.action === 'rotate' ? 'Rotate' : 'Revoke'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};

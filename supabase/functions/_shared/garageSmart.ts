import { isOpen, type ManagedRow } from './managedModels.ts';

export interface SmartCandidate { model: string; tag: string; bytes: number | null; requests7: number; requests14: number; healthy: number }
export interface SmartManaged extends ManagedRow { requested_at: string }
export interface SmartInput {
  smart: boolean; createdAt: string; version: string | undefined; runtime: string | null;
  memoryGb: number | null; diskFreeGb: number | null; diskBudgetGb: number;
  installed: string[]; managed: SmartManaged[]; candidates: SmartCandidate[];
  changedToday: boolean; now: number;
}
export interface SmartChange { model: string; action: 'pull' | 'remove'; reason: { requests_per_day: number; healthy_garages: number; size_gb: number | null; kind: 'demand' | 'unused' } }
export function supportsSmart(version?: string): boolean {
  const m = version?.match(/^(?:bridge-)?v?(\d+)\.(\d+)\.(\d+)$/);
  return !!m && (Number(m[1]) > 0 || Number(m[2]) >= 6);
}
/** Conservative: no telemetry/known sizes means no automatic download. One plan, never a batch. */
export function planSmart(i: SmartInput): SmartChange | null {
  if (!i.smart || i.runtime !== 'ollama' || !supportsSmart(i.version) || i.changedToday ||
      !Number.isFinite(Date.parse(i.createdAt)) || i.now - Date.parse(i.createdAt) < 86400_000 || i.managed.some(isOpen)) return null;
  const byTag = new Map(i.candidates.map(c => [c.tag, c]));
  const unused = i.managed.find(r => r.by === 'garageai' && r.action === 'pull' && r.status === 'ready' &&
    i.now - Date.parse(r.requested_at) >= 14 * 86400_000 && byTag.has(r.model) && byTag.get(r.model)?.requests14 === 0);
  if (unused) return { model: unused.model, action: 'remove', reason: { kind: 'unused', requests_per_day: 0, healthy_garages: byTag.get(unused.model)?.healthy ?? 0, size_gb: null } };
  if (i.memoryGb == null || i.diskFreeGb == null || !(i.diskBudgetGb > 0)) return null;
  let used = 0;
  for (const r of i.managed.filter(r => r.status !== 'removed')) {
    const bytes = byTag.get(r.model)?.bytes;
    const gb = r.total_mb != null && r.total_mb > 0 ? r.total_mb / 1000 : bytes != null && bytes > 0 ? bytes / 1e9 : null;
    if (gb == null) return null;
    used += gb;
  }
  const have = new Set([...i.installed, ...i.managed.filter(r => r.status !== 'removed').map(r => r.model)]);
  const choice = i.candidates.filter(c => {
    if (have.has(c.tag) || c.requests7 <= 0 || c.healthy >= 3 || c.bytes == null || c.bytes <= 0) return false;
    const gb = c.bytes / 1e9;
    return gb + 2 <= Number(i.memoryGb) && used + gb <= i.diskBudgetGb && Number(i.diskFreeGb) - gb >= 10;
  }).sort((a,b) => b.requests7 - a.requests7 || a.tag.localeCompare(b.tag))[0];
  return choice ? { model: choice.tag, action: 'pull', reason: { kind: 'demand', requests_per_day: Math.round(choice.requests7 / 7), healthy_garages: choice.healthy, size_gb: Number(choice.bytes) / 1e9 } } : null;
}
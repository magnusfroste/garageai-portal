import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { getCaller } from '../_shared/garageAuth.ts';
import { syncModels } from '../_shared/syncModels.ts';
const schema = z.object({ garage_id: z.string().uuid(), visibility: z.enum(['market','private']) }).strict();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const caller = await getCaller(req);
  if (caller instanceof Response) return json({ error: 'Sign in first' }, 401);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Choose Only me or Me and the market.' }, 400);
  try {
    const { admin, userId } = caller;
    const { garage_id, visibility } = parsed.data;
    const { data: garage, error } = await admin.from('garages').select('id,operator_id,connection_type').eq('id', garage_id).maybeSingle();
    if (error) throw error;
    if (!garage || garage.operator_id !== userId || garage.connection_type === 'endpoint') return json({ error: 'Machine not found' }, 404);
    const { error: saveError } = await admin.from('garages').update({ visibility }).eq('id', garage_id).eq('operator_id', userId);
    if (saveError) throw saveError;
    await syncModels(admin, { checkNonGarageHealth: false, enableNewGarageModels: true });
    return json({ ok: true, visibility, routing_synced: true });
  } catch (e) {
    console.error('[set-machine-visibility]', e instanceof Error ? e.message : 'unknown');
    return json({ error: 'Could not update machine access. Please try again.' }, 503);
  }
});
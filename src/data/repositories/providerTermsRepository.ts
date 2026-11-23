import { supabase } from "@/integrations/supabase/client";

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("provider-terms", { body });
  if (error) {
    let message = error.message;
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) message = j.error; } catch { /* keep */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export const providerTermsRepository = {
  record: (name: string, version: string, acceptedAt: string, note: string) => call({ name, action: "record", version, accepted_at: acceptedAt, note }),
  clear: (name: string, note: string) => call({ name, action: "clear", note }),
};

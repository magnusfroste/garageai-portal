import { supabase } from "@/integrations/supabase/client";
import type { BridgeLinkRequest } from "@/models/types/bridgeLink.types";

export class BridgeLinkError extends Error {
  constructor(public code: string, public extra: Record<string, unknown> = {}) { super(code); }
}

const call = async <T>(body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke("bridge-link-approve", { body });
  if (data?.error) throw new BridgeLinkError(data.error, data);
  if (error) {
    const ctx = (error as { context?: Response }).context;
    let j: Record<string, unknown> | null = null;
    try { j = ctx && typeof ctx.json === "function" ? await ctx.json() : null; } catch { j = null; }
    throw new BridgeLinkError(typeof j?.error === "string" ? j.error : error.message, j ?? {});
  }
  return data as T;
};

export const bridgeLinkRepository = {
  lookup: (userCode: string) => call<{ link: BridgeLinkRequest }>({ user_code: userCode, action: "lookup" }).then((r) => r.link),
  deny: (userCode: string) => call<{ status: string }>({ user_code: userCode, action: "deny" }),
  approve: (p: { userCode: string; garageName: string; termsAccepted: boolean; replaceMachine: boolean }) =>
    call<{ status: string; garage: { id: string; name: string } }>({
      user_code: p.userCode, action: "approve", garage_name: p.garageName, terms_accepted: p.termsAccepted, replace_machine: p.replaceMachine,
    }),
};

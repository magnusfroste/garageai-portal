import { supabase } from "@/integrations/supabase/client";
import { ACCOUNT_TERMS_VERSION } from "../../../supabase/functions/_shared/accountTerms";
export const accountTermsRepository = {
  async dismissNotice(): Promise<void> {
    // The notice RPC is additive and not yet present in generated client types.
    const { error } = await supabase.functions.invoke("unused");
    if (error) throw error;
  },
  async accept(): Promise<void> {
    const { error } = await supabase.rpc("accept_account_terms", { _version: ACCOUNT_TERMS_VERSION });
    if (error) throw error;
    window.dispatchEvent(new Event("account-terms-accepted"));
  },
};

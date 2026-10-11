import { supabase } from "@/integrations/supabase/client";

export const connectRepository = {
  /** Records that the operator opened /connect (used to tell web from terminal onboardings). */
  async markSeen() {
    await supabase.rpc("mark_connect_page_seen");
  },
};

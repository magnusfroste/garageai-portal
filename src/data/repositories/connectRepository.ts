import { supabase } from "@/integrations/supabase/client";

const TUNNEL_KEY = "bridge_tunnel_choice";

export const connectRepository = {
  /** Records that the operator opened /connect (used to tell web from terminal onboardings). */
  async markSeen() {
    await supabase.rpc("mark_connect_page_seen");
  },

  /** The tunnel switch on /connect: remembered per browser, default off. */
  readTunnelChoice(): boolean {
    try {
      return localStorage.getItem(TUNNEL_KEY) === "on";
    } catch {
      return false;
    }
  },

  rememberTunnelChoice(tunnel: boolean) {
    try {
      localStorage.setItem(TUNNEL_KEY, tunnel ? "on" : "off");
    } catch {
      /* private mode: the choice just is not remembered */
    }
  },
};

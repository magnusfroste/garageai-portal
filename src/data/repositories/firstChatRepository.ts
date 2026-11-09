import { supabase } from "@/integrations/supabase/client";

export const firstChatRepository = {
  async current() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error("Not authenticated");
    return data.user;
  },
  async update(data: Record<string, unknown>) {
    const { error } = await supabase.auth.updateUser({ data });
    if (error) throw error;
  },
};
import { supabase } from "@/integrations/supabase/client";
import { ApiKey } from "@/models/types/apiKey.types";

const COLUMNS = "id, name, key_last4, kind, device_label, created_at, expires_at, revoked_at, is_active";

export class ApiKeyRepository {
  async findByUserId(userId: string): Promise<ApiKey[]> {
    const { data, error } = await supabase
      .from("api_keys")
      .select(COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as ApiKey[];
  }

  async rename(keyId: string, name: string): Promise<void> {
    const { error } = await supabase.rpc("rename_api_key", { _id: keyId, _name: name });
    if (error) throw error;
  }
}

export const apiKeyRepository = new ApiKeyRepository();

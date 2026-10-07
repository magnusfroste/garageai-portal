import { supabase } from "@/integrations/supabase/client";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

function functionUrl(type: string): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-data?type=${type}`;
}

export interface AdminCreditData {
  transactions: {
    id: string;
    amount_usd: number;
    credits_added: number;
    created_at: string;
    user_id: string;
    stripe_session_id: string | null;
    profiles: { full_name: string | null; email: string } | null;
  }[];
  totalRevenue: number;
}

export interface AdminKeyUserSummary {
  user_id: string;
  full_name: string | null;
  email: string;
  total_keys: number;
  active_keys: number;
  total_tokens: number;
}

export interface AdminKeyData {
  keys: {
    id: string;
    name: string;
    is_active: boolean;
    created_at: string;
    revoked_at: string | null;
    user_id: string;
    profiles: { full_name: string | null; email: string } | null;
  }[];
  userSummary: AdminKeyUserSummary[];
}

export interface AdminUsageData {
  totalCost: number;
  totalTokens: number;
  totalRequests: number;
  topModels: { model: string; runtime_models?: string[]; cost: number; tokens: number; requests: number }[];
  topUsers: { user_id: string; email: string; full_name: string | null; cost: number; requests: number }[];
}

export const adminDataRepository = {
  async fetchCredits(): Promise<AdminCreditData> {
    const headers = await getAuthHeaders();
    const resp = await fetch(functionUrl("credits"), { headers });
    if (!resp.ok) throw new Error("Failed to fetch credit data");
    return resp.json();
  },

  async fetchKeys(): Promise<AdminKeyData> {
    const headers = await getAuthHeaders();
    const resp = await fetch(functionUrl("keys"), { headers });
    if (!resp.ok) throw new Error("Failed to fetch key data");
    return resp.json();
  },

  async fetchUsage(): Promise<AdminUsageData> {
    const headers = await getAuthHeaders();
    const resp = await fetch(functionUrl("usage"), { headers });
    if (!resp.ok) throw new Error("Failed to fetch usage data");
    return resp.json();
  },
};

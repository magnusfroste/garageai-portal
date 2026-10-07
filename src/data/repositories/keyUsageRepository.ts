import { supabase } from "@/integrations/supabase/client";

export interface KeyUsageInfo {
  key_name: string;
  key_alias: string;
  spend: number;
  max_budget: number;
  budget_remaining: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  models: string[];
  expires: string;
  metadata: Record<string, unknown>;
}

export interface SpendLog {
  request_id: string;
  startTime: string;
  model: string;
  /** Public route the buyer called (LiteLLM model group). */
  model_group?: string;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  spend: number;
  status: string;
  api_key?: string;
  model_id?: string;
  endTime?: string;
  latency?: number;
}

export interface DailyModelBreakdown {
  model: string;
  spend: number;
  total_tokens: number;
  api_requests: number;
}

export interface DailyBreakdown {
  date: string;
  spend: number;
  total_tokens: number;
  api_requests: number;
  models?: DailyModelBreakdown[];
}

export interface KeyUsagePayload {
  info: KeyUsageInfo;
  spend_logs: SpendLog[];
  daily_breakdown: DailyBreakdown[];
}

export const keyUsageRepository = {
  async fetchKeyUsage(keyId: string): Promise<KeyUsagePayload | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data, error } = await supabase.functions.invoke("get-key-usage", {
      body: { keyId },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (error) throw error;
    if (!data) throw new Error("Could not load API usage");
    return {
      info: data.info,
      spend_logs: data.spend_logs || [],
      daily_breakdown: data.daily_breakdown || [],
    };
  },
};

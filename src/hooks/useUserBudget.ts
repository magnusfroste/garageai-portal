import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { userBudgetRepository } from "@/data/repositories/userBudgetRepository";
import { UserBudget } from "@/models/types/userBudget.types";

export const useUserBudget = () => {
  const [budget, setBudget] = useState<UserBudget | null>(null);
  const [loading, setLoading] = useState(true);
  const retry = useRef<ReturnType<typeof setTimeout>>();
  const mounted = useRef(true);

  const fetchBudget = useCallback(async () => {
    clearTimeout(retry.current);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const data = await userBudgetRepository.fetchBudget();
      if (!mounted.current) return;
      setBudget(data);
      if (data.budget_pending) retry.current = setTimeout(() => { void fetchBudget(); }, data.retry_after_ms ?? 3000);
    } catch (error) {
      console.error("Error fetching user budget:", error);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void fetchBudget();
    return () => { mounted.current = false; clearTimeout(retry.current); };
  }, [fetchBudget]);

  return { budget, loading, refetch: fetchBudget };
};

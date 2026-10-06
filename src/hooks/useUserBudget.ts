import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { userBudgetRepository } from "@/data/repositories/userBudgetRepository";
import { UserBudget } from "@/models/types/userBudget.types";

export const useUserBudget = () => {
  const [budget, setBudget] = useState<UserBudget | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBudget = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const data = await userBudgetRepository.fetchBudget();
      setBudget(data);
    } catch (error) {
      console.error("Error fetching user budget:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudget();
  }, []);

  return { budget, loading, refetch: fetchBudget };
};

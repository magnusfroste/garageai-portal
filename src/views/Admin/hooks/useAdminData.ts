import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminService } from "@/models/services/adminService";
import { toast } from "sonner";

export const useAdminData = () => {
  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => adminService.getUsers(),
  });

  const isAdminQuery = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => adminService.isAdmin(),
  });

  const updateBudgetMutation = useMutation({
    mutationFn: ({ userId, maxBudget }: { userId: string; maxBudget: number }) =>
      adminService.updateLitellmBudget(userId, maxBudget),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Budget updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update budget: ${error.message}`);
    },
  });
  const repairMutation = useMutation({
    mutationFn: () => adminService.repairLiteLLMUsers(),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast.success(`Repaired ${r.repaired} LiteLLM users${r.failed ? `; ${r.failed} failed` : ""}`); },
    onError: (error: Error) => toast.error(`Repair failed: ${error.message}`),
  });

  return {
    users: usersQuery.data ?? [],
    isLoading: usersQuery.isLoading,
    isError: usersQuery.isError,
    isAdmin: isAdminQuery.data ?? false,
    isAdminLoading: isAdminQuery.isLoading,
    updateBudget: updateBudgetMutation.mutate,
    isUpdating: updateBudgetMutation.isPending,
    repairUsers: repairMutation.mutate,
    isRepairing: repairMutation.isPending,
  };
};

import { useState, useEffect } from "react";
import { AdminUser } from "@/models/types/admin.types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign } from "lucide-react";

interface EditUserDialogProps {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateBudget: (userId: string, maxBudget: number) => void;
  isUpdating: boolean;
}

export const EditUserDialog = ({
  user,
  open,
  onOpenChange,
  onUpdateBudget,
  isUpdating,
}: EditUserDialogProps) => {
  const [maxBudget, setMaxBudget] = useState(0);

  useEffect(() => {
    if (user) {
      setMaxBudget(user.litellm_budget?.max_budget ?? 0);
    }
  }, [user]);

  if (!user) return null;

  const handleUpdateBudget = () => {
    onUpdateBudget(user.id, maxBudget);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>
            {user.full_name || user.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" />
            <Label className="text-base font-semibold">LiteLLM Budget</Label>
          </div>

          {user.litellm_budget ? (
            <div className="text-sm text-muted-foreground space-y-1">
              <div>Current budget: <span className="font-semibold text-foreground">${user.litellm_budget.max_budget.toFixed(2)}</span></div>
              <div>Spent: <span className="font-semibold text-foreground">${user.litellm_budget.spend.toFixed(4)}</span></div>
              <div>Remaining: <span className="font-semibold text-accent">${(user.litellm_budget.max_budget - user.litellm_budget.spend).toFixed(2)}</span></div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {user.litellm_user_id ? "Could not fetch budget" : "No LiteLLM user created"}
            </p>
          )}

          {user.litellm_user_id && (
            <div className="space-y-2">
              <Label>New budget (USD)</Label>
              <Input
                type="number"
                min={0}
                step={5}
                value={maxBudget}
                onChange={(e) => setMaxBudget(Math.max(0, Number(e.target.value)))}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {user.litellm_user_id && (
            <Button onClick={handleUpdateBudget} disabled={isUpdating}>
              {isUpdating ? "Saving..." : "Update budget"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

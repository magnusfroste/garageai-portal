import { AdminUser } from "@/models/types/admin.types";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil } from "lucide-react";
import { format } from "date-fns";

interface UserTableProps {
  users: AdminUser[];
  onEdit: (user: AdminUser) => void;
  isUpdating: boolean;
}

export const UserTable = ({ users, onEdit, isUpdating }: UserTableProps) => {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Budget</TableHead>
            <TableHead>Spend</TableHead>
            <TableHead>Remaining</TableHead>
            <TableHead>Registered</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const remaining = user.litellm_budget
              ? user.litellm_budget.max_budget - user.litellm_budget.spend
              : null;
            return (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.full_name || "—"}
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  {user.litellm_budget ? (
                    <span className="font-medium">${user.litellm_budget.max_budget.toFixed(0)}</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {user.litellm_budget ? (
                    <span className="text-muted-foreground">${user.litellm_budget.spend.toFixed(2)}</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {remaining !== null ? (
                    <span className={remaining <= 0 ? "text-destructive font-medium" : "text-green-600 font-medium"}>
                      ${remaining.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(user.created_at), "yyyy-MM-dd")}
                </TableCell>
                <TableCell className="text-right space-y-1">
                  <div className="flex items-center justify-end gap-2">
                    {user.litellm_user_id && (
                      <span className="text-muted-foreground text-xs font-mono truncate max-w-[120px]" title={user.litellm_user_id}>
                        {user.litellm_user_id.slice(0, 8)}…
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(user)}
                      disabled={isUpdating}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                No users found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
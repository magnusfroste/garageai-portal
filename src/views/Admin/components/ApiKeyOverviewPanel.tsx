import { useQuery } from "@tanstack/react-query";
import { adminDataRepository, AdminKeyData } from "@/data/repositories/adminDataRepository";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";

export const ApiKeyOverviewPanel = () => {
  const { data, isLoading } = useQuery<AdminKeyData>({
    queryKey: ["admin-keys"],
    queryFn: () => adminDataRepository.fetchKeys(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeCount = data?.keys?.filter((k) => k.is_active).length || 0;
  const revokedCount = data?.keys?.filter((k) => k.revoked_at).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <div className="rounded-lg border p-4 flex-1">
          <p className="text-sm text-muted-foreground">Active keys</p>
          <p className="text-2xl font-bold text-primary">{activeCount}</p>
        </div>
        <div className="rounded-lg border p-4 flex-1">
          <p className="text-sm text-muted-foreground">Revoked</p>
          <p className="text-2xl font-bold text-destructive">{revokedCount}</p>
        </div>
        <div className="rounded-lg border p-4 flex-1">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{data?.keys?.length || 0}</p>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Tokens per user</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Keys (active/total)</TableHead>
                <TableHead>Total tokens</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.userSummary?.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{u.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {u.active_keys} / {u.total_keys}
                  </TableCell>
                  <TableCell className="font-mono text-sm font-medium">
                    {u.total_tokens.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {(!data?.userSummary || data.userSummary.length === 0) && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    No users with keys
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

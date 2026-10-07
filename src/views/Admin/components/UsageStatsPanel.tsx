import { useQuery } from "@tanstack/react-query";
import { adminDataRepository, AdminUsageData } from "@/data/repositories/adminDataRepository";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, BarChart3 } from "lucide-react";

export const UsageStatsPanel = () => {
  const { data, isLoading } = useQuery<AdminUsageData>({
    queryKey: ["admin-usage"],
    queryFn: () => adminDataRepository.fetchUsage(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total cost</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${data?.totalCost?.toFixed(4) || "0"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total tokens</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{(data?.totalTokens || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data?.totalRequests || 0}</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Top models
        </h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>Requests</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.topModels?.map((m) => (
                <TableRow key={m.model}>
                  <TableCell className="font-medium font-mono text-sm">{m.model}{m.runtime_models?.map((r) => <div key={r} className="text-xs font-normal text-muted-foreground">runtime: {r}</div>)}</TableCell>
                  <TableCell>${m.cost.toFixed(4)}</TableCell>
                  <TableCell>{m.tokens.toLocaleString()}</TableCell>
                  <TableCell>{m.requests}</TableCell>
                </TableRow>
              ))}
              {(!data?.topModels || data.topModels.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No usage recorded
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Top users</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Requests</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.topUsers?.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{u.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>${u.cost.toFixed(4)}</TableCell>
                  <TableCell>{u.requests}</TableCell>
                </TableRow>
              ))}
              {(!data?.topUsers || data.topUsers.length === 0) && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    No usage recorded
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

import { useQuery } from "@tanstack/react-query";
import { adminDataRepository, AdminCreditData } from "@/data/repositories/adminDataRepository";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Loader2 } from "lucide-react";
import { format } from "date-fns";

export const CreditOverviewPanel = () => {
  const { data, isLoading } = useQuery<AdminCreditData>({
    queryKey: ["admin-credits"],
    queryFn: () => adminDataRepository.fetchCredits(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Total revenue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">${data?.totalRevenue?.toFixed(2) || "0.00"}</p>
          <p className="text-sm text-muted-foreground">{data?.transactions?.length || 0} transactions</p>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Credits</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.transactions?.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{t.profiles?.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{t.profiles?.email}</div>
                  </div>
                </TableCell>
                <TableCell className="font-medium">${Number(t.amount_usd).toFixed(2)}</TableCell>
                <TableCell>${Number(t.credits_added).toFixed(2)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(t.created_at), "yyyy-MM-dd HH:mm")}
                </TableCell>
              </TableRow>
            ))}
            {(!data?.transactions || data.transactions.length === 0) && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No transactions yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

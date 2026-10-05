export type RevenuePeriod = "7d" | "30d" | "this_month" | "last_month";

interface Totals { requests: number; failures: number; promptTokens: number; completionTokens: number; revenue: number }

export interface RevenueRow extends Totals {
  garage: string; displayName: string | null; isProvider: boolean; model: string;
}

export interface GarageRevenue extends Totals {
  garage: string; displayName: string | null; isProvider: boolean;
  payable: number; models: Array<Totals & { model: string; payable: number }>;
}

export interface RevenueSummary { garages: GarageRevenue[]; totals: Totals & { payable: number }; feePercent: number }

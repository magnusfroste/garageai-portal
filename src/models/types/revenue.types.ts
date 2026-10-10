export type RevenuePeriod = "7d" | "30d" | "this_month" | "last_month";

/** promptTokens includes cachedTokens; the three revenue parts sum to `revenue` (rows ingested before cache tracking count fully as input). */
interface Totals { requests: number; failures: number; promptTokens: number; cachedTokens: number; completionTokens: number; revenue: number; inputRevenue: number; cachedRevenue: number; outputRevenue: number }

export interface RevenueRow extends Totals {
  garage: string; displayName: string | null; isProvider: boolean; model: string; runtimeModels: string[];
}

export interface GarageRevenue extends Totals {
  garage: string; displayName: string | null; isProvider: boolean;
  payable: number; models: Array<Totals & { model: string; runtimeModels: string[]; payable: number }>;
}

export interface RevenueSummary { garages: GarageRevenue[]; totals: Totals & { payable: number }; feePercent: number }

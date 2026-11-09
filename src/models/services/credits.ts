import { t } from "@/i18n";

/**
 * Display-only GarageAI credit formatting. Today 1 credit = 1 USD of usage,
 * so stored USD amounts are shown unchanged, labelled as credits.
 */
export const creditsText = (amount: string | number) => t("{n} credits", { n: amount });

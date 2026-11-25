/** Server-side mirror of src/models/services/credits.ts: 1 credit = 1 USD of usage. */
export const usdToCredits = (usd: number) => Math.round(usd * 1e6) / 1e6;

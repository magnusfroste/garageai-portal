export const buyerTierLabel = (tier: string | null): string | null => {
  if (tier === "dedicated") return "Specific garage";
  if (tier === "pool") return "Pool";
  return tier;
};
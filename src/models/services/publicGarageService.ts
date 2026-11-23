import type { GarageProfile, GarageReliability } from "@/models/types/reliability.types";
import { qualifiesEu, type GarageLocation } from "./location";
import type { GarageSupplyFact } from "@/models/types/catalog.types";
import { offerPlace, whereClass, type SupplyRow } from "./catalogPresentation";

export interface PublicGarage {
  profile: GarageProfile;
  location?: GarageLocation;
  reliability?: GarageReliability;
  providerName?: string;
  models: { model: string; private: boolean }[];
  supply?: GarageSupplyFact;
}
export type GarageSort = "grade" | "availability" | "name";
export const garageStatus = (p: GarageProfile) => p.paused ? "Paused" : p.online ? "Live" : "Offline";

export type PublicGarageStatus = ReturnType<typeof garageStatus> | "Degraded";

// Same semantic mapping as Admin → Supply: Live = success, Degraded = warning,
// Paused = neutral, Offline = danger when the garage still offers models, else neutral.
export const garageStatusTone = (status: PublicGarageStatus, hasOfferedModels: boolean): "success" | "warning" | "danger" | "neutral" =>
  status === "Live" ? "success" : status === "Degraded" ? "warning" : status === "Paused" ? "neutral" : hasOfferedModels ? "danger" : "neutral";
const rank = { A: 4, B: 3, C: 2, D: 1, Nytt: 0 };

export const filterSortGarages = (garages: PublicGarage[], euOnly: boolean, sort: GarageSort) => {
  const list = garages.filter((g) => !euOnly || qualifiesEu(g.location));
  const liveHours = (g: PublicGarage) => g.location?.is_endpoint ? 168 : g.location?.live_hours_per_week ?? -1;
  return list.sort((a, b) => Number(b.profile.online) - Number(a.profile.online)
    || (sort === "grade" ? (b.reliability ? rank[b.reliability.grade] : -1) - (a.reliability ? rank[a.reliability.grade] : -1)
      || (b.reliability?.score ?? -1) - (a.reliability?.score ?? -1)
      : sort === "availability" ? liveHours(b) - liveHours(a) : 0)
    || a.profile.display_name.localeCompare(b.profile.display_name));
};
/** One public supply-table row per listed garage/provider; private models are not listed. */
export const toSupplyRow = (g: PublicGarage): SupplyRow => {
  const forwardsTo = g.supply?.forwards_to ?? null;
  const hidden = !g.location || g.location.location_display === "hidden";
  const isProvider = !!(g.location?.is_endpoint || g.supply?.is_endpoint);
  const placeInput = { forwardsTo, location: g.location ?? null, isProvider, providerRegion: isProvider ? g.supply?.provider_region ?? null : undefined };
  return {
    name: g.profile.name,
    displayName: g.providerName ?? g.profile.display_name,
    kind: g.location?.is_endpoint || g.supply?.is_endpoint ? "provider" : "garage",
    countryCode: isProvider || forwardsTo || hidden ? null : g.location?.country ?? null,
    place: offerPlace(placeInput),
    forwardsTo,
    where: whereClass(placeInput),
    termsAccepted: !!g.supply?.terms_accepted,
    tokens1d: g.supply?.tokens_1d ?? 0,
    tokens30d: g.supply?.tokens_30d ?? 0,
    models: g.models.filter((m) => !m.private).map((m) => m.model),
  };
};

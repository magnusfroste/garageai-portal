import type { GarageProfile, GarageReliability } from "@/models/types/reliability.types";
import { qualifiesEu, type GarageLocation } from "./location";

export interface PublicGarage {
  profile: GarageProfile;
  location?: GarageLocation;
  reliability?: GarageReliability;
  providerName?: string;
  models: { model: string; private: boolean }[];
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
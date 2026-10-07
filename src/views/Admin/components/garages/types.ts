import type { GarageModelRow } from "@/data/repositories/garageRepository";
import type { GarageRevenue } from "@/models/types/revenue.types";
import type { AdminGaragePresentation } from "@/models/services/adminGaragePresentation";
import type { GarageLocation } from "@/models/services/location";
import type { GarageReliability } from "@/models/types/reliability.types";
import type { Garage, GarageModelTest } from "../../hooks/useGarages";

export interface AdminGarageRow {
  garage: Garage;
  models: GarageModelRow[];
  view: AdminGaragePresentation;
  reliability?: GarageReliability;
  location?: GarageLocation;
  revenue?: GarageRevenue;
  operatorEmail?: string;
  changedRecently: boolean;
  tests: Map<string, GarageModelTest>;
}

export interface GarageActionHandlers {
  onOpen: (garage: Garage) => void;
  onEditPrices: (garage: Garage) => void;
  onRetest: (garage: Garage) => void;
  onNewCredential: (garage: Garage) => void;
  onToggleDisabled: (garage: Garage) => void;
  onDelete: (garage: Garage) => void;
  retesting: string | null;
}
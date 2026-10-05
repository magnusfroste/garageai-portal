import { curatedModelRepository } from "@/data/repositories/curatedModelRepository";
import { CuratedModel } from "@/models/types/curatedModel.types";
import { dedupeByModelName } from "@/models/services/modelDedup";

export class CuratedModelService {
  async getAllModels(): Promise<CuratedModel[]> {
    return curatedModelRepository.fetchAll();
  }

  /** User-facing list: one entry per model_name (LiteLLM routing name). */
  async getEnabledModels(): Promise<CuratedModel[]> {
    return dedupeByModelName(await curatedModelRepository.fetchEnabled()).filter((model) => model.status !== "unhealthy");
  }

  async toggleModel(id: string, enabled: boolean): Promise<void> {
    return curatedModelRepository.toggleEnabled(id, enabled);
  }

  async setHuggingfaceUrl(id: string, url: string | null): Promise<void> {
    return curatedModelRepository.updateHuggingfaceUrl(id, url);
  }

  async setDefault(id: string): Promise<void> {
    return curatedModelRepository.setDefault(id);
  }

  async syncModels(): Promise<number> {
    return curatedModelRepository.syncFromLitellm();
  }
}

export const curatedModelService = new CuratedModelService();

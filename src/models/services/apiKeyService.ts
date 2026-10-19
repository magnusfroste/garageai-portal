import { supabase } from "@/integrations/supabase/client";
import { apiKeyRepository } from "@/data/repositories/apiKeyRepository";
import { ApiKey, CreateApiKeyDto, CreatedApiKey } from "@/models/types/apiKey.types";
import { accountTermsService } from "./accountTermsService";
import { keyCreateFailedMessage } from "./credentialErrors";

const asCreated = (d: Record<string, unknown> | null | undefined): CreatedApiKey | null =>
  d && typeof d.key === "string" && typeof d.id === "string"
    ? { id: d.id, key: d.key, name: String(d.name ?? ""), last4: String(d.last4 ?? d.key.slice(-4)) }
    : null;

export class ApiKeyService {
  async getKeysForCurrentUser(): Promise<ApiKey[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    return apiKeyRepository.findByUserId(user.id);
  }

  /** Creates a key and returns its value once; the portal keeps only the last 4 characters. */
  async createKey(dto: CreateApiKeyDto): Promise<CreatedApiKey> {
    await accountTermsService.requireAcceptance();
    const { data, error } = await supabase.functions.invoke("generate-api-key", {
      body: { keyName: dto.keyName, models: dto.models, showOnce: true },
    });
    const created = asCreated(data?.data);
    if (error || !created) throw new Error(keyCreateFailedMessage());
    return created;
  }

  /** The chat's own key for this browser. */
  async createChatKey(deviceLabel: string): Promise<CreatedApiKey> {
    const { data, error } = await supabase.functions.invoke("generate-api-key", {
      body: { kind: "chat", deviceLabel, showOnce: true },
    });
    const created = asCreated(data?.data);
    if (error || !created) throw new Error(keyCreateFailedMessage());
    return created;
  }

  /** Returns the account's "Default" key once, right after it is created; otherwise null. */
  async ensureDefaultKey(): Promise<CreatedApiKey | null> {
    const { data, error } = await supabase.functions.invoke("ensure-default-key", { body: {} });
    if (error) throw new Error(keyCreateFailedMessage());
    return data?.created ? asCreated(data) : null;
  }

  /** New key with the same name, shown once. The old key stays until revoked. */
  async rotateKey(keyId: string): Promise<CreatedApiKey> {
    await accountTermsService.requireAcceptance();
    const { data, error } = await supabase.functions.invoke("rotate-key", { body: { keyId } });
    const created = asCreated(data);
    if (error || !created) throw new Error(keyCreateFailedMessage());
    return created;
  }

  async revokeKey(keyId: string): Promise<void> {
    const { error } = await supabase.functions.invoke("revoke-key", { body: { keyId } });
    if (error) throw new Error("revoke_failed");
  }

  async renameKey(keyId: string, name: string): Promise<void> {
    await apiKeyRepository.rename(keyId, name);
  }
}

export const apiKeyService = new ApiKeyService();

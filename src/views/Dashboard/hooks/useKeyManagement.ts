import { useState } from "react";
import { apiKeyService } from "@/models/services/apiKeyService";
import { toast } from "sonner";
import { ACCOUNT_TERMS_REQUIRED } from "@/models/services/accountTermsService";
import { t } from "@/i18n";
import { keyCreateFailedMessage } from "@/models/services/credentialErrors";
import type { CreatedApiKey } from "@/models/types/apiKey.types";

const failure = (error: unknown) =>
  error instanceof Error && error.message === t(ACCOUNT_TERMS_REQUIRED) ? error.message : keyCreateFailedMessage();

export const useKeyManagement = () => {
  const [isCreatingKey, setIsCreatingKey] = useState(false);

  /** Returns the new key (to show once) or null. */
  const createKey = async (name: string, models: string[]): Promise<CreatedApiKey | null> => {
    if (!name.trim()) {
      toast.error(t("Please enter a key name"));
      return null;
    }
    setIsCreatingKey(true);
    try {
      return await apiKeyService.createKey({ keyName: name.trim(), models: models.length > 0 ? models : undefined });
    } catch (error) {
      toast.error(failure(error));
      return null;
    } finally {
      setIsCreatingKey(false);
    }
  };

  const rotateKey = async (keyId: string): Promise<CreatedApiKey | null> => {
    try { return await apiKeyService.rotateKey(keyId); }
    catch (error) { toast.error(failure(error)); return null; }
  };

  const renameKey = async (keyId: string, name: string): Promise<boolean> => {
    try { await apiKeyService.renameKey(keyId, name); toast.success(t("Key renamed")); return true; }
    catch { toast.error(t("The key could not be renamed. Try again in a minute.")); return false; }
  };

  const revokeKey = async (keyId: string): Promise<boolean> => {
    try { await apiKeyService.revokeKey(keyId); toast.success(t("Key revoked")); return true; }
    catch { toast.error(t("The key could not be revoked right now. Try again in a minute; if it keeps failing, write to hello@garageai.eu.")); return false; }
  };

  return { createKey, rotateKey, renameKey, revokeKey, isCreatingKey };
};

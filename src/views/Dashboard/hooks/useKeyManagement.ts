import { useState } from "react";
import { apiKeyService } from "@/models/services/apiKeyService";
import { toast } from "sonner";
import { ACCOUNT_TERMS_REQUIRED } from "@/models/services/accountTermsService";
import { t } from "@/i18n";
import { keyCreateFailedMessage } from "@/models/services/credentialErrors";

export const useKeyManagement = () => {
  const [isCreatingKey, setIsCreatingKey] = useState(false);

  const createKey = async (name: string, models: string[]) => {
    if (!name.trim()) {
      toast.error("Please enter a key name");
      return false;
    }

    setIsCreatingKey(true);
    try {
      await apiKeyService.createKey({
        keyName: name,
        models: models.length > 0 ? models : undefined,
      });
      
      toast.success("API key created successfully!");
      return true;
    } catch (error) {
      console.error("Error creating API key:", error);
      toast.error(error instanceof Error && error.message === t(ACCOUNT_TERMS_REQUIRED) ? error.message : keyCreateFailedMessage());
      return false;
    } finally {
      setIsCreatingKey(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("API key copied to clipboard!");
  };

  return {
    createKey,
    isCreatingKey,
    copyToClipboard,
  };
};

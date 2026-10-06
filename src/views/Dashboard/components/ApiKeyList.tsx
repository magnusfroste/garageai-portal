import { t } from "@/i18n";
import { Key } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiKey } from "@/models/types/apiKey.types";
import { ApiKeyCard } from "./ApiKeyCard";
import { KeyCreationDialog } from "./KeyCreationDialog";

interface ApiKeyListProps {
  apiKeys: ApiKey[];
  onCopy: (text: string) => void;
  onCreateKey: (name: string, models: string[]) => Promise<boolean>;
  isCreatingKey: boolean;
  canCreateMore: boolean;
  remainingKeys: number;
  onRevoke?: (keyId: string) => void;
  isRevoking?: boolean;
}

export const ApiKeyList = ({
  apiKeys,
  onCopy,
  onCreateKey,
  isCreatingKey,
  canCreateMore,
  remainingKeys,
  onRevoke,
  isRevoking,
}: ApiKeyListProps) => {
  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Key className="w-6 h-6" />
              {t("API keys")}
            </CardTitle>
            <CardDescription className="mt-2">
              {t("All keys share your account balance")}
            </CardDescription>
          </div>
          <KeyCreationDialog
            onCreateKey={onCreateKey}
            isCreating={isCreatingKey}
            canCreateMore={canCreateMore}
            remainingKeys={remainingKeys}
          />
        </div>
      </CardHeader>
      <CardContent>
        {apiKeys.length === 0 ? (
          <div className="text-center py-12">
            <Key className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">{t("No API keys yet — create one to start using models.")}</p>
            <KeyCreationDialog
              onCreateKey={onCreateKey}
              isCreating={isCreatingKey}
              canCreateMore={canCreateMore}
              remainingKeys={remainingKeys}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {apiKeys.map((key) => (
              <ApiKeyCard
                key={key.id}
                apiKey={key}
                onCopy={onCopy}
                onRevoke={onRevoke}
                isRevoking={isRevoking}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

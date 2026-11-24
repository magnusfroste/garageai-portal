import { t } from "@/i18n";
import { Key } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiKey } from "@/models/types/apiKey.types";
import { ApiKeyCard } from "./ApiKeyCard";
import { KeyCreationDialog } from "./KeyCreationDialog";
import type { KeyActivity } from '@/models/types/keyActivity.types';

interface ApiKeyListProps {
  apiKeys: ApiKey[];
  thisBrowserId?: string | null;
  onRotate?: (keyId: string) => void;
  onRename?: (keyId: string, name: string) => Promise<boolean>;
  onCreateKey: (name: string, models: string[]) => Promise<boolean>;
  isCreatingKey: boolean;
  canCreateMore: boolean;
  remainingKeys: number;
  onRevoke?: (keyId: string) => void;
  isRevoking?: boolean;
  activity?: KeyActivity[];
  activityLoading?: boolean;
  onDetails?: (key: ApiKey) => void;
}

export const ApiKeyList = ({
  apiKeys,
  thisBrowserId,
  onRotate,
  onRename,
  onCreateKey,
  isCreatingKey,
  canCreateMore,
  remainingKeys,
  onRevoke,
  isRevoking,
  activity,
  activityLoading,
  onDetails,
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
            {onDetails && <div className="hidden items-center gap-3 px-5 text-xs text-muted-foreground sm:flex"><span className="min-w-0 flex-1">Key</span><div className="grid grid-cols-[8rem_12rem] gap-4"><span>Last used</span><span>Tokens (30 days)</span></div><span className="w-[7.5rem]" /></div>}
            {apiKeys.map((key) => (
              <ApiKeyCard
                key={key.id}
                apiKey={key}
                thisBrowser={!!thisBrowserId && key.id === thisBrowserId}
                onRevoke={onRevoke}
                onRotate={onRotate}
                onRename={onRename}
                busy={isRevoking}
                activity={activity?.find(entry => entry.keyId === key.id)}
                activityLoading={activityLoading}
                onDetails={onDetails ? () => onDetails(key) : undefined}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

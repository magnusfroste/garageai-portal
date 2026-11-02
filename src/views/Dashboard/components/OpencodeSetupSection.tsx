import { CommandBlock } from "@/views/Garages/components/GarageShared";
import { opencodeSetupCommand } from "@/models/services/opencodeSetup";
import { t } from "@/i18n";

/** Collapsed one-paste OpenCode line for a key that is already shown in full. */
export const OpencodeSetupSection = ({ keyValue }: { keyValue: string }) => (
  <details className="rounded-md border border-border p-3">
    <summary className="cursor-pointer text-sm font-medium">{t("Use with OpenCode (macOS/Linux)")}</summary>
    <div className="mt-3 space-y-2 min-w-0">
      <CommandBlock command={opencodeSetupCommand(keyValue)} />
      <p className="text-xs text-muted-foreground">{t("Writes GarageAI into OpenCode's config (never overwrites yours), gives the key to OpenCode's background service and sends a test message. Windows: use the manual steps under Documentation → Agentic Coding Tools.")}</p>
    </div>
  </details>
);

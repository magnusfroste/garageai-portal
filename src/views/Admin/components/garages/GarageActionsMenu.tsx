import { Ban, Coins, FlaskConical, KeyRound, MoreHorizontal, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Garage } from "../../hooks/useGarages";
import type { GarageActionHandlers } from "./types";
import { t } from "@/i18n";

export const GarageActionsMenu = ({ garage, actions }: { garage: Garage; actions: GarageActionHandlers }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("Open menu")} onClick={(event) => event.stopPropagation()}>
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
      <DropdownMenuItem onSelect={() => actions.onEditPrices(garage)}><Coins className="mr-2 h-4 w-4" />{t("Edit prices")}</DropdownMenuItem>
      <DropdownMenuItem disabled={actions.retesting === garage.name || garage.models.length === 0} onSelect={() => actions.onRetest(garage)}>
        <FlaskConical className="mr-2 h-4 w-4" />{t(actions.retesting === garage.name ? "Testing..." : "Retest")}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => actions.onNewCredential(garage)}><KeyRound className="mr-2 h-4 w-4" />{t(garage.connection_type === "endpoint" ? "Update API key" : "New command")}</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => actions.onToggleDisabled(garage)}>
        {garage.disabled ? <Power className="mr-2 h-4 w-4" /> : <Ban className="mr-2 h-4 w-4" />}{t(garage.disabled ? "Enable" : "Disable")}
      </DropdownMenuItem>
      <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => actions.onDelete(garage)}><Trash2 className="mr-2 h-4 w-4" />{t("Delete")}</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
import { Check, Languages } from "lucide-react";
import {
  DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGUAGES, t } from "@/i18n";
import { useLanguagePreference } from "@/hooks/useLanguagePreference";

/** Language switcher inside the account menu (English / Svenska). */
export const LanguageMenu = () => {
  const { language, change } = useLanguagePreference();
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Languages className="w-4 h-4 mr-2" />
        {t("Language")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {LANGUAGES.map((l) => (
          <DropdownMenuItem key={l.id} onClick={() => void change(l.id)}>
            <Check className={`w-4 h-4 mr-2 ${language === l.id ? "opacity-100" : "opacity-0"}`} />
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
};

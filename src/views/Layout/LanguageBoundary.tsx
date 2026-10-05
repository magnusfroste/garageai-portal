import { Fragment, useEffect, type ReactNode } from "react";
import { useLanguage } from "@/i18n";

/** Re-renders the whole app tree when the UI language changes. */
export const LanguageBoundary = ({ children }: { children: ReactNode }) => {
  const lang = useLanguage();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return <Fragment key={lang}>{children}</Fragment>;
};

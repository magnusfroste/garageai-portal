import { useEffect } from "react";

/** Set the browser tab title for a page; call at the top of the page component. */
export const usePageTitle = (title: string) => {
  useEffect(() => {
    document.title = title;
  }, [title]);
};

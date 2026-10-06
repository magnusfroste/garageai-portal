import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

/** Shared catalogue preference; preserve unrelated query parameters. */
export const useEuOnly = () => {
  const [params, setParams] = useSearchParams();
  const euOnly = params.has("eu") ? params.get("eu") === "1" : localStorage.getItem("catalog-eu-only") === "1";
  useEffect(() => {
    localStorage.setItem("catalog-eu-only", euOnly ? "1" : "0");
    if (euOnly && !params.has("eu")) {
      const next = new URLSearchParams(params); next.set("eu", "1"); setParams(next, { replace: true });
    }
  }, [euOnly, params, setParams]);
  const setEuOnly = (checked: boolean) => {
    const next = new URLSearchParams(params); next.set("eu", checked ? "1" : "0"); setParams(next, { replace: true });
  };
  return { euOnly, setEuOnly };
};
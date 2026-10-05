import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useSession } from "@/hooks/useSession";

/** Sends signed-in users to the portal version of a public page. */
export const SessionRedirect = ({ to, children }: { to: string; children: ReactNode }) => {
  const { session, loading } = useSession();
  if (loading) return null;
  if (session) return <Navigate to={to} replace />;
  return <>{children}</>;
};

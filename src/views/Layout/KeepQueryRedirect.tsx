import { Navigate, useLocation } from "react-router-dom";

/** Redirect that keeps the query string (shared filter links keep working). */
export const KeepQueryRedirect = ({ to }: { to: string }) => {
  const { search } = useLocation();
  return <Navigate to={to + search} replace />;
};

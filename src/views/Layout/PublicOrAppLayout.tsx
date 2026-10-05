import { Outlet } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { useSession } from "@/hooks/useSession";
import { AppLayout } from "./AppLayout";

/** Pages readable by everyone: signed-in users get the portal shell, visitors the public nav. */
export const PublicOrAppLayout = () => {
  const { session, loading } = useSession();
  if (loading) return null;
  if (session) return <AppLayout />;
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-16 container mx-auto px-0 max-w-5xl">
        <Outlet />
      </main>
    </div>
  );
};

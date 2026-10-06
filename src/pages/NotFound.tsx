import { Link } from "react-router-dom";
import { Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";

const NotFound = () => (
  <main className="flex min-h-screen items-center justify-center bg-background p-6">
    <div className="max-w-md text-center space-y-5">
      <Warehouse className="mx-auto h-10 w-10 text-primary" />
      <h1 className="text-5xl font-semibold">404</h1>
      <h2 className="text-xl font-medium">{t("Page not found")}</h2>
      <p className="text-sm text-muted-foreground">{t("This page does not exist or has moved.")}</p>
      <Button asChild><Link to="/models">{t("Browse models")}</Link></Button>
    </div>
  </main>
);
export default NotFound;

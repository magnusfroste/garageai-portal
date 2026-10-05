import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import { AppLayout } from "./views/Layout/AppLayout";
import { DashboardActivity } from "./views/Dashboard/DashboardActivity";
import { LogsPage } from "./views/Logs/LogsPage";
import { CreditsPage } from "./views/Credits/CreditsPage";
import { AccountPage } from "./views/Account/AccountPage";
import { KeysPage } from "./views/Keys/KeysPage";
import { AdminPage } from "./views/Admin/AdminPage";
import { ChatPage } from "./views/Chat/ChatPage";
import OfferGpuPage from "./views/Garages/OfferGpuPage";
import MyGaragesPage from "./views/Garages/MyGaragesPage";
import GarageProfilePage from "./views/Garages/GarageProfilePage";
import { SiteSettingsPage } from "./views/SiteSettings/SiteSettingsPage";
import CatalogPage from "./views/Models/CatalogPage";
import ModelDetailPage from "./views/Models/ModelDetailPage";
import { KeepQueryRedirect } from "./views/Layout/KeepQueryRedirect";
import { ApiPage } from "./views/Models/ApiPage";
import { DashboardApiPage } from "./views/Models/DashboardApiPage";
import GaragesListPage from "./views/Garages/GaragesListPage";
import { PublicOrAppLayout } from "./views/Layout/PublicOrAppLayout";
import { SessionRedirect } from "./views/Layout/SessionRedirect";
import NotFound from "./pages/NotFound";
import { OnboardingPage } from "./views/Onboarding/OnboardingPage";

import { LanguageBoundary } from "./views/Layout/LanguageBoundary";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <LanguageBoundary>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/dashboard" element={<AppLayout />}>
            <Route index element={<DashboardActivity />} />
            <Route path="logs" element={<LogsPage />} />
            <Route path="credits" element={<CreditsPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="keys" element={<KeysPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="site-settings" element={<SiteSettingsPage />} />
            <Route path="models" element={<KeepQueryRedirect to="/models" />} />
            <Route path="api" element={<DashboardApiPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="offer-gpu" element={<OfferGpuPage />} />
            <Route path="garages" element={<MyGaragesPage />} />
          </Route>
          <Route path="/garages" element={<PublicOrAppLayout />}>
            <Route index element={<GaragesListPage />} />
            <Route path=":name" element={<GarageProfilePage />} />
          </Route>
          <Route path="/models" element={<PublicOrAppLayout />}>
            <Route index element={<CatalogPage />} />
            <Route path=":name" element={<ModelDetailPage />} />
          </Route>
          <Route path="/api" element={<SessionRedirect to="/dashboard/api"><ApiPage /></SessionRedirect>} />
          <Route path="/dashboard/developers" element={<Navigate to="/dashboard/api" replace />} />
          {/* Redirect old routes */}
          <Route path="/account" element={<Navigate to="/dashboard/account" replace />} />
          <Route path="/admin" element={<Navigate to="/dashboard/admin" replace />} />
          <Route path="/chat" element={<Navigate to="/dashboard/chat" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </LanguageBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

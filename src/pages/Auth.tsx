import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Warehouse } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { onboardingService } from "@/models/services/onboardingService";
import { lovable } from "@/integrations/lovable/index";

import { t } from "@/i18n";
const authSchema = z.object({
  email: z.string().email("Invalid email address").max(255, "Email too long"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100, "Password too long"),
  fullName: z.string().trim().max(100, "Name too long").optional(),
});

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [checkInbox, setCheckInbox] = useState(false);
  const { settings } = useSiteSettings();
  const siteName = settings?.site_name || "AI Portal";
  const logoUrl = settings?.logo_url;
  const intent = onboardingService.readUrlIntent(location.search);
  const params = new URLSearchParams(location.search);
  const initialTab = params.get("mode") === "signup" || !!intent ? "signup" : "signin";
  const starterCredit = Number(settings?.starting_credit_usd ?? 0);
  const heading = intent === "operator"
    ? t("Create an account and offer your GPU")
    : intent === "buyer"
      ? t("Create an account and get started with AI")
      : t("Welcome");

  const routeSession = async (session: { user: Parameters<typeof onboardingService.routeAfterLogin>[0] }) => {
    navigate(await onboardingService.routeAfterLogin(session.user), { replace: true });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) void routeSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) void routeSession(session);
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.search]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const validated = authSchema.parse({ email, password, fullName });
      if (intent) onboardingService.storeIntent(intent);
      const { data, error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          data: { full_name: validated.fullName || "", signup_intent: intent },
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });
      if (error) {
        toast.error(error.message.includes("already registered")
          ? t("This email is already registered. Please sign in instead.")
          : error.message);
      } else if (!data.session) {
        setCheckInbox(true);
      } else {
        toast.success(t("Account created! Welcome to {site}.", { site: siteName }));
      }
    } catch (error) {
      toast.error(error instanceof z.ZodError ? error.errors[0].message : t("An unexpected error occurred"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      if (intent) onboardingService.storeIntent(intent);
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(t("Could not sign in with Google. Please try again."));
        setIsLoading(false);
        return;
      }
      if (result.redirected) return; // browser redirects to Google
      // Session set — onAuthStateChange routes the user
    } catch {
      toast.error(t("Could not sign in with Google. Please try again."));
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const validated = authSchema.omit({ fullName: true }).parse({ email, password });
      const { error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });
      if (error) toast.error(error.message);
      else toast.success(t("Welcome back!"));
    } catch (error) {
      toast.error(error instanceof z.ZodError ? error.errors[0].message : t("An unexpected error occurred"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(circle at 30% 50%, hsla(263, 70%, 50%, 0.15), transparent 50%)'
      }} />
      
      <div className="w-full max-w-md relative z-10">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8 group">
          {logoUrl ? (
            <img src={logoUrl} alt={siteName} className="h-8 group-hover:scale-110 transition-transform" />
          ) : (
            <Warehouse className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
          )}
          <span className="text-2xl font-bold gradient-text">{siteName}</span>
        </Link>

        <Card className="glass-card border-border/50">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">{heading}</CardTitle>
            <CardDescription>
              {t("Sign in or create an account to continue")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="outline" className="w-full mb-4" onClick={handleGoogleSignIn} disabled={isLoading}>
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/>
                <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"/>
              </svg>
              {t("Continue with Google")}
            </Button>
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/50" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">{t("or")}</span></div>
            </div>
            {checkInbox ? (
              <div className="space-y-3 py-6 text-center" role="status">
                <h2 className="text-xl font-semibold">{t("Check your inbox")}</h2>
                <p className="text-sm text-muted-foreground">{t("Open the confirmation link we sent to {email} to finish creating your account.", { email })}</p>
              </div>
            ) : <Tabs defaultValue={initialTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">{t("Sign in")}</TabsTrigger>
                <TabsTrigger value="signup">{t("Create account")}</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">{t("Email")}</Label>
                    <Input id="signin-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">{t("Password")}</Label>
                    <Input id="signin-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? t("Signing in...") : t("Sign in")}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">{t("Name")}</Label>
                    <Input id="signup-name" type="text" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={isLoading} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">{t("Email")}</Label>
                    <Input id="signup-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">{t("Password")}</Label>
                    <Input id="signup-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} />
                  </div>
                  <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 space-y-2">
                     <p className="text-sm font-semibold text-accent">{t("Starter credit included:")}</p>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                       <li>{t("• {amount} USD in credits", { amount: starterCredit })}</li>
                       <li>{t("• All available models")}</li>
                       <li>{t("• No credit card required")}</li>
                    </ul>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? t("Creating account...") : t("Create account")}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;

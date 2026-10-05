import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { onboardingService } from "@/models/services/onboardingService";

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
  const { settings } = useSiteSettings();
  const siteName = settings?.site_name || "AI Portal";
  const logoUrl = settings?.logo_url;
  const intent = onboardingService.readUrlIntent(location.search);
  const heading = intent === "operator"
    ? "Skapa konto och erbjud din GPU"
    : intent === "buyer"
      ? "Skapa konto och kom igång med AI"
      : "Välkommen";

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
      const { error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          data: { full_name: validated.fullName || "", signup_intent: intent },
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });
      if (error) {
        toast.error(error.message.includes("already registered")
          ? "This email is already registered. Please sign in instead."
          : error.message);
      } else {
        toast.success(`Account created successfully! Welcome to ${siteName}.`);
      }
    } catch (error) {
      toast.error(error instanceof z.ZodError ? error.errors[0].message : "An unexpected error occurred");
    } finally {
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
      else toast.success("Welcome back!");
    } catch (error) {
      toast.error(error instanceof z.ZodError ? error.errors[0].message : "An unexpected error occurred");
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
            <Shield className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
          )}
          <span className="text-2xl font-bold gradient-text">{siteName}</span>
        </Link>

        <Card className="glass-card border-border/50">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">{heading}</CardTitle>
            <CardDescription>
              Logga in eller skapa ett konto för att fortsätta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Logga in</TabsTrigger>
                <TabsTrigger value="signup">Skapa konto</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">E-post</Label>
                    <Input id="signin-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Lösenord</Label>
                    <Input id="signin-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Loggar in..." : "Logga in"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Namn</Label>
                    <Input id="signup-name" type="text" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={isLoading} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">E-post</Label>
                    <Input id="signup-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Lösenord</Label>
                    <Input id="signup-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} />
                  </div>
                  <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 space-y-2">
                     <p className="text-sm font-semibold text-accent">Startkredit ingår:</p>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                       <li>• 25 USD i krediter</li>
                       <li>• Alla tillgängliga modeller</li>
                       <li>• Inget betalkort krävs</li>
                    </ul>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Skapar konto..." : "Skapa konto"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;

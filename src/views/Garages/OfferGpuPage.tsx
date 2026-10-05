import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Circle, Loader2, XCircle, Cpu, ShieldCheck, FlaskConical, ChevronDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/components/ui/use-toast";
import { useProfile } from "@/hooks/useProfile";
import { useGarageStatusPolling } from "@/hooks/useGarageStatusPolling";
import { garageRepository } from "@/data/repositories/garageRepository";
import {
  buildGarageCommand, GarageCredentials, GARAGE_NAME_RE, suggestGarageName,
} from "@/models/services/garageCommand";
import { OS_OPTIONS, OFFICIAL_RUNTIMES, OTHER_RUNTIMES, RUNTIME_OPTIONS, prepSteps, GarageOs, GarageRuntime } from "@/models/services/garageInstructions";
import { runtimeLabel, RUNTIMES_WITH_API_KEY } from "@/models/services/garageRuntime";
import { CommandBlock, OneTimeWarning } from "./components/GarageShared";

const STEPS = ["Din maskin", "Förbered", "Namnge", "Live"];

const CheckItem = ({ state, label, detail, action }: {
  state: "done" | "wait" | "fail" | "todo"; label: string; detail?: string; action?: React.ReactNode;
}) => (
  <div className="flex items-start gap-3 py-2">
    {state === "done" ? <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
      : state === "fail" ? <XCircle className="w-5 h-5 text-destructive shrink-0" />
      : state === "wait" ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground shrink-0" />
      : <Circle className="w-5 h-5 text-muted-foreground shrink-0" />}
    <div className="flex-1 min-w-0">
      <p className="text-sm">{label}</p>
      {detail && <p className="text-xs text-muted-foreground break-words">{detail}</p>}
    </div>
    {action}
  </div>
);

const OfferGpuPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useProfile();
  const [step, setStep] = useState(0);
  const [os, setOs] = useState<GarageOs>("macos");
  const [runtime, setRuntime] = useState<GarageRuntime>("ollama");
  const [otherPort, setOtherPort] = useState<8000 | 8080>(8000);
  const [otherRuntimesOpen, setOtherRuntimesOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [creds, setCreds] = useState<GarageCredentials | null>(null);
  const [liveName, setLiveName] = useState<string | null>(null);
  const [retesting, setRetesting] = useState(false);

  useEffect(() => {
    if (!name && profile?.email) setName(suggestGarageName(profile.email));
  }, [profile?.email, name]);

  const status = useGarageStatusPolling(liveName);
  const data = status.data;
  const meshOk = !!data?.mesh.connected;
  const registered = !!data?.garage.last_registered_at;
  const anyPassed = !!data?.latest_tests.some((t) => t.passed);

  const create = async () => {
    if (!GARAGE_NAME_RE.test(name)) {
      toast({ title: "Ogiltigt namn", description: "Små bokstäver, siffror och bindestreck (2–41 tecken).", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      setCreds(await garageRepository.create({ name, create_setup_key: true }));
    } catch (e) {
      toast({ title: "Kunde inte skapa garaget", description: e instanceof Error ? e.message : "Okänt fel", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const retest = async () => {
    if (!liveName) return;
    setRetesting(true);
    try {
      await garageRepository.retest(liveName);
      status.restart();
    } catch (e) {
      toast({ title: "Testet misslyckades", description: e instanceof Error ? e.message : "Okänt fel", variant: "destructive" });
    } finally {
      setRetesting(false);
    }
  };

  const osSupported = OS_OPTIONS.find((o) => o.value === os)?.supported;
  const port = runtime === "other" ? otherPort : RUNTIME_OPTIONS.find((r) => r.value === runtime)?.port;
  const apiKeyHelp = runtime === "paddock"
    ? "Byt ut <DIN_NYCKEL> mot nyckeln från Paddock. Nyckeln krävs."
    : RUNTIMES_WITH_API_KEY.includes(runtime)
      ? "Byt ut <DIN_NYCKEL> mot runtime-nyckeln. Om du inte använder någon nyckel kan du ta bort flaggan."
      : null;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Cpu className="w-6 h-6 text-primary" />Erbjud din GPU</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Anslut din dator som ett "garage" och låt den köra öppna modeller åt plattformen.
        </p>
      </div>

      <ol className="flex gap-2 flex-wrap text-xs">
        {STEPS.map((s, i) => (
          <li key={s} className={`px-3 py-1 rounded-full border ${i === step ? "border-primary text-primary" : i < step ? "border-primary/40 text-muted-foreground" : "border-border text-muted-foreground"}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Card className="glass-card">
          <CardHeader><CardTitle>Din maskin</CardTitle><CardDescription>Vilket operativsystem och vilken runtime använder du?</CardDescription></CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Operativsystem</Label>
              <RadioGroup value={os} onValueChange={(v) => setOs(v as GarageOs)} className="flex gap-4 flex-wrap">
                {OS_OPTIONS.map((o) => (
                  <div key={o.value} className="flex items-center gap-2">
                    <RadioGroupItem value={o.value} id={`os-${o.value}`} disabled={!o.supported} />
                    <Label htmlFor={`os-${o.value}`} className={`font-normal ${o.supported ? "" : "text-muted-foreground"}`}>{o.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>Runtime</Label>
              <RadioGroup value={runtime} onValueChange={(v) => setRuntime(v as GarageRuntime)} className="grid gap-2 sm:grid-cols-2">
                {OFFICIAL_RUNTIMES.map((r) => (
                  <Label key={r.value} htmlFor={`rt-${r.value}`} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-md border border-border p-3 font-normal">
                    <RadioGroupItem value={r.value} id={`rt-${r.value}`} className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-medium">
                        {r.label}
                        {r.beta && <span className="rounded border border-primary/40 px-1.5 py-0.5 text-[10px] text-primary">Beta</span>}
                      </span>
                      {r.description && <span className="mt-1 block text-xs text-muted-foreground">{r.description}</span>}
                    </span>
                  </Label>
                ))}
              </RadioGroup>
              <Collapsible open={otherRuntimesOpen} onOpenChange={setOtherRuntimesOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="h-9 w-full justify-between px-2">
                    Övriga
                    <ChevronDown className={`h-4 w-4 transition-transform ${otherRuntimesOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <RadioGroup value={runtime} onValueChange={(v) => setRuntime(v as GarageRuntime)} className="grid gap-2 sm:grid-cols-2">
                    {OTHER_RUNTIMES.map((r) => (
                      <Label key={r.value} htmlFor={`rt-${r.value}`} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-md border border-border p-3 font-normal">
                        <RadioGroupItem value={r.value} id={`rt-${r.value}`} className="mt-0.5" />
                        <span className="font-medium">{r.label}</span>
                      </Label>
                    ))}
                  </RadioGroup>
                </CollapsibleContent>
              </Collapsible>
              {runtime === "other" && (
                <div className="space-y-2 pt-2">
                  <Label>Port</Label>
                  <RadioGroup value={String(otherPort)} onValueChange={(value) => setOtherPort(value === "8080" ? 8080 : 8000)} className="flex gap-4">
                    {[8000, 8080].map((value) => (
                      <Label key={value} htmlFor={`port-${value}`} className="flex items-center gap-2 font-normal">
                        <RadioGroupItem value={String(value)} id={`port-${value}`} />{value}
                      </Label>
                    ))}
                  </RadioGroup>
                </div>
              )}
            </div>
            <Button onClick={() => setStep(1)} disabled={!osSupported}>Nästa</Button>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card className="glass-card">
          <CardHeader><CardTitle>Förbered</CardTitle><CardDescription>Se till att din runtime lyssnar på alla nätverksgränssnitt (port {port}).</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {prepSteps(os, runtime, port).map((s, i) => (
              <div key={i} className="space-y-1.5">
                <p className="text-sm">{i + 1}. {s.text}</p>
                {s.code && <CommandBlock command={s.code} />}
              </div>
            ))}
            <div className="flex gap-2 rounded-md border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
              <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
              <p>Din runtime exponeras inte mot internet så länge routern inte vidarebefordrar porten. Endast GarageAI-gatewayen når den, via det krypterade meshnätet.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(0)}>Tillbaka</Button>
              <Button onClick={() => setStep(2)}>Nästa</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="glass-card">
          <CardHeader><CardTitle>Namnge ditt garage</CardTitle><CardDescription>Namnet syns för plattformen och används i kommandot.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {!creds ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="g-name">Namn</Label>
                  <Input id="g-name" value={name} onChange={(e) => setName(e.target.value.toLowerCase())} disabled={creating} />
                  <p className="text-xs text-muted-foreground">Små bokstäver, siffror och bindestreck (2–41 tecken).</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)} disabled={creating}>Tillbaka</Button>
                  <Button onClick={create} disabled={creating || !name}>{creating ? "Skapar..." : "Skapa garage"}</Button>
                </div>
              </>
            ) : (
              <>
                <OneTimeWarning />
                <p className="text-sm">Kör detta i en terminal på maskinen:</p>
                <CommandBlock command={buildGarageCommand(creds, runtime, { sudo: os === "linux", port })} />
                {apiKeyHelp && <p className="text-xs text-muted-foreground">{apiKeyHelp}</p>}
                <Button onClick={() => { setLiveName(creds.garage.name); setCreds(null); setStep(3); }}>
                  Jag har kopierat och kört kommandot
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {step === 3 && liveName && (
        <Card className="glass-card">
          <CardHeader><CardTitle className="font-mono">{liveName}</CardTitle><CardDescription>Vi kontrollerar status var 5:e sekund.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            <CheckItem state={meshOk ? "done" : "wait"} label="Maskinen ansluten till nätet" />
            <CheckItem state={registered ? "done" : meshOk ? "wait" : "todo"} label="Garaget registrerat"
              detail={registered && data?.garage.runtime ? `${runtimeLabel(data.garage.runtime)}:${data.garage.port}` : undefined} />
            {registered && (data?.garage.models ?? []).map((m) => {
              const t = data?.latest_tests.find((x) => x.model === m);
              return (
                <CheckItem key={m}
                  state={!t ? "wait" : t.passed ? "done" : "fail"}
                  label={`Acceptanstest: ${m}`}
                  detail={!t ? undefined : t.passed
                    ? [t.tokens_per_second != null ? `${t.tokens_per_second} tok/s` : null, t.ttft_ms != null ? `TTFT ${t.ttft_ms} ms` : null].filter(Boolean).join(" · ")
                    : t.error ?? "Misslyckades"}
                  action={t && !t.passed ? (
                    <Button size="sm" variant="outline" onClick={retest} disabled={retesting}>
                      <FlaskConical className="w-3.5 h-3.5 mr-1.5" />{retesting ? "Testar..." : "Testa igen"}
                    </Button>
                  ) : undefined}
                />
              );
            })}

            {anyPassed && (
              <div className="rounded-md border border-primary/40 bg-primary/10 p-4 mt-4 space-y-3">
                <p className="font-semibold">Ditt garage är live!</p>
                <Button onClick={() => navigate("/dashboard/garages")}>Mina garage</Button>
              </div>
            )}

            {status.timedOut && !anyPassed && (
              <div className="rounded-md border border-border/60 bg-muted/30 p-4 mt-4 text-sm space-y-2">
                <p className="font-semibold">Det verkar ta längre tid än väntat. Vanliga orsaker:</p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                  <li>Runtimen lyssnar bara på localhost (127.0.0.1) – se steget Förbered.</li>
                  <li>Fel port – {RUNTIME_OPTIONS.find((r) => r.value === runtime)?.label} ska använda port {port}.</li>
                  <li>En brandvägg på maskinen blockerar inkommande trafik på porten.</li>
                </ul>
                <Button size="sm" variant="outline" onClick={status.restart}>Fortsätt kontrollera</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OfferGpuPage;

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
import { t } from "@/i18n";

const STEPS = ["Your machine", "Prepare", "Name", "Live"];

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
      toast({ title: t("Invalid name"), description: t("Lowercase letters, digits and hyphens (2–41 characters)."), variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      setCreds(await garageRepository.create({ name, create_setup_key: true }));
    } catch (e) {
      toast({ title: t("Could not create the garage"), description: e instanceof Error ? e.message : t("Unknown error"), variant: "destructive" });
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
      toast({ title: t("The test failed"), description: e instanceof Error ? e.message : t("Unknown error"), variant: "destructive" });
    } finally {
      setRetesting(false);
    }
  };

  const osSupported = OS_OPTIONS.find((o) => o.value === os)?.supported;
  const port = runtime === "other" ? otherPort : RUNTIME_OPTIONS.find((r) => r.value === runtime)?.port;
  const apiKeyHelp = runtime === "paddock"
    ? t("Replace <YOUR_KEY> with the key from Paddock. The key is required.")
    : RUNTIMES_WITH_API_KEY.includes(runtime)
      ? t("Replace <YOUR_KEY> with the runtime key. If you don't use a key you can remove the flag.")
      : null;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Cpu className="w-6 h-6 text-primary" />{t("Offer your GPU")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("Connect your computer as a \"garage\" and let it run open models for the platform.")}
        </p>
      </div>

      <ol className="flex gap-2 flex-wrap text-xs">
        {STEPS.map((s, i) => (
          <li key={s} className={`px-3 py-1 rounded-full border ${i === step ? "border-primary text-primary" : i < step ? "border-primary/40 text-muted-foreground" : "border-border text-muted-foreground"}`}>
            {i + 1}. {t(s)}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Card className="glass-card">
          <CardHeader><CardTitle>{t("Your machine")}</CardTitle><CardDescription>{t("Which operating system and runtime do you use?")}</CardDescription></CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>{t("Operating system")}</Label>
              <RadioGroup value={os} onValueChange={(v) => setOs(v as GarageOs)} className="flex gap-4 flex-wrap">
                {OS_OPTIONS.map((o) => (
                  <div key={o.value} className="flex items-center gap-2">
                    <RadioGroupItem value={o.value} id={`os-${o.value}`} disabled={!o.supported} />
                    <Label htmlFor={`os-${o.value}`} className={`font-normal ${o.supported ? "" : "text-muted-foreground"}`}>{t(o.label)}</Label>
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
                        {t(r.label)}
                        {r.beta && <span className="rounded border border-primary/40 px-1.5 py-0.5 text-[10px] text-primary">Beta</span>}
                      </span>
                      {r.description && <span className="mt-1 block text-xs text-muted-foreground">{t(r.description)}</span>}
                    </span>
                  </Label>
                ))}
              </RadioGroup>
              <Collapsible open={otherRuntimesOpen} onOpenChange={setOtherRuntimesOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="h-9 w-full justify-between px-2">
                    {t("Other")}
                    <ChevronDown className={`h-4 w-4 transition-transform ${otherRuntimesOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <RadioGroup value={runtime} onValueChange={(v) => setRuntime(v as GarageRuntime)} className="grid gap-2 sm:grid-cols-2">
                    {OTHER_RUNTIMES.map((r) => (
                      <Label key={r.value} htmlFor={`rt-${r.value}`} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-md border border-border p-3 font-normal">
                        <RadioGroupItem value={r.value} id={`rt-${r.value}`} className="mt-0.5" />
                        <span className="font-medium">{t(r.label)}</span>
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
            <Button onClick={() => setStep(1)} disabled={!osSupported}>{t("Next")}</Button>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card className="glass-card">
          <CardHeader><CardTitle>{t("Prepare")}</CardTitle><CardDescription>{t("Make sure your runtime listens on all network interfaces (port {port}).", { port: port ?? "" })}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {prepSteps(os, runtime, port).map((s, i) => (
              <div key={i} className="space-y-1.5">
                <p className="text-sm">{i + 1}. {s.text}</p>
                {s.code && <CommandBlock command={s.code} />}
              </div>
            ))}
            <div className="flex gap-2 rounded-md border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
              <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
              <p>{t("Your runtime is not exposed to the internet as long as your router does not forward the port. Only the GarageAI gateway reaches it, via the encrypted mesh network.")}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(0)}>{t("Back")}</Button>
              <Button onClick={() => setStep(2)}>{t("Next")}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="glass-card">
          <CardHeader><CardTitle>{t("Name your garage")}</CardTitle><CardDescription>{t("The name is visible to the platform and used in the command.")}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {!creds ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="g-name">{t("Name")}</Label>
                  <Input id="g-name" value={name} onChange={(e) => setName(e.target.value.toLowerCase())} disabled={creating} />
                  <p className="text-xs text-muted-foreground">{t("Lowercase letters, digits and hyphens (2–41 characters).")}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)} disabled={creating}>{t("Back")}</Button>
                  <Button onClick={create} disabled={creating || !name}>{creating ? t("Creating...") : t("Create garage")}</Button>
                </div>
              </>
            ) : (
              <>
                <OneTimeWarning />
                <p className="text-sm">{t("Run this in a terminal on the machine:")}</p>
                <CommandBlock command={buildGarageCommand(creds, runtime, { sudo: os === "linux", port })} />
                {apiKeyHelp && <p className="text-xs text-muted-foreground">{apiKeyHelp}</p>}
                <Button onClick={() => { setLiveName(creds.garage.name); setCreds(null); setStep(3); }}>
                  {t("I have copied and run the command")}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {step === 3 && liveName && (
        <Card className="glass-card">
          <CardHeader><CardTitle className="font-mono">{liveName}</CardTitle><CardDescription>{t("We check the status every 5 seconds.")}</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            <CheckItem state={meshOk ? "done" : "wait"} label={t("Machine connected to the network")} />
            <CheckItem state={registered ? "done" : meshOk ? "wait" : "todo"} label={t("Garage registered")}
              detail={registered && data?.garage.runtime ? `${runtimeLabel(data.garage.runtime)}:${data.garage.port}` : undefined} />
            {registered && (data?.garage.models ?? []).map((m) => {
              const tr = data?.latest_tests.find((x) => x.model === m);
              return (
                <CheckItem key={m}
                  state={!tr ? "wait" : tr.passed ? "done" : "fail"}
                  label={t("Acceptance test: {m}", { m })}
                  detail={!tr ? undefined : tr.passed
                    ? [tr.tokens_per_second != null ? `${tr.tokens_per_second} tok/s` : null, tr.ttft_ms != null ? `TTFT ${tr.ttft_ms} ms` : null].filter(Boolean).join(" · ")
                    : tr.error ?? t("Failed")}
                  action={tr && !tr.passed ? (
                    <Button size="sm" variant="outline" onClick={retest} disabled={retesting}>
                      <FlaskConical className="w-3.5 h-3.5 mr-1.5" />{retesting ? t("Testing...") : t("Test again")}
                    </Button>
                  ) : undefined}
                />
              );
            })}

            {anyPassed && (
              <div className="rounded-md border border-primary/40 bg-primary/10 p-4 mt-4 space-y-3">
                <p className="font-semibold">{t("Your garage is live!")}</p>
                <Button onClick={() => navigate("/dashboard/garages")}>{t("My garages")}</Button>
              </div>
            )}

            {status.timedOut && !anyPassed && (
              <div className="rounded-md border border-border/60 bg-muted/30 p-4 mt-4 text-sm space-y-2">
                <p className="font-semibold">{t("This seems to be taking longer than expected. Common causes:")}</p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                  <li>{t("The runtime only listens on localhost (127.0.0.1) – see the Prepare step.")}</li>
                  <li>{t("Wrong port – {runtime} should use port {port}.", { runtime: RUNTIME_OPTIONS.find((r) => r.value === runtime)?.label ?? "", port: port ?? "" })}</li>
                  <li>{t("A firewall on the machine blocks incoming traffic on the port.")}</li>
                </ul>
                <Button size="sm" variant="outline" onClick={status.restart}>{t("Keep checking")}</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OfferGpuPage;

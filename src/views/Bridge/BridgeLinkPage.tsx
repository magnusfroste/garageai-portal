import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Laptop, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSession } from "@/hooks/useSession";
import { useMyGarages } from "@/hooks/useMyGarages";
import { TermsCheckbox } from "@/views/Garages/components/TermsCheckbox";
import { BridgeLinkError } from "@/data/repositories/bridgeLinkRepository";
import { GARAGE_NAME_RE, isUserCode, normaliseUserCode, replacesOtherMachine } from "@/models/services/bridgeLinkService";
import { useBridgeLink } from "./hooks/useBridgeLink";
import { BridgeLiveProgress } from "./components/BridgeLiveProgress";
import { t } from "@/i18n";
import { garageLimitMessage, limitMessage } from "@/models/services/credentialErrors";

import { useProfile } from "@/hooks/useProfile";
import { ACCOUNT_TERMS_REQUIRED, hasCurrentAccountTerms } from "@/models/services/accountTermsService";
import { ReadAndAcceptButton } from "@/views/Account/components/TermsAcceptDialog";
import { LegalLinks } from "@/views/Account/components/AccountTermsCheckbox";
const ERRORS: Record<string, string> = {
  not_found: "This code was not found. Check it in your terminal.",
  expired: "This code has expired. Run garageai connect again.",
  not_pending: "This code has already been used.",
  invalid_code: "Enter the 8-character code shown in your terminal.",
};
const errorText = (e: unknown) => {
  const code = e instanceof BridgeLinkError ? e.code : e instanceof Error ? e.message : "";
  return limitMessage(code) ?? t(ERRORS[code] ?? (code || "Something went wrong."));
};

const Fact = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words text-sm">{value || "—"}</dd></div>
);

const BridgeLinkPage = () => {
  const { session, loading } = useSession();
  const { profile } = useProfile();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get("code") ?? "");
  const code = normaliseUserCode(params.get("code") ?? "");
  const { lookup, approve, deny } = useBridgeLink(code, !!session);
  const { garages } = useMyGarages();
  const meshGarages = useMemo(() => garages.filter((g) => g.connection_type !== "endpoint"), [garages]);
  const [choice, setChoice] = useState<string>("new");
  const [newName, setNewName] = useState("");
  const [terms, setTerms] = useState(false);
  const [replace, setReplace] = useState(false);
  const [done, setDone] = useState<"approved" | "denied" | null>(null);
  const [garageId, setGarageId] = useState<string | null>(null);
  const link = lookup.data;

  useEffect(() => { if (link?.suggested_name) setNewName(link.suggested_name); }, [link?.suggested_name]);
  useEffect(() => setReplace(false), [choice]);

  if (loading) return null;
  if (!session) return <Navigate to={`/auth?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;

  const chosen = choice === "new" ? null : meshGarages.find((g) => g.id === choice) ?? null;
  const conflict = replacesOtherMachine(chosen?.machine_id, link?.machine_id);
  const name = chosen ? chosen.name : newName.trim().toLowerCase();
  const limitBlocksNew = !chosen && link?.garage_limit_reached === true;
  const needsTerms = !chosen || !chosen.terms_accepted_at;
  const canApprove = hasCurrentAccountTerms(profile) && !!link && !limitBlocksNew && GARAGE_NAME_RE.test(name) && (!needsTerms || terms) && (!conflict || replace) && !approve.isPending;
  const mins = link ? Math.max(0, Math.round((Date.now() - new Date(link.created_at).getTime()) / 60000)) : 0;

  const submitCode = (e: React.FormEvent) => { e.preventDefault(); setParams({ code: normaliseUserCode(input) }); };
  const onApprove = () => approve.mutate({ userCode: code, garageName: name, termsAccepted: needsTerms ? terms : false, replaceMachine: replace }, { onSuccess: (r) => { setGarageId(r.garage.id); setDone("approved"); } });
  const onDeny = () => deny.mutate(undefined, { onSuccess: () => setDone("denied") });

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold">{t("Link a machine with Bridge")}</h1>
        <p className="text-sm text-muted-foreground">{t("Approve the machine that is running garageai connect.")}</p>
      </div>

      {done === "approved" ? (
        <Card><CardContent className="space-y-4 p-6"><p className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-foreground" />{t("Approved. Go back to your terminal: Bridge continues on its own.")}</p>{garageId && <BridgeLiveProgress garageId={garageId} />}</CardContent></Card>
      ) : done === "denied" ? (
        <Card><CardContent className="flex items-start gap-3 p-6"><XCircle className="mt-0.5 h-5 w-5 text-muted-foreground" /><p>{t("Denied. The machine was not linked.")}</p></CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">{t("Code")}</CardTitle><CardDescription>{t("The code shown in your terminal.")}</CardDescription></CardHeader>
            <CardContent>
              <form onSubmit={submitCode} className="flex gap-2">
                <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="ABCD-EFGH" className="font-mono uppercase tracking-widest" aria-label={t("Code")} />
                <Button type="submit" variant="secondary">{t("Continue")}</Button>
              </form>
              {code && !isUserCode(code) && <p className="mt-2 text-sm text-danger-foreground">{t(ERRORS.invalid_code)}</p>}
              {lookup.isError && <p className="mt-2 text-sm text-danger-foreground">{errorText(lookup.error)}</p>}
            </CardContent>
          </Card>

          {link && (
            <>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Laptop className="h-4 w-4 text-primary" />{t("The machine")}</CardTitle></CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Fact label={t("Hostname")} value={link.hostname} />
                    <Fact label={t("System")} value={[link.os, link.arch].filter(Boolean).join(" · ")} />
                    <Fact label="GPU" value={link.gpu} />
                    <Fact label={t("Memory")} value={link.memory_gb != null ? `${link.memory_gb} GB` : null} />
                    <Fact label={t("Bridge version")} value={link.bridge_version} />
                    <Fact label={t("Runtime")} value={link.runtime} />
                    <Fact label={t("Asked")} value={`${mins} ${t("min ago")}`} />
                    <Fact label={t("Requested from")} value={link.requested_ip_country} />
                  </dl>
                  {link.models.length > 0 && <p className="mt-3 break-words font-mono text-xs text-muted-foreground">{link.models.join(", ")}</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">{t("Garage")}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <RadioGroup value={choice} onValueChange={setChoice} className="space-y-2">
                    <div className="flex items-center gap-2"><RadioGroupItem value="new" id="g-new" /><Label htmlFor="g-new">{t("New garage")}</Label></div>
                    {meshGarages.map((g) => (
                      <div key={g.id} className="flex items-center gap-2"><RadioGroupItem value={g.id} id={`g-${g.id}`} /><Label htmlFor={`g-${g.id}`} className="font-mono">{g.name}</Label>{g.machine_hostname && <span className="text-xs text-muted-foreground">· {g.machine_hostname}</span>}</div>
                    ))}
                  </RadioGroup>
                  {choice === "new" && (
                    <div className="space-y-1">
                      <Label htmlFor="new-name">{t("Garage name")}</Label>
                      <Input id="new-name" value={newName} onChange={(e) => setNewName(e.target.value.toLowerCase())} className="font-mono" />
                      {newName && !GARAGE_NAME_RE.test(newName) && <p className="text-xs text-danger-foreground">{t("Use 2–41 lowercase letters, digits or dashes.")}</p>}
                    </div>
                  )}
                  {limitBlocksNew && <p className="flex items-start gap-2 rounded border border-warning-border bg-warning-surface p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />{garageLimitMessage()}</p>}
                  {needsTerms && <TermsCheckbox id="link-terms" checked={terms} onChange={setTerms} />}
                  <LegalLinks />
                  {conflict && (
                    <div className="space-y-2 rounded border border-warning-border bg-warning-surface p-3">
                      <p className="flex items-start gap-2 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />{t("This garage was connected from another machine ({host}). Connecting this one replaces it.").replace("{host}", chosen?.machine_hostname || t("unknown"))}</p>
                      <div className="flex items-center gap-2"><Checkbox id="replace" checked={replace} onCheckedChange={(c) => setReplace(c === true)} /><Label htmlFor="replace">{t("Replace the other machine")}</Label></div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-3">
                {!hasCurrentAccountTerms(profile) && <div className="flex flex-wrap items-center gap-3"><p className="text-sm text-destructive">{t(ACCOUNT_TERMS_REQUIRED)}</p><ReadAndAcceptButton onAccepted={() => { if (link && !limitBlocksNew && GARAGE_NAME_RE.test(name) && (!needsTerms || terms) && (!conflict || replace)) onApprove(); }} /></div>}
                <p className="text-sm">{t("Only approve if you started this on your own machine just now. Approving lets that machine sell inference as your garage.")}</p>
                {(approve.isError || deny.isError) && <p className="text-sm text-danger-foreground">{errorText(approve.error ?? deny.error)}</p>}
                <div className="flex gap-2">
                  <Button onClick={onApprove} disabled={!canApprove}>{approve.isPending ? t("Approving…") : t("Approve")}</Button>
                  <Button variant="outline" onClick={onDeny} disabled={deny.isPending}>{t("Deny")}</Button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default BridgeLinkPage;

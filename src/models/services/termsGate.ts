import { ACCOUNT_TERMS_ERROR_CODE, ACCOUNT_TERMS_REQUIRED } from "../../../supabase/functions/_shared/accountTerms";
import { t } from "@/i18n";

/** Thrown when an action needs the current terms; views offer "Read and accept the terms". */
export class TermsNotAcceptedError extends Error {
  readonly code = ACCOUNT_TERMS_ERROR_CODE;
  constructor() { super(t(ACCOUNT_TERMS_REQUIRED)); this.name = "TermsNotAcceptedError"; }
}

/** True for the app's own error and for a server refusal with code `terms_not_accepted`. */
export async function isTermsRefusal(err: unknown): Promise<boolean> {
  if (err instanceof TermsNotAcceptedError) return true;
  const e = err as { code?: string; context?: { clone?: () => { json: () => Promise<unknown> } } } | null;
  if (e?.code === ACCOUNT_TERMS_ERROR_CODE) return true;
  try {
    const body = (await e?.context?.clone?.().json()) as { code?: string; error?: { code?: string } } | undefined;
    return body?.code === ACCOUNT_TERMS_ERROR_CODE || body?.error?.code === ACCOUNT_TERMS_ERROR_CODE;
  } catch { return false; }
}

type Ask = () => Promise<boolean>;
const listeners = new Set<(resolve: (ok: boolean) => void) => void>();

/** Opens the accept-terms dialog (mounted once in the layout); resolves true after acceptance. */
export const askToAcceptTerms: Ask = () => new Promise((resolve) => {
  if (listeners.size === 0) { resolve(false); return; }
  listeners.forEach((l) => l(resolve));
});
export const onTermsRequest = (l: (resolve: (ok: boolean) => void) => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Runs the action; if refused for missing terms, asks to accept and then continues the same action once. */
export async function runWithTermsAcceptance<T>(action: () => Promise<T>, ask: Ask = askToAcceptTerms): Promise<T> {
  try { return await action(); }
  catch (err) {
    if (!(await isTermsRefusal(err))) throw err;
    if (!(await ask())) throw err;
    return action();
  }
}

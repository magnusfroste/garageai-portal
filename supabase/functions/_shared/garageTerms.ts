// Operator prompt-confidentiality terms: one version string shared by every function that records acceptance.
export const TERMS_VERSION = "prompt-confidentiality-2026-10";

export const termsAccepted = (body: Record<string, unknown>) => body.terms_accepted === true;

export const termsFields = () => ({ terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION });

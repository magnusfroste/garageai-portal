export const ACCOUNT_TERMS_VERSION = "2026-10-17";
export const ACCOUNT_TERMS_URL = "https://www.garageai.eu/terms";
export const ACCOUNT_PRIVACY_URL = "https://www.garageai.eu/privacy";
export const ACCOUNT_TERMS_REQUIRED = "Please accept the Terms and Privacy policy in the banner above before continuing.";
export const hasCurrentAccountTerms = (profile: { terms_version?: string | null } | null | undefined) => profile?.terms_version === ACCOUNT_TERMS_VERSION;
interface TermsReader {
  from(table: string): { select(columns: string): { eq(column: string, value: string): { maybeSingle(): PromiseLike<{ data: { terms_version: string | null } | null; error: unknown }> } } };
}
export async function accountTermsAccepted(client: TermsReader, userId: string): Promise<boolean> {
  const { data, error } = await client.from("profiles").select("terms_version").eq("id", userId).maybeSingle();
  if (error) throw error;
  return hasCurrentAccountTerms(data);
}

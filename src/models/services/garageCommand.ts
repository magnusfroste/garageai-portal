export interface GarageCredentials {
  garage: { id: string; name: string };
  register_token: string;
  register_url: string;
}

/** Automation can renew a register token, but uses only GarageAI tunnel credentials. */
export const tokenRenewalRequest = (name: string) => ({
  name,
  terms_accepted: true,
});

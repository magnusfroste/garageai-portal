export interface GarageCredentials {
  garage: { id: string; name: string };
  register_token: string;
  setup_key: string | null;
  register_url: string;
  management_url: string;
}

/** Automation can renew a register token, but never provisions NetBird credentials. */
export const tokenRenewalRequest = (name: string) => ({
  name,
  create_setup_key: false,
  terms_accepted: true,
});

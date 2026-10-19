export type ApiKeyKind = "user" | "default" | "chat";

export interface ApiKey {
  id: string;
  name: string;
  /** Legacy column; holds a placeholder for keys created show-once. Never displayed. */
  key_value?: string;
  key_last4: string | null;
  kind: ApiKeyKind;
  device_label: string | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  is_active: boolean;
}

export interface CreateApiKeyDto {
  keyName: string;
  models?: string[];
}

/** A key value returned once at creation; never stored by the portal. */
export interface CreatedApiKey {
  id: string;
  key: string;
  name: string;
  last4: string;
}

export interface ManagementKey { id: string; name: string; key_last4: string; created_at: string; expires_at: string | null; revoked_at: string | null; last_used_at: string | null }
export interface IssuedManagementKey { id: string; name: string; key: string }

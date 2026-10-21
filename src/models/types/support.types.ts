export type SupportTag = 'onboarding' | 'connect' | 'models' | 'billing' | 'chat' | 'other';
export type SupportStatus = 'open' | 'answered' | 'closed';
export interface SupportContext { page: string; step: string; last_error: string; browser: string; os: string; garages: { name: string; bridge_version: string; problem_codes: string[] }[] }
export interface SupportThread { id: string; user_id: string; status: SupportStatus; tag: SupportTag; created_at: string; last_user_message_at: string | null; last_admin_message_at: string | null; user_read_at: string | null; admin_read_at: string | null; closed_at: string | null }
export interface SupportMessage { id: string; thread_id: string; sender: 'user' | 'admin'; body: string; context: SupportContext | null; created_at: string }
export interface SupportDiagnostics { key_created_at: string | null; has_successful_request: boolean; failed_model: boolean; events: { garage_id: string; step: string; status: string; created_at: string }[] }
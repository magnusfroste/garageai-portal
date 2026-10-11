export interface BridgeLinkRequest {
  user_code: string;
  status: string;
  machine_id: string | null;
  hostname: string | null;
  os: string | null;
  arch: string | null;
  bridge_version: string | null;
  gpu: string | null;
  memory_gb: number | null;
  runtime: string | null;
  models: string[];
  suggested_name: string | null;
  requested_ip_country: string | null;
  created_at: string;
  expires_at: string;
}

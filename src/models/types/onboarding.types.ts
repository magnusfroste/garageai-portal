export type SignupIntent = "buyer" | "operator";

export const isSignupIntent = (value: string | null | undefined): value is SignupIntent =>
  value === "buyer" || value === "operator";
export type OnboardingStatus = "started" | "warning" | "failed" | "stopped" | "done";

export interface OnboardingEvent {
  id: string;
  garage_id: string;
  created_at: string;
  step: string;
  status: OnboardingStatus;
  message: string | null;
  script_version: string | null;
  node_name: string | null;
  runtime: string | null;
  port: string | null;
  os: string | null;
  arch: string | null;
  gpu: string | null;
  memory_gb: string | null;
  profile?: unknown;
}

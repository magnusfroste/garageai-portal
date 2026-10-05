export type SignupIntent = "buyer" | "operator";

export const isSignupIntent = (value: string | null | undefined): value is SignupIntent =>
  value === "buyer" || value === "operator";
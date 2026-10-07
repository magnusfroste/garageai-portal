/** Functions that forward prompts to the gateway are pinned to this EU region (closest supported to the eu-north-1 database). */
export const PROMPT_FUNCTION_REGION = "eu-central-1";

export const regionalFunctionUrl = (fn: string) =>
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}?forceFunctionRegion=${PROMPT_FUNCTION_REGION}`;

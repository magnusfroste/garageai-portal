import { modelIdError } from "../../../supabase/functions/_shared/modelValidation";

export function validProviderModelId(value: string): boolean {
  return modelIdError(value.trim(), true) === null;
}

export function addProviderModel(current: string[], value: string): string[] {
  const model = value.trim();
  if (!validProviderModelId(model)) return current;
  return Array.from(new Set([...current, model]));
}
// Plain-language messages for credential-issuing errors (Bridge link page and the wizard).
import { t } from "@/i18n";

export const SUPPORT_URL = "mailto:support@garageai.eu";
export const MAX_GARAGES = 5;

/** Returns the plain message for a known limit code, or null for other errors. */
export function limitMessage(code: string): string | null {
  if (code === "too_many_connects" || /too many requests|429/i.test(code))
    return t("You have connected many times today. Wait a while, or contact us at {support}").replace("{support}", SUPPORT_URL.replace(/^mailto:/, ""));
  if (code === "garage_limit" || /at most 5 garages/i.test(code)) return garageLimitMessage();
  return null;
}

export const garageLimitMessage = () =>
  t("You have {n} garages. Remove one under My garages, or connect this machine as one of them").replace("{n}", String(MAX_GARAGES));

/** Plain message when an API key cannot be created (never a raw function error). */
export const keyCreateFailedMessage = () =>
  t("Your key could not be created right now. Try again in a minute; if it keeps failing, write to hello@garageai.eu.");
/** Plain message when the chat cannot start. */
export const chatStartFailedMessage = () =>
  t("The chat could not start right now. Try again in a minute; if it keeps failing, write to hello@garageai.eu.");
/** Plain message when checkout cannot start. */
export const checkoutFailedMessage = () =>
  t("Checkout could not start right now. Try again in a minute; if it keeps failing, write to hello@garageai.eu.");

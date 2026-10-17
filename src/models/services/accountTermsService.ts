import { accountTermsRepository } from "@/data/repositories/accountTermsRepository";
import { profileService } from "./profileService";
import { ACCOUNT_TERMS_REQUIRED, hasCurrentAccountTerms } from "../../../supabase/functions/_shared/accountTerms";
import { t } from "@/i18n";
export { ACCOUNT_TERMS_VERSION, ACCOUNT_TERMS_URL, ACCOUNT_PRIVACY_URL, ACCOUNT_TERMS_REQUIRED, hasCurrentAccountTerms } from "../../../supabase/functions/_shared/accountTerms";
export const accountTermsService = {
  accept: accountTermsRepository.accept,
  async requireAcceptance(): Promise<void> {
    if (!hasCurrentAccountTerms(await profileService.getCurrentUserProfile())) throw new Error(t(ACCOUNT_TERMS_REQUIRED));
  },
};

import { accountTermsRepository } from "@/data/repositories/accountTermsRepository";
import { profileService } from "./profileService";
import { hasCurrentAccountTerms } from "../../../supabase/functions/_shared/accountTerms";
import { TermsNotAcceptedError } from "./termsGate";
export { ACCOUNT_TERMS_VERSION, ACCOUNT_TERMS_URL, ACCOUNT_PRIVACY_URL, ACCOUNT_TERMS_REQUIRED, ACCOUNT_TERMS_ERROR_CODE, hasCurrentAccountTerms, shouldShowAccountTermsNotice } from "../../../supabase/functions/_shared/accountTerms";
export const accountTermsService = {
  accept: accountTermsRepository.accept,
  dismissNotice: accountTermsRepository.dismissNotice,
  async requireAcceptance(): Promise<void> {
    if (!hasCurrentAccountTerms(await profileService.getCurrentUserProfile())) throw new TermsNotAcceptedError();
  },
};

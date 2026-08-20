import { isNativeCustodyAssetId } from '../native-assets.ts';
import {
  candidateErr,
  candidateOk,
  type CustodyCandidateResult,
  type CustodyProviderCandidateProfile,
} from './types.ts';

export function validateCustodyProviderCandidateProfile(
  profile: CustodyProviderCandidateProfile,
): CustodyCandidateResult<CustodyProviderCandidateProfile> {
  if (profile.productionAuthorized !== false) {
    return candidateErr('PRODUCTION_FORBIDDEN', 'productionAuthorized must remain false');
  }
  if (profile.supportedAssets.length === 0) {
    return candidateErr('NO_ASSETS', 'provider candidate must declare supported native assets');
  }
  for (const asset of profile.supportedAssets) {
    if (!isNativeCustodyAssetId(asset)) {
      return candidateErr('INVALID_ASSET', `unsupported asset ${asset}`);
    }
  }
  if (profile.credentialDescriptorRef.length === 0 || profile.endpointProfileRef.length === 0) {
    return candidateErr('PROFILE_INCOMPLETE', 'credential and endpoint refs are required');
  }
  return candidateOk(Object.freeze({ ...profile, productionAuthorized: false }));
}

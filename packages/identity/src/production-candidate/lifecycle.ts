import { ENVIRONMENT, LIVE_EXTERNAL_KYC } from '../../../config/src/flags.ts';
import type { IdentityAdapterProfile, ProviderLifecycleState } from './types.ts';

export type IdentityRuntimeMode =
  | 'LOCAL_SIMULATION'
  | 'SANDBOX'
  | 'INTEGRATION_TEST'
  | 'PRODUCTION_CANDIDATE_DISABLED'
  | 'PRODUCTION_AUTHORIZED';

export type IdentityLifecycleBinding = {
  readonly providerId: string;
  readonly lifecycle: ProviderLifecycleState;
  readonly runtimeMode: IdentityRuntimeMode;
  readonly environment: typeof ENVIRONMENT;
  readonly liveExternalKyc: typeof LIVE_EXTERNAL_KYC;
  readonly health: IdentityAdapterProfile['health'];
  readonly certified: boolean;
  readonly credentialBound: boolean;
  readonly productionKycEnabled: false;
};

export function bindIdentityProviderLifecycle(
  profile: IdentityAdapterProfile,
  runtimeMode: IdentityRuntimeMode = 'SANDBOX',
): IdentityLifecycleBinding {
  if (LIVE_EXTERNAL_KYC !== false) {
    throw new Error('LIVE_EXTERNAL_KYC must remain false');
  }
  if (profile.lifecycle === 'PRODUCTION' || profile.lifecycle === 'LIMITED_LIVE') {
    throw new Error('production identity-provider lifecycle is disabled');
  }
  if (runtimeMode === 'PRODUCTION_AUTHORIZED') {
    throw new Error('identity adapter cannot enter PRODUCTION_AUTHORIZED');
  }
  return Object.freeze({
    providerId: profile.providerId,
    lifecycle: profile.lifecycle,
    runtimeMode,
    environment: ENVIRONMENT,
    liveExternalKyc: LIVE_EXTERNAL_KYC,
    health: profile.health,
    certified: profile.certified,
    credentialBound: profile.credentialRef !== null,
    productionKycEnabled: false,
  });
}

export function sandboxResultIsProductionKyc(
  profile: IdentityAdapterProfile,
  state: string,
): { readonly acceptedAsProduction: false; readonly state: string } {
  void profile;
  return Object.freeze({ acceptedAsProduction: false, state });
}

import { ENVIRONMENT, LIVE_EXTERNAL_KYC } from '../../../../config/src/flags.ts';
import type { ComplianceAdapterProfile } from './types.ts';

export type ComplianceRuntimeMode =
  | 'LOCAL_SIMULATION'
  | 'SANDBOX'
  | 'INTEGRATION_TEST'
  | 'PRODUCTION_CANDIDATE_DISABLED'
  | 'PRODUCTION_AUTHORIZED';

export type ComplianceLifecycleBinding = {
  readonly providerId: string;
  readonly lifecycle: ComplianceAdapterProfile['lifecycle'];
  readonly runtimeMode: ComplianceRuntimeMode;
  readonly environment: typeof ENVIRONMENT;
  readonly liveExternalKyc: typeof LIVE_EXTERNAL_KYC;
  readonly health: ComplianceAdapterProfile['health'];
  readonly certified: boolean;
  readonly credentialBound: boolean;
  readonly productionScreeningEnabled: false;
};

export function bindComplianceProviderLifecycle(
  profile: ComplianceAdapterProfile,
  runtimeMode: ComplianceRuntimeMode = 'SANDBOX',
): ComplianceLifecycleBinding {
  if (LIVE_EXTERNAL_KYC !== false) {
    throw new Error('LIVE_EXTERNAL_KYC must remain false');
  }
  if (runtimeMode === 'PRODUCTION_AUTHORIZED') {
    throw new Error('compliance adapter cannot enter PRODUCTION_AUTHORIZED');
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
    productionScreeningEnabled: false,
  });
}

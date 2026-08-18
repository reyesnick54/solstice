import type { ProviderAcceptanceBinding } from '../../production-ceremony/bindings.ts';
import type { DeploymentAuthorizationPackage, ProductionEnvironmentClass } from './types.ts';

export const REQUIRED_PRODUCTION_PROVIDER_DOMAINS = [
  'CLOUD_INFRASTRUCTURE',
  'SECRET_MANAGER',
  'KMS',
  'HSM',
  'DATABASE',
  'OBJECT_STORAGE',
] as const;

export function gateProvidersForTarget(
  environmentClass: ProductionEnvironmentClass,
  provider: ProviderAcceptanceBinding,
  authorization?: DeploymentAuthorizationPackage,
): void {
  if (environmentClass !== 'PRODUCTION') {
    return;
  }
  if (provider.productionEligible !== true) {
    throw new TypeError('fixture provider cannot qualify production');
  }
  if (provider.acceptanceStatus === 'ENGINEERING_TESTED' || provider.acceptanceStatus === 'CONFIGURED_UNVERIFIED') {
    throw new TypeError('fixture provider cannot qualify production');
  }
  if (!authorization || authorization.authorized !== true || authorization.actorKind !== 'HUMAN' || authorization.aiGeneratedPlanningAlone) {
    throw new TypeError('AI deployment authorization rejected');
  }
  if (!provider.matrix || provider.matrix.rows.some((row) => REQUIRED_PRODUCTION_PROVIDER_DOMAINS.includes(row.domain as (typeof REQUIRED_PRODUCTION_PROVIDER_DOMAINS)[number]) && !row.productionEligible)) {
    throw new TypeError('fixture provider cannot qualify production');
  }
}

export function rejectExpiredProviderEvidence(expiresAtUtc: string | null, nowUtc: string): void {
  if (expiresAtUtc !== null && expiresAtUtc <= nowUtc) {
    throw new TypeError('expired provider evidence');
  }
}

export function rejectUnacceptedHsm(state: string, claimedVerified: boolean): void {
  if (claimedVerified && (state === 'SIMULATION_HSM' || state === 'CONFIGURED_UNVERIFIED' || state === 'EXTERNAL_HSM_CONFIGURED_UNVERIFIED')) {
    throw new TypeError('unaccepted HSM');
  }
}

export function rejectMissingSignerReference(reference: string | null | undefined): void {
  if (!reference || reference.length === 0) {
    throw new TypeError('missing signer reference');
  }
}

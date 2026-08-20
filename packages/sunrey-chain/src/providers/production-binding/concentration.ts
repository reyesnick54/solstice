import { measureConcentration } from '../continuity.ts';
import type { BindingConcentrationReport, ProductionProviderBinding } from './types.ts';

const CRITICAL_DOMAINS = Object.freeze([
  'HSM',
  'KMS',
  'SECRET_MANAGER',
  'CUSTODY_PROVIDER',
  'PAYMENT_RAIL',
  'IDENTITY_KYC',
  'ORACLE_DATA_SOURCE',
]);

export function analyzeBindingConcentration(
  bindings: readonly ProductionProviderBinding[],
): BindingConcentrationReport {
  const critical = bindings.filter((row) => CRITICAL_DOMAINS.includes(row.providerDomain));
  const base = measureConcentration({
    providerIds: critical.map((row) => row.providerId),
    regions: critical.flatMap((row) => row.regions),
    controllers: critical.map((row) => row.controllerId),
  });
  const controllers = new Set(critical.map((row) => row.controllerId));
  const regions = new Set(critical.flatMap((row) => row.regions));
  const authorities = new Set(critical.map((row) => row.credentialAuthorityId));
  return Object.freeze({
    providerConcentration: base.providerConcentration,
    regionConcentration: base.regionConcentration,
    controllerConcentration: base.controllerConcentration,
    sameCorporationControlsMultipleCritical: controllers.size === 1 && critical.length > 1,
    sameRegionHostsAllCritical: regions.size === 1 && critical.length > 1,
    sameCredentialAuthorityControlsAll: authorities.size === 1 && critical.length > 1,
    dualProviderConfigured: base.dualProviderConfigured,
    organizationalIndependenceClaimed: false,
    independenceEvidencePresent: false,
  });
}

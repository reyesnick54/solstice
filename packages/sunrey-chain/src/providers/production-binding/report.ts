import type { ProviderDomain } from '../types.ts';
import { bindingDigest } from './hash.ts';
import type { BindingEvaluation, ConnectivityReadinessReport, ProductionProviderBinding } from './types.ts';

export function buildConnectivityReadinessReport(input: {
  readonly generatedAtUtc: string;
  readonly requiredDomains: readonly ProviderDomain[];
  readonly bindings: readonly ProductionProviderBinding[];
  readonly evaluations: readonly BindingEvaluation[];
  readonly failoverCoverage: boolean;
}): ConnectivityReadinessReport {
  const bound = [...new Set(input.bindings.map((row) => row.providerDomain))];
  const missing = input.requiredDomains.filter((domain) => !bound.includes(domain));
  const invalidEvidence = input.evaluations.flatMap((row) =>
    row.blockers
      .filter((blocker) => blocker.code.includes('EVIDENCE') || blocker.code.includes('EXPIRED') || blocker.code.includes('REVOKED'))
      .map((blocker) => `${row.bindingId}:${blocker.code}`),
  );
  const invalidJurisdictionScope = input.evaluations.flatMap((row) =>
    row.blockers
      .filter((blocker) => blocker.code === 'OPERATING_SCOPE_MISMATCH' || blocker.code === 'UNSUPPORTED_DATA_CLASS')
      .map((blocker) => `${row.bindingId}:${blocker.detail}`),
  );
  const credentialReadiness = input.evaluations.length > 0 && input.evaluations.every((row) => row.credentialReady);
  const endpointReadiness = input.evaluations.length > 0 && input.evaluations.every((row) => row.endpointReady);
  const conformanceReadiness = input.evaluations.length > 0 && input.evaluations.every((row) => row.conformanceReady);
  const connectivityReadyForHumanReview =
    missing.length === 0 &&
    invalidEvidence.length === 0 &&
    invalidJurisdictionScope.length === 0 &&
    credentialReadiness &&
    endpointReadiness &&
    conformanceReadiness &&
    input.failoverCoverage &&
    input.evaluations.every((row) => row.productionBindingCandidate);
  const report: Omit<ConnectivityReadinessReport, 'reportDigest'> = {
    schemaVersion: 1,
    toolVersion: 'sunrey-ops/provider-binding/1',
    generatedAtUtc: input.generatedAtUtc,
    providerDomainsRequired: Object.freeze([...input.requiredDomains]),
    domainsBound: Object.freeze(bound),
    domainsMissing: Object.freeze(missing),
    invalidEvidence: Object.freeze(invalidEvidence),
    invalidJurisdictionScope: Object.freeze(invalidJurisdictionScope),
    credentialReadiness,
    endpointReadiness,
    failoverCoverage: input.failoverCoverage,
    conformanceReadiness,
    connectivityReadyForHumanReview,
    connectivityEnabled: false,
    liveConnectivityEnabled: false,
    productionActive: false,
    realProviderCalled: false,
  };
  return Object.freeze({
    ...report,
    reportDigest: bindingDigest(report),
  });
}

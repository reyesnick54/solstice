/**
 * Chain-first and domain health proofs for staged activation.
 *
 * A healthy chain never inherits legal or economic authority onto a
 * dependent product. Domain failures stay minimally scoped.
 */

import { isDependentProduct } from './plan.ts';
import type {
  ChainSafetyObservation,
  DomainFailureKind,
  ScopedFailureResult,
  StagedActivationDomain,
  StagedActivationObservation,
} from './types.ts';

export function chainSafetyPassed(chain: ChainSafetyObservation): boolean {
  return (
    chain.validatorQuorumStable &&
    chain.finalityStable &&
    chain.stateRootAgreement &&
    chain.rpcHealthy &&
    chain.persistenceRecoveryHealthy &&
    chain.securityMonitoringHealthy &&
    chain.operatorAccepted
  );
}

export function chainSafetyFindings(chain: ChainSafetyObservation): readonly string[] {
  const findings: string[] = [];
  if (!chain.validatorQuorumStable) findings.push('validator quorum is not stable');
  if (!chain.finalityStable) findings.push('finality is not stable');
  if (!chain.stateRootAgreement) findings.push('state root agreement failed');
  if (!chain.rpcHealthy) findings.push('RPC health is not acceptable');
  if (!chain.persistenceRecoveryHealthy) findings.push('persistence/recovery health is not acceptable');
  if (!chain.securityMonitoringHealthy) findings.push('security monitoring is not acceptable');
  if (!chain.operatorAccepted) findings.push('operator acceptance is missing');
  return Object.freeze(findings);
}

export function dependentProductEligible(observation: StagedActivationObservation): boolean {
  return chainSafetyPassed(observation.chain);
}

export function controlRoomHealthAcceptable(observation: StagedActivationObservation): boolean {
  return observation.controlRoom.healthAcceptable;
}

export function criticalIncidentOpen(
  observation: StagedActivationObservation,
  domain?: StagedActivationDomain,
): boolean {
  return observation.incidents.some(
    (incident) =>
      incident.open &&
      incident.critical &&
      (domain === undefined || incident.domain === domain || incident.domain === 'SUNREY_CHAIN'),
  );
}

export function domainCriticalIncidentOpen(
  observation: StagedActivationObservation,
  domain: StagedActivationDomain,
): boolean {
  return observation.incidents.some(
    (incident) => incident.open && incident.critical && incident.domain === domain,
  );
}

export function providerFor(
  observation: StagedActivationObservation,
  domain: StagedActivationDomain,
): StagedActivationObservation['providers'][number] | undefined {
  return observation.providers.find((row) => row.domain === domain);
}

export function providerEligible(
  observation: StagedActivationObservation,
  domain: StagedActivationDomain,
): { readonly ok: boolean; readonly reasons: readonly string[] } {
  const provider = providerFor(observation, domain);
  if (!provider) {
    return { ok: true, reasons: Object.freeze([]) };
  }
  const reasons: string[] = [];
  if (!provider.bindingCandidateCurrent) reasons.push('production provider binding candidate is not current');
  if (!provider.credentialsValid) reasons.push('provider credentials are not valid');
  if (!provider.externalEvidenceValid) reasons.push('provider external evidence is not valid');
  if (!provider.operatingScopeEligible) reasons.push('provider operating scope is not eligible');
  if (provider.health === 'UNHEALTHY' || provider.health === 'DISABLED') {
    reasons.push(`provider health is ${provider.health}`);
  }
  if (provider.health === 'UNHEALTHY' && !provider.failoverIndependentlyEligible) {
    reasons.push('failover provider is not independently eligible');
  }
  return { ok: reasons.length === 0, reasons: Object.freeze(reasons) };
}

export function operatingScopeEligible(
  observation: StagedActivationObservation,
  domain: StagedActivationDomain,
): boolean {
  const row = observation.operatingScope.find((item) => item.domain === domain);
  return row?.eligible !== false;
}

export function evidenceCurrent(
  observation: StagedActivationObservation,
  domain: StagedActivationDomain,
): boolean {
  const row = observation.evidence.find((item) => item.domain === domain);
  return row?.current !== false;
}

export function operatorsAccepted(
  observation: StagedActivationObservation,
  domain: StagedActivationDomain,
): boolean {
  const row = observation.operators.find((item) => item.domain === domain);
  return row?.accepted !== false;
}

export function chainFirstBlocksDependent(
  observation: StagedActivationObservation,
  domain: StagedActivationDomain,
): boolean {
  return isDependentProduct(domain) && !dependentProductEligible(observation);
}

export function failureKindForProvider(domain: StagedActivationDomain): DomainFailureKind {
  if (domain === 'FIAT_BANKING') return 'BANKING_PROVIDER_OUTAGE';
  if (domain === 'PAYMENT_RAILS') return 'PAYMENT_RAIL_OUTAGE';
  if (domain === 'MOONREY_COIN_ISSUANCE' || domain === 'PRODUCTIVE_ECONOMIC_DATA') return 'ORACLE_DEGRADED';
  return 'PROVIDER_INELIGIBLE';
}

export function scopeFailure(
  kind: DomainFailureKind,
  observation: StagedActivationObservation,
): ScopedFailureResult {
  const chainIssue = kind === 'CHAIN_SAFETY' || !chainSafetyPassed(observation.chain);
  const restricted = new Set<StagedActivationDomain>();
  const reasons: string[] = [];

  switch (kind) {
    case 'CHAIN_SAFETY':
      restricted.add('SUNREY_CHAIN');
      reasons.push('independent chain safety issue restricts the chain domain');
      break;
    case 'KYC_PROVIDER_OUTAGE':
      restricted.add('FIAT_BANKING');
      restricted.add('PAYMENT_RAILS');
      restricted.add('CARDS');
      restricted.add('INVESTMENTS');
      reasons.push('KYC provider outage pauses regulated onboarding/payments only');
      break;
    case 'BANKING_PROVIDER_OUTAGE':
      restricted.add('FIAT_BANKING');
      restricted.add('PAYMENT_RAILS');
      reasons.push('banking provider outage restricts banking and payment rails');
      break;
    case 'PAYMENT_RAIL_OUTAGE':
      restricted.add('PAYMENT_RAILS');
      reasons.push('payment rail outage restricts payment rails');
      break;
    case 'ORACLE_DEGRADED':
    case 'PRODUCTIVE_VALUE_NOT_READY':
      restricted.add('MOONREY_COIN_ISSUANCE');
      restricted.add('PRODUCTIVE_CAPACITY_MARKET');
      restricted.add('PRODUCTIVE_ECONOMIC_DATA');
      reasons.push('MoonRey oracle/productive-value failure does not corrupt SunRey');
      break;
    case 'HIN_LEGAL_SCOPE_MISSING':
    case 'HIN_HUMAN_CONTRIBUTION_FAILURE':
      restricted.add('HUMAN_INFORMATION_MARKET');
      reasons.push('HIN failure does not create MoonRey issuance or shut the chain');
      break;
    case 'CUSTODY_NOT_READY':
      restricted.add('INSTITUTIONAL_CUSTODY');
      restricted.add('SUNREY_EXCHANGE');
      restricted.add('SUNREY_EXCHANGE_SETTLEMENT');
      reasons.push('custody unreadiness blocks custody and Exchange, not the chain');
      break;
    case 'SUPPLY_MISMATCH':
      restricted.add('SUNREY_COIN_ISSUANCE');
      restricted.add('MOONREY_COIN_ISSUANCE');
      reasons.push('supply mismatch blocks new issuance and never overwrites the book');
      break;
    case 'OPERATING_CORRIDOR_MISSING':
      restricted.add('PAYMENT_RAILS');
      restricted.add('FIAT_BANKING');
      reasons.push('missing payment corridor blocks payments only');
      break;
    case 'PROVIDER_INELIGIBLE':
    case 'FAILOVER_NOT_INDEPENDENT':
      for (const provider of observation.providers) {
        if (!provider.bindingCandidateCurrent || !provider.credentialsValid || !provider.externalEvidenceValid || !provider.operatingScopeEligible || provider.health === 'UNHEALTHY') {
          restricted.add(provider.domain);
        }
      }
      reasons.push('provider failure blocks the relevant domain; failover does not inherit eligibility');
      break;
    case 'PRODUCTIVE_LICENSE_MISSING':
      restricted.add('PRODUCTIVE_CAPACITY_MARKET');
      restricted.add('PRODUCTIVE_ECONOMIC_DATA');
      reasons.push('unlicensed productive provider blocks the relevant feed');
      break;
    case 'CRITICAL_INCIDENT':
      for (const incident of observation.incidents.filter((row) => row.open && row.critical)) {
        if (incident.domain !== 'SUNREY_CHAIN') {
          restricted.add(incident.domain);
        }
      }
      reasons.push('critical incidents restrict the incident domain');
      break;
  }

  return Object.freeze({
    kind,
    restrictedDomains: Object.freeze([...restricted]),
    chainShutdownRequired: chainIssue && kind === 'CHAIN_SAFETY',
    reasons: Object.freeze(reasons),
  });
}

import type { CompiledEconomicMandate } from '../../mandate/types.ts';
import type { HeliosRuntimeState } from './taxonomy.ts';
import type {
  MandateEligibilityResult,
  MandateRuntimeRegistration,
  HeliosRuntimePorts,
} from './types.ts';

export function evaluateMandateEligibility(input: {
  readonly registration: MandateRuntimeRegistration;
  readonly mandate: CompiledEconomicMandate | undefined;
  readonly ports: HeliosRuntimePorts;
  readonly now: string;
}): MandateEligibilityResult {
  const { registration, mandate, ports } = input;

  if (!registration.active) {
    return block('registration inactive', 'PAUSED');
  }

  if (!mandate) {
    return block('mandate not found', 'FAILED_SAFE');
  }

  if (mandate.state !== 'ACTIVE') {
    return block(`mandate state ${mandate.state}`, 'PAUSED');
  }

  if (mandate.subjectId !== registration.subjectId) {
    return block('mandate subject mismatch', 'FAILED_SAFE');
  }

  if (registration.fundingState === 'UNFUNDED') {
    return block('mandate not funded', 'IDLE');
  }

  if (!registration.config.jurisdictionEligible) {
    return block('jurisdiction ineligible', 'COMPLIANCE_BLOCKED');
  }

  if (registration.config.strategyIds.length === 0) {
    return block('no strategies configured', 'IDLE');
  }

  for (const strategyId of registration.config.strategyIds) {
    if (!ports.strategyEligible({ strategyId, now: input.now })) {
      return block(`strategy ${strategyId} demoted or ineligible`, 'DEGRADED');
    }
  }

  if (ports.growDeploymentPaused({ customerId: registration.customerId, subjectId: registration.subjectId })) {
    return block('grow deployment paused', 'PAUSED');
  }

  if (!ports.riskPermitsNewEntries({
    customerId: registration.customerId,
    subjectId: registration.subjectId,
    now: input.now,
  })) {
    return block('risk limits block new entries', 'RISK_BLOCKED');
  }

  if (!ports.compliancePermitsAction({
    customerId: registration.customerId,
    subjectId: registration.subjectId,
    now: input.now,
  })) {
    return block('compliance block', 'COMPLIANCE_BLOCKED');
  }

  if (ports.reconciliationRequired({ customerId: registration.customerId, subjectId: registration.subjectId })) {
    return block('reconciliation required', 'RECONCILIATION_REQUIRED');
  }

  if (!ports.providerAvailable({ providerIds: registration.config.providerIds, now: input.now })) {
    return block('provider unavailable', 'PROVIDER_BLOCKED');
  }

  if (
    !ports.marketDataFresh({
      customerId: registration.customerId,
      instrumentIds: registration.config.instrumentIds,
      now: input.now,
    })
  ) {
    return block('market data stale or missing', 'WAITING_FOR_DATA');
  }

  const assetClassesNeedingSession = registration.config.assetClasses.filter((ac) => ac !== 'CRYPTO');
  if (assetClassesNeedingSession.length > 0) {
    const anySessionOpen = assetClassesNeedingSession.some((assetClass) =>
      ports.marketSessionOpen({ assetClass, now: input.now }),
    );
    const cryptoOnly =
      registration.config.assetClasses.length === 1 && registration.config.assetClasses[0] === 'CRYPTO';
    if (!anySessionOpen && !cryptoOnly) {
      return block('market session closed', 'WAITING_FOR_MARKET');
    }
  }

  return Object.freeze({ eligible: true });
}

function block(reason: string, runtimeState: HeliosRuntimeState): MandateEligibilityResult {
  return Object.freeze({ eligible: false, reason, runtimeState });
}

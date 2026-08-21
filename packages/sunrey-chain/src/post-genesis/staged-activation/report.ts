/**
 * Staged activation rehearsal report.
 *
 * The report never claims LIVE enablement, mainnet launch, or
 * production activation.
 */

import { domainRuntimeState, evaluateStage, initialSequencerState, type SequencerState } from './advance.ts';
import { rehearsalCanaryPlan } from './canary.ts';
import { domainStateFromGates } from './gates.ts';
import { canonicalStagedPlan, allStagedDomains, domainsForStage, homeStage } from './plan.ts';
import { reconcileSupplyBooks } from './reconciliation.ts';
import type {
  DomainStageStatus,
  StagedActivationObservation,
  StagedActivationReport,
} from './types.ts';
import {
  STAGED_ACTIVATION_SCHEMA_VERSION,
  STAGED_ACTIVATION_STAGES,
  STAGED_ACTIVATION_TOOL_VERSION,
} from './types.ts';

export function evaluateStagedActivation(
  observation: StagedActivationObservation,
  state: SequencerState = initialSequencerState(),
): StagedActivationReport {
  const domains = Object.freeze(
    allStagedDomains().map((domain) => {
      const evaluated = domainStateFromGates(domain, observation, state.pausedDomains.has(domain));
      const runtime = domainRuntimeState(state, domain, observation);
      return Object.freeze({
        ...evaluated,
        stage: homeStage(domain),
        state: runtime === 'READY_FOR_REHEARSAL' || runtime === 'NOT_ELIGIBLE' || runtime === 'BLOCKED'
          ? evaluated.state === 'NOT_ELIGIBLE' && runtime === 'BLOCKED'
            ? evaluated.state
            : runtime === 'READY_FOR_REHEARSAL'
              ? evaluated.state
              : runtime
          : runtime,
        paused: state.pausedDomains.has(domain),
        pauseReason: state.pausedDomains.has(domain) ? evaluated.pauseReason : null,
      }) satisfies DomainStageStatus;
    }),
  );
  const stages = Object.freeze(
    STAGED_ACTIVATION_STAGES.map((stage) => evaluateStage(state, stage, observation, domains)),
  );
  return Object.freeze({
    schemaVersion: STAGED_ACTIVATION_SCHEMA_VERSION,
    toolVersion: STAGED_ACTIVATION_TOOL_VERSION,
    plan: canonicalStagedPlan(),
    stages,
    domains,
    canaries: Object.freeze(allStagedDomains().map(rehearsalCanaryPlan)),
    supply: reconcileSupplyBooks(observation.supplyBooks),
    productionLimits: observation.productionLimits,
    allAtOnceActivation: false,
    readOnlyEqualsFinancialActivation: false,
    sunreyIssuanceIndependent: true,
    moonreyIssuanceIndependent: true,
    domainFailureMinimallyScoped: true,
    canaryRealCustomers: false,
    aiCanAdvanceStage: false,
    controlRoomCanActivateDomain: false,
    humanActivationRemainsSeparate: true,
    liveFlagsEnabled: false,
    mainnetEnabled: false,
    productionActive: false,
  });
}

export function domainStatus(
  report: StagedActivationReport,
  domain: DomainStageStatus['domain'],
): DomainStageStatus | undefined {
  return report.domains.find((row) => row.domain === domain);
}

export function readOnlyDomainsRemainHealthy(report: StagedActivationReport): boolean {
  const chain = domainStatus(report, 'SUNREY_CHAIN');
  return chain !== undefined && chain.state !== 'BLOCKED' && !chain.paused;
}

export function stageDomains(
  report: StagedActivationReport,
  stage: DomainStageStatus['stage'],
): readonly DomainStageStatus[] {
  return Object.freeze(report.domains.filter((row) => domainsForStage(stage).includes(row.domain)));
}

export function rehearsalFlags(report: StagedActivationReport): {
  readonly ALL_AT_ONCE_ACTIVATION: false;
  readonly READ_ONLY_EQUALS_FINANCIAL_ACTIVATION: false;
  readonly SUNREY_ISSUANCE_INDEPENDENT: true;
  readonly MOONREY_ISSUANCE_INDEPENDENT: true;
  readonly DOMAIN_FAILURE_MINIMALLY_SCOPED: true;
  readonly CANARY_REAL_CUSTOMERS: false;
  readonly AI_CAN_ADVANCE_STAGE: false;
  readonly LIVE_FLAGS_ENABLED: false;
  readonly PRODUCTION_ACTIVE: false;
} {
  return Object.freeze({
    ALL_AT_ONCE_ACTIVATION: report.allAtOnceActivation,
    READ_ONLY_EQUALS_FINANCIAL_ACTIVATION: report.readOnlyEqualsFinancialActivation,
    SUNREY_ISSUANCE_INDEPENDENT: report.sunreyIssuanceIndependent,
    MOONREY_ISSUANCE_INDEPENDENT: report.moonreyIssuanceIndependent,
    DOMAIN_FAILURE_MINIMALLY_SCOPED: report.domainFailureMinimallyScoped,
    CANARY_REAL_CUSTOMERS: report.canaryRealCustomers,
    AI_CAN_ADVANCE_STAGE: report.aiCanAdvanceStage,
    LIVE_FLAGS_ENABLED: report.liveFlagsEnabled,
    PRODUCTION_ACTIVE: report.productionActive,
  });
}

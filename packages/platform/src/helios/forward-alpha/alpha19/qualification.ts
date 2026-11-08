import {
  HELIOS_ALPHA19_OUTCOME_MATURITY_BLOCKED,
  HELIOS_ALPHA19_OUTCOME_MATURITY_QUALIFIED,
} from './taxonomy.ts';
import type { MaturedOutcome, OutcomeMaturityQueueState, PendingOutcome } from './types.ts';

export type Alpha19QualificationChecks = Readonly<{
  readonly scheduleBeforeCampaignStart: boolean;
  readonly multiHorizonSupported: boolean;
  readonly noEarlyLabeling: boolean;
  readonly noNeutralInferenceOnMissingData: boolean;
  readonly immutableMaturedOutcomes: boolean;
  readonly evidenceUpdateOnMaturity: boolean;
  readonly noExecutionAuthority: boolean;
  readonly sealedBindingImmutable: boolean;
}>;

export type Alpha19QualificationResult = Readonly<{
  readonly marker:
    | typeof HELIOS_ALPHA19_OUTCOME_MATURITY_QUALIFIED
    | typeof HELIOS_ALPHA19_OUTCOME_MATURITY_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
}>;

export function validatePendingOutcomeInvariants(pending: PendingOutcome): readonly string[] {
  const findings: string[] = [];
  if (!pending.binding.immutableAfterSeal) {
    findings.push('BINDING_NOT_IMMUTABLE');
  }
  if (pending.status === 'MATURED' && pending.maturedOutcome === null) {
    findings.push('MATURED_WITHOUT_OUTCOME');
  }
  if (pending.status === 'OUTCOME_DATA_INCOMPLETE' && pending.maturedOutcome !== null) {
    findings.push('INCOMPLETE_WITH_OUTCOME');
  }
  return Object.freeze(findings);
}

export function validateMaturedOutcomeInvariants(outcome: MaturedOutcome): readonly string[] {
  const findings: string[] = [];
  if (!outcome.immutable) {
    findings.push('MATURED_NOT_IMMUTABLE');
  }
  if (outcome.seal.contentHash.length === 0) {
    findings.push('MISSING_SEAL');
  }
  if (Date.parse(outcome.realizedAt) < Date.parse(outcome.observationWindow.windowEnd)) {
    findings.push('REALIZED_BEFORE_HORIZON');
  }
  return Object.freeze(findings);
}

export function evaluateAlpha19OutcomeMaturityQualification(
  checks: Alpha19QualificationChecks,
  state: OutcomeMaturityQueueState,
): Alpha19QualificationResult {
  const blockers: string[] = [];
  for (const [key, pass] of Object.entries(checks) as [keyof Alpha19QualificationChecks, boolean][]) {
    if (!pass) {
      blockers.push(String(key));
    }
  }
  if (!state.schedule.declaredBeforeCampaignStart) {
    blockers.push('schedule_not_predeclared');
  }
  for (const pending of state.pending) {
    for (const finding of validatePendingOutcomeInvariants(pending)) {
      blockers.push(`pending:${pending.pendingId}:${finding}`);
    }
  }
  for (const outcome of state.matured) {
    for (const finding of validateMaturedOutcomeInvariants(outcome)) {
      blockers.push(`matured:${outcome.maturedOutcomeId}:${finding}`);
    }
  }
  if (state.grantsExecutionAuthority) {
    blockers.push('execution_authority_forbidden');
  }
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_ALPHA19_OUTCOME_MATURITY_QUALIFIED : HELIOS_ALPHA19_OUTCOME_MATURITY_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}

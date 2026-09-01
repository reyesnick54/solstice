import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { GrowMonitoringFinding } from '../types.ts';

export type ReassessmentDecision = {
  readonly shouldPropose: boolean;
  readonly reason: string;
  readonly cooldownActive: boolean;
  readonly silentTradeForbidden: true;
};

const DEFAULT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function shouldReassess(input: {
  readonly finding: GrowMonitoringFinding;
  readonly lastProposalAt: UtcInstant | null;
  readonly now: UtcInstant;
  readonly thresholdExceeded: boolean;
  readonly cooldownMs?: number;
}): ReassessmentDecision {
  const cooldownMs = input.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const cooldownActive =
    input.lastProposalAt !== null && Date.parse(input.now) - Date.parse(input.lastProposalAt) < cooldownMs;
  if (!input.thresholdExceeded || !input.finding.createsOpportunity) {
    return Object.freeze({
      shouldPropose: false,
      reason: 'change below reassessment threshold',
      cooldownActive,
      silentTradeForbidden: true,
    });
  }
  if (cooldownActive) {
    return Object.freeze({
      shouldPropose: false,
      reason: 'cooldown prevents proposal spam',
      cooldownActive: true,
      silentTradeForbidden: true,
    });
  }
  return Object.freeze({
    shouldPropose: true,
    reason: input.finding.summary,
    cooldownActive: false,
    silentTradeForbidden: true,
  });
}

export function monitoringToReassessmentLoop(input: {
  readonly findings: readonly GrowMonitoringFinding[];
  readonly lastProposalAt: UtcInstant | null;
  readonly now: UtcInstant;
}): readonly ReassessmentDecision[] {
  return Object.freeze(
    input.findings.map((finding) =>
      shouldReassess({
        finding,
        lastProposalAt: input.lastProposalAt,
        now: input.now,
        thresholdExceeded: finding.createsOpportunity,
      }),
    ),
  );
}

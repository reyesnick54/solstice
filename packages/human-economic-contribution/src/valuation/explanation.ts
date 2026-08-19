import type { ValuationId, ValuationPolicyVersion } from './ids.ts';
import type {
  CapApplication,
  HumanContributionValuationPolicy,
  ValuationAdjustment,
  ValuationExplanationReceipt,
  ValuationMethod,
  ValuationReasonCode,
  ValuationReferenceDatum,
  VerifiedHumanEconomicContribution,
} from './types.ts';
import type { RoundingRule } from './arithmetic.ts';

export function buildExplanation(input: {
  readonly valuationId: ValuationId;
  readonly contribution: VerifiedHumanEconomicContribution;
  readonly policy: HumanContributionValuationPolicy;
  readonly method: ValuationMethod | null;
  readonly methodSelectedReason: string;
  readonly references: readonly ValuationReferenceDatum[];
  readonly adjustments: readonly ValuationAdjustment[];
  readonly capApplied: CapApplication | null;
  readonly roundingRule: RoundingRule | null;
  readonly reasonCodes: readonly ValuationReasonCode[];
}): ValuationExplanationReceipt {
  return Object.freeze({
    valuationId: input.valuationId,
    methodSelected: input.method,
    methodSelectedReason: input.methodSelectedReason,
    evidenceUsed: input.contribution.evidenceReferences,
    referenceValuesUsed: Object.freeze(
      input.references.map((reference) =>
        Object.freeze({
          referenceId: reference.referenceId,
          sourceClass: reference.sourceClass,
          value: reference.value,
          observedAt: reference.observedAt,
        }),
      ),
    ),
    factorsApplied: input.adjustments,
    capApplied: input.capApplied,
    roundingRule: input.roundingRule,
    policyVersion: input.policy.valuationPolicyVersion as ValuationPolicyVersion,
    reasonCodes: input.reasonCodes,
    containsRawPersonalData: false,
  });
}

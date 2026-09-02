/**
 * Wave 5 — ProductiveValueEngine boundary.
 *
 * Inputs: verified productive contributions + versioned methodology.
 * Outputs: ProductiveValuationResult with auditable receipt.
 *
 * The engine may calculate economic value. It may NOT change MoonRey
 * supply, set MoonRey market price, approve governance, or submit direct
 * mint instructions.
 */

import type { ProductiveBaseValueSchedule } from '../basis.ts';
import { evaluateProductiveValue } from '../engine.ts';
import { developmentValueFunctionPolicy } from '../policy.ts';
import { ProductiveValueResultStore } from '../result.ts';
import type { ProductiveValueFunctionPolicy, ProductiveValueInput } from '../types.ts';
import { productiveValueFunctionEngineStatus } from '../status.ts';
import {
  acceptProductiveEconomicContribution,
  type AcceptContributionInput,
  type ProductiveEconomicContribution,
  type ProductiveContributionRejectionCode,
} from './contribution.ts';
import { auditMarketPriceSeparation } from './market-separation.ts';
import {
  methodologyFromPolicy,
  methodologyReferenceFromPolicy,
  type ProductiveValuationMethodology,
} from './methodology.ts';
import {
  buildProductiveValuationResult,
  buildProductiveValueReceipt,
  type ProductiveValuationResult,
  type ProductiveValueReceipt,
} from './valuation-result.ts';

export const PRODUCTIVE_VALUE_ENGINE_BOUNDARY_ID = 'sunrey.productive-value-engine.boundary.v1' as const;

export type ProductiveValueEngineCapabilities = {
  readonly mayCalculateEconomicValue: true;
  readonly mayChangeMoonReySupply: false;
  readonly maySetMoonReyMarketPrice: false;
  readonly mayApproveGovernance: false;
  readonly maySubmitDirectMintInstruction: false;
};

export const PRODUCTIVE_VALUE_ENGINE_CAPABILITIES: ProductiveValueEngineCapabilities = Object.freeze({
  mayCalculateEconomicValue: true,
  mayChangeMoonReySupply: false,
  maySetMoonReyMarketPrice: false,
  mayApproveGovernance: false,
  maySubmitDirectMintInstruction: false,
});

export type ValuationRejectionCode =
  | ProductiveContributionRejectionCode
  | 'MARKET_PRICE_COUPLING'
  | 'AI_ECONOMIC_JUDGMENT_FORBIDDEN'
  | 'VALUATION_REJECTED'
  | 'VALUATION_REVIEW_REQUIRED'
  | 'METHODOLOGY_VERSION_MISMATCH'
  | 'PEVE_METHODOLOGY_FORBIDDEN'
  | 'DUPLICATE_PRODUCTIVE_EVENT';

export type ProductiveValueEngineEvaluation =
  | {
      readonly ok: true;
      readonly valuation: ProductiveValuationResult;
      readonly receipt: ProductiveValueReceipt;
      readonly methodology: ProductiveValuationMethodology;
    }
  | {
      readonly ok: false;
      readonly code: ValuationRejectionCode;
      readonly detail: string;
    };

export type ProductiveValueEngineContext = {
  readonly policy?: ProductiveValueFunctionPolicy;
  readonly schedule?: ProductiveBaseValueSchedule;
  readonly store?: ProductiveValueResultStore;
};

export class ProductiveValueEngine {
  private readonly valuedEventFingerprints = new Set<string>();
  private readonly valuations = new Map<string, ProductiveValuationResult>();

  readonly capabilities = PRODUCTIVE_VALUE_ENGINE_CAPABILITIES;
  readonly boundaryId = PRODUCTIVE_VALUE_ENGINE_BOUNDARY_ID;
  readonly status = productiveValueFunctionEngineStatus();

  acceptContribution(input: AcceptContributionInput): ReturnType<typeof acceptProductiveEconomicContribution> {
    return acceptProductiveEconomicContribution(input, {
      valuedEventFingerprints: this.valuedEventFingerprints,
    });
  }

  evaluate(input: {
    readonly contribution: ProductiveEconomicContribution;
    readonly valueInput: ProductiveValueInput;
    readonly calculatedAtUtc: string;
    readonly peveMethodologyRequested?: boolean;
    readonly exchangeApiRequired?: boolean;
  }, context: ProductiveValueEngineContext = {}, options?: { readonly allowDuplicateEvent?: boolean }): ProductiveValueEngineEvaluation {
    if (input.peveMethodologyRequested) {
      return { ok: false, code: 'PEVE_METHODOLOGY_FORBIDDEN', detail: 'SunRey PEVE methodology cannot substitute for GPUV' };
    }

    if (input.valueInput.aiEconomicJudgment) {
      return { ok: false, code: 'AI_ECONOMIC_JUDGMENT_FORBIDDEN', detail: 'AI economic judgment cannot modify deterministic GPUV' };
    }

    if (!options?.allowDuplicateEvent && this.valuedEventFingerprints.has(input.contribution.canonicalEvent.eventFingerprint)) {
      return {
        ok: false,
        code: 'DUPLICATE_PRODUCTIVE_EVENT',
        detail: 'duplicate productive event cannot be valued twice',
      };
    }

    const policy = context.policy ?? developmentValueFunctionPolicy();
    const methodology = methodologyFromPolicy(policy);
    const methodologyRef = methodologyReferenceFromPolicy(policy);

    if (
      input.valueInput.valueFunctionPolicyId !== policy.policyId ||
      input.valueInput.valueFunctionPolicyVersion !== policy.policyVersion
    ) {
      return {
        ok: false,
        code: 'METHODOLOGY_VERSION_MISMATCH',
        detail: 'value input policy version does not match active methodology',
      };
    }

    const marketAudit = auditMarketPriceSeparation({
      valueInput: input.valueInput,
      exchangeApiRequired: input.exchangeApiRequired,
    });
    if (!marketAudit.ok) {
      return { ok: false, code: 'MARKET_PRICE_COUPLING', detail: marketAudit.detail };
    }

    const evaluation = evaluateProductiveValue(input.valueInput, {
      policy,
      schedule: context.schedule,
      store: context.store,
    });

    if (evaluation.state === 'VALUE_REJECTED') {
      return {
        ok: false,
        code: evaluation.code === 'AI_ECONOMIC_JUDGMENT_FORBIDDEN' ? 'AI_ECONOMIC_JUDGMENT_FORBIDDEN' : 'VALUATION_REJECTED',
        detail: evaluation.detail ?? 'valuation rejected',
      };
    }
    if (evaluation.state === 'VALUE_REVIEW_REQUIRED' || !evaluation.result) {
      return { ok: false, code: 'VALUATION_REVIEW_REQUIRED', detail: evaluation.detail ?? 'valuation requires review' };
    }

    const evidenceReferences = [
      ...input.contribution.evidenceProofs.map((item) => item.evidenceId),
      ...input.contribution.informationConsensusReceipt.observationIds,
      input.contribution.informationConsensusReceipt.receiptId,
      input.contribution.rightsLicenseProof.rightsId,
    ];

    const valuation = buildProductiveValuationResult({
      contribution: input.contribution,
      methodology: methodologyRef,
      engineResult: evaluation.result,
      evidenceReferences,
      calculatedAtUtc: input.calculatedAtUtc,
    });
    const receipt = buildProductiveValueReceipt(valuation, input.contribution, input.calculatedAtUtc);

    this.valuedEventFingerprints.add(input.contribution.canonicalEvent.eventFingerprint);
    this.valuations.set(valuation.valuationId, valuation);

    return Object.freeze({
      ok: true,
      valuation,
      receipt,
      methodology,
    });
  }

  getValuation(valuationId: string): ProductiveValuationResult | undefined {
    return this.valuations.get(valuationId);
  }

  hasValuedEvent(eventFingerprint: string): boolean {
    return this.valuedEventFingerprints.has(eventFingerprint);
  }

  replayValuation(
    valuationId: string,
    valueInput: ProductiveValueInput,
    contribution: ProductiveEconomicContribution,
    calculatedAtUtc: string,
    context: ProductiveValueEngineContext = {},
  ): ProductiveValueEngineEvaluation {
    const original = this.valuations.get(valuationId);
    if (!original) {
      return { ok: false, code: 'VALUATION_REJECTED', detail: 'unknown valuation for replay' };
    }
    const policy = context.policy ?? developmentValueFunctionPolicy(original.methodology.policyVersion);
    const replay = this.evaluate(
      { contribution, valueInput, calculatedAtUtc },
      { ...context, policy },
      { allowDuplicateEvent: true },
    );
    if (!replay.ok) {
      return replay;
    }
    if (replay.valuation.resultHash !== original.resultHash) {
      return {
        ok: false,
        code: 'VALUATION_REJECTED',
        detail: 'historical replay did not reproduce the original valuation hash',
      };
    }
    return replay;
  }
}

export function createProductiveValueEngine(): ProductiveValueEngine {
  return new ProductiveValueEngine();
}

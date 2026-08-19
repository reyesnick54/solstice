/**
 * Simulation-only V2 shadow evaluation.
 *
 * canonical measurement → economic event → attribution → Productive
 * Value Function (Chunk 123 methods) → GPUV → governed shadow
 * conversion → MoonRey candidate quantity.
 *
 * This is GOVERNED_PRODUCTIVE_VALUE_SIMULATION_V2. It does not mint,
 * does not mutate canonical supply, and does not activate production.
 * Missing required evidence is reported, never fabricated.
 */

import { mulDiv } from '../../formula.ts';
import { WEIGHT_SCALE } from '../../types.ts';
import { categoryPlan, factorDefinition } from '../value-function/factors.ts';
import {
  composeFactors,
  freshnessToBoundedFactor,
  qualityToBoundedFactor,
  utilizationRatio,
  type OrderedFactorApplication,
} from '../value-function/methods.ts';
import { developmentValueFunctionPolicy } from '../value-function/policy.ts';
import {
  VALUE_FACTOR_SCALE,
  type ValueFactorType,
} from '../value-function/types.ts';
import {
  GOVERNED_PRODUCTIVE_VALUE_SIMULATION_V2,
  SHADOW_CONVERSION_POLICY_ID,
  SHADOW_CONVERSION_POLICY_VERSION,
  V2_PRODUCTION_ACTIVE,
} from './identities.ts';
import type {
  MoonReyShadowScenario,
  PathValuation,
  ShadowReasonCode,
} from './types.ts';

export type V2Evaluation = PathValuation & {
  readonly path: typeof GOVERNED_PRODUCTIVE_VALUE_SIMULATION_V2;
  readonly gpuvValue: bigint | null;
  readonly valuePolicyId: string;
  readonly valuePolicyVersion: number;
  readonly conversionPolicyId: string;
  readonly conversionPolicyVersion: number;
  readonly capApplied: boolean;
  readonly warnings: readonly string[];
  readonly productionActive: false;
};

const CAPACITY_STATES = new Set(['INSTALLED_CAPACITY', 'AVAILABLE_CAPACITY', 'RESERVED_CAPACITY']);

export function evaluateGovernedV2(scenario: MoonReyShadowScenario): V2Evaluation {
  const policy = developmentValueFunctionPolicy();
  const plan = categoryPlan(scenario.category);
  const reasons: ShadowReasonCode[] = [];
  const warnings: string[] = [];

  if (V2_PRODUCTION_ACTIVE) {
    throw new Error('V2 production must remain inactive');
  }
  reasons.push('V2_PRODUCTION_INACTIVE');

  const poison = scenario.poison;
  if (poison?.moonreyMarketPriceSelfReference || poison?.issuanceQuantityAsScarcity) {
    return refuse(scenario, ['V2_FEEDBACK_LOOP_REJECTED', 'V2_FORBIDDEN_INPUT'], warnings, 'self-referential economic feedback is rejected');
  }
  if (poison?.rawHttpData) {
    return refuse(scenario, ['V2_FORBIDDEN_INPUT'], warnings, 'raw HTTP data is forbidden');
  }
  if (poison?.fabricatedScarcity) {
    return refuse(scenario, ['V2_FAKE_SCARCITY_REJECTED'], warnings, 'fabricated scarcity is rejected');
  }
  if (poison?.fabricatedUtilization || poison?.providerSelfReportedUtilization) {
    return refuse(scenario, ['V2_FAKE_UTILIZATION_REJECTED'], warnings, 'fabricated or self-reported utilization is rejected');
  }
  if (poison?.conflictingReferenceFacts) {
    return refuse(scenario, ['V2_CONFLICTING_REFERENCE_FACTS'], warnings, 'conflicting reference facts fail closed');
  }
  if (poison?.unitAliasManipulation) {
    return refuse(scenario, ['V2_UNIT_ALIAS_MANIPULATION'], warnings, 'unit alias manipulation is rejected');
  }
  if (poison?.normalizationVersionMismatch) {
    return refuse(scenario, ['V2_NORMALIZATION_VERSION_MISMATCH'], warnings, 'normalization version mismatch fails closed');
  }
  if (poison?.missingAttribution) {
    return refuse(scenario, ['V2_ATTRIBUTION_REQUIRED', 'V2_ATTRIBUTION_BYPASS_REJECTED'], warnings, 'attribution cannot be bypassed');
  }
  if (poison?.categoryRelabel && poison.categoryRelabel !== scenario.category) {
    return refuse(scenario, ['V2_RELABELING_REJECTED'], warnings, 'cross-category relabeling is rejected');
  }
  if (poison?.objectRelabel && poison.objectRelabel !== scenario.objectId) {
    return refuse(scenario, ['V2_RELABELING_REJECTED'], warnings, 'object relabeling is rejected');
  }
  if (poison?.controllerRelabel && poison.controllerRelabel !== scenario.controllerId) {
    return refuse(scenario, ['V2_RELABELING_REJECTED'], warnings, 'controller relabeling is rejected');
  }
  if (poison?.duplicateOfEventId) {
    return refuse(scenario, ['V2_DUPLICATE_CLAIM', 'V2_REPLAY_NO_INCREMENT'], warnings, 'duplicate claim does not create a second valued event');
  }
  if (poison?.staleReference) {
    reasons.push('V2_STALE_REFERENCE');
    warnings.push('stale reference facts cannot increase freshness');
  }
  if ((scenario.replayAttempt ?? 0) > 0) {
    reasons.push('V2_REPLAY_NO_INCREMENT');
    warnings.push('replaying the same event cannot increase canonical attribution');
  }

  if (!policy.eligibleCategories.includes(scenario.category)) {
    return refuse(scenario, ['V2_CATEGORY_NOT_ELIGIBLE'], warnings, `${scenario.category} is not eligible under the simulation value policy`);
  }
  if (!plan.claims.includes(scenario.claimType)) {
    return refuse(scenario, ['V2_CLAIM_NOT_ELIGIBLE'], warnings, `${scenario.claimType} is not an eligible claim for ${scenario.category}`);
  }
  if (CAPACITY_STATES.has(scenario.realizationState) || !plan.realization.includes(scenario.realizationState)) {
    return refuse(scenario, ['V2_REALIZATION_NOT_ELIGIBLE'], warnings, `${scenario.realizationState} is describable but not valued`);
  }

  const share = scenario.attributionShare;
  if (share.denominator <= 0n || share.numerator < 0n || share.numerator > share.denominator) {
    return refuse(scenario, ['V2_ATTRIBUTION_REQUIRED'], warnings, 'attribution share must be an exact rational in [0, 1]');
  }

  const ordered: OrderedFactorApplication[] = [];
  for (const factorType of policy.factorOrder) {
    const resolved = resolveFactor(scenario, factorType, plan.disabled.includes(factorType), plan.required.includes(factorType));
    if (!resolved.ok) {
      return refuse(scenario, resolved.reasonCodes, [...warnings, ...resolved.warnings], resolved.detail);
    }
    ordered.push({ factorType, value: resolved.value });
    warnings.push(...resolved.warnings);
  }

  const composed = composeFactors(
    ordered,
    policy.factorOrder,
    policy.aggregateFactorFloor,
    policy.aggregateFactorCeiling,
    policy.roundingPolicy,
  );
  if (!composed.ok) {
    return refuse(scenario, ['V2_REQUIRED_FACTOR_MISSING'], warnings, composed.detail);
  }

  // Attribution is a composed factor. Apply the product once so share is
  // not double-counted, and never mint from the candidate quantity.
  const gpuv = mulDiv(scenario.canonicalQuantity, composed.value, VALUE_FACTOR_SCALE, policy.roundingPolicy);
  const uncapped = mulDiv(gpuv, scenario.conversionRate, VALUE_FACTOR_SCALE, policy.roundingPolicy);
  if (poison?.conversionAboveCap && uncapped > scenario.conversionCap) {
    return refuse(scenario, ['V2_CONVERSION_CAP_BYPASS_REJECTED'], warnings, 'conversion cap bypass is rejected');
  }
  const capApplied = uncapped > scenario.conversionCap;
  const candidate = capApplied ? scenario.conversionCap : uncapped;
  if (capApplied) {
    reasons.push('V2_CONVERSION_CAP_APPLIED', 'V2_CAP_APPLIED');
  }
  reasons.push('V2_VALUED', 'VALUES_NOT_FABRICATED');

  return Object.freeze({
    path: GOVERNED_PRODUCTIVE_VALUE_SIMULATION_V2,
    valued: true,
    quantity: candidate,
    gpuvValue: gpuv,
    valuePolicyId: scenario.valuePolicyId,
    valuePolicyVersion: scenario.valuePolicyVersion,
    conversionPolicyId: scenario.conversionPolicyId,
    conversionPolicyVersion: scenario.conversionPolicyVersion,
    capApplied,
    reasonCodes: Object.freeze(unique(reasons)),
    warnings: Object.freeze(unique(warnings)),
    productionActive: false,
  });
}

function refuse(
  scenario: MoonReyShadowScenario,
  reasonCodes: readonly ShadowReasonCode[],
  warnings: readonly string[],
  detail: string,
): V2Evaluation {
  return Object.freeze({
    path: GOVERNED_PRODUCTIVE_VALUE_SIMULATION_V2,
    valued: false,
    quantity: null,
    gpuvValue: null,
    valuePolicyId: scenario.valuePolicyId,
    valuePolicyVersion: scenario.valuePolicyVersion,
    conversionPolicyId: scenario.conversionPolicyId,
    conversionPolicyVersion: scenario.conversionPolicyVersion,
    capApplied: false,
    reasonCodes: Object.freeze(unique(['V2_PRODUCTION_INACTIVE', ...reasonCodes])),
    warnings: Object.freeze(unique([...warnings, detail])),
    productionActive: false,
  });
}

type FactorResolution =
  | { readonly ok: true; readonly value: bigint; readonly warnings: readonly string[] }
  | { readonly ok: false; readonly reasonCodes: readonly ShadowReasonCode[]; readonly warnings: readonly string[]; readonly detail: string };

function resolveFactor(
  scenario: MoonReyShadowScenario,
  factorType: ValueFactorType,
  disabled: boolean,
  required: boolean,
): FactorResolution {
  const definition = factorDefinition(factorType);
  if (disabled) {
    return { ok: true, value: definition.neutralValue, warnings: [`${factorType} disabled for ${scenario.category}; neutral factor used, value not fabricated`] };
  }
  const evidence = scenario.evidence;
  let raw: bigint | undefined;
  const warnings: string[] = [];
  switch (factorType) {
    case 'REALIZATION_FACTOR':
      raw = evidence.realization ?? VALUE_FACTOR_SCALE;
      break;
    case 'CLAIM_STATE_FACTOR':
      raw = evidence.claimState ?? VALUE_FACTOR_SCALE;
      break;
    case 'VERIFICATION_QUALITY_FACTOR': {
      if (evidence.quality === undefined) {
        return missing(required, factorType, 'canonical oracle quality');
      }
      if (scenario.poison?.factorAboveCap && evidence.quality > definition.maximum) {
        return {
          ok: false,
          reasonCodes: ['V2_FACTOR_CAP_BYPASS_REJECTED'],
          warnings,
          detail: `${factorType} input exceeds policy maximum`,
        };
      }
      const mapped = qualityToBoundedFactor(evidence.quality, WEIGHT_SCALE, 'FLOOR');
      if (!mapped.ok) {
        return { ok: false, reasonCodes: ['V2_REQUIRED_FACTOR_MISSING'], warnings, detail: mapped.detail };
      }
      raw = mapped.value;
      break;
    }
    case 'FRESHNESS_FACTOR': {
      if (evidence.freshnessAgeEpochs === undefined) {
        return missing(required, factorType, 'fact age');
      }
      const mapped = freshnessToBoundedFactor(
        evidence.freshnessAgeEpochs,
        evidence.freshnessMaxAgeEpochs ?? 8n,
        'FLOOR',
      );
      if (!mapped.ok) {
        return { ok: false, reasonCodes: ['V2_REQUIRED_FACTOR_MISSING'], warnings, detail: mapped.detail };
      }
      raw = mapped.value;
      break;
    }
    case 'SOURCE_INDEPENDENCE_FACTOR':
      raw = evidence.sourceIndependence ?? definition.neutralValue;
      break;
    case 'PROVENANCE_CONFIDENCE_FACTOR':
      raw = evidence.provenanceConfidence ?? definition.neutralValue;
      break;
    case 'UTILIZATION_FACTOR': {
      if (evidence.utilizationActual === undefined || evidence.utilizationBasis === undefined) {
        return missing(required, factorType, 'verified utilization ratio');
      }
      const mapped = utilizationRatio(evidence.utilizationActual, evidence.utilizationBasis, 'FLOOR');
      if (!mapped.ok) {
        return { ok: false, reasonCodes: ['V2_FAKE_UTILIZATION_REJECTED'], warnings, detail: mapped.detail };
      }
      raw = mapped.value;
      break;
    }
    case 'SCARCITY_FACTOR': {
      if (evidence.scarcity === undefined || evidence.scarcityEvidenced !== true) {
        return missing(required, factorType, 'verified scarcity reference');
      }
      raw = evidence.scarcity;
      break;
    }
    case 'GEOGRAPHIC_CONTEXT_FACTOR': {
      if (evidence.geography === undefined || evidence.geographyEvidenced !== true) {
        return missing(required, factorType, 'versioned geographic reference');
      }
      raw = evidence.geography;
      break;
    }
    case 'DELIVERY_FACTOR':
      if (evidence.delivery === undefined) {
        return missing(required, factorType, 'verified delivery state');
      }
      raw = evidence.delivery;
      break;
    case 'ECONOMIC_CATEGORY_FACTOR':
      raw = evidence.category ?? definition.neutralValue;
      break;
    case 'CONCENTRATION_RISK_FACTOR':
      raw = evidence.concentration ?? definition.neutralValue;
      if ((scenario.providerIds.length === 1) && raw === VALUE_FACTOR_SCALE) {
        warnings.push('single-provider dominance remains a review signal, not automatic punishment');
      }
      break;
    case 'ATTRIBUTION_SHARE_FACTOR':
      raw = mulDiv(VALUE_FACTOR_SCALE, scenario.attributionShare.numerator, scenario.attributionShare.denominator, 'FLOOR');
      break;
    default:
      return { ok: false, reasonCodes: ['V2_REQUIRED_FACTOR_MISSING'], warnings, detail: `unsupported factor ${factorType}` };
  }

  if (raw === undefined) {
    return missing(required, factorType, 'factor evidence');
  }
  if (scenario.poison?.factorAboveCap && raw > definition.maximum) {
    return {
      ok: false,
      reasonCodes: ['V2_FACTOR_CAP_BYPASS_REJECTED'],
      warnings,
      detail: `${factorType} ${raw.toString()} exceeds policy maximum ${definition.maximum.toString()}`,
    };
  }
  if (raw < definition.minimum || raw > definition.maximum) {
    return {
      ok: false,
      reasonCodes: ['V2_FACTOR_CAP_BYPASS_REJECTED'],
      warnings,
      detail: `${factorType} outside [${definition.minimum.toString()}, ${definition.maximum.toString()}]`,
    };
  }
  return { ok: true, value: raw, warnings };
}

function missing(required: boolean, factorType: ValueFactorType, evidence: string): FactorResolution {
  if (required) {
    return {
      ok: false,
      reasonCodes: ['V2_REQUIRED_FACTOR_MISSING', 'V2_REQUIRED_EVIDENCE_MISSING'],
      warnings: [],
      detail: `${factorType} required ${evidence} is absent; value is not fabricated`,
    };
  }
  const definition = factorDefinition(factorType);
  return {
    ok: true,
    value: definition.neutralValue,
    warnings: [`${factorType} missing optional ${evidence}; governed neutral used`],
  };
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

export function shadowConversionPolicy() {
  return Object.freeze({
    policyId: SHADOW_CONVERSION_POLICY_ID,
    policyVersion: SHADOW_CONVERSION_POLICY_VERSION,
    parameterClass: 'ENGINEERING_SIMULATION_PARAMETERS',
    productionActivated: false as const,
    notChunk71Issuance: true,
    notMarketPrice: true,
  });
}

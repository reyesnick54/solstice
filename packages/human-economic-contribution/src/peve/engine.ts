/**
 * Wave 6 — Human Economic Value Engine (PEVE).
 *
 * Clean transition:
 *   VerifiedHumanEconomicContributionInput
 *   → HumanEconomicValuation
 *   → HumanEconomicValuationResult (+ receipt)
 *
 * Distinct from platform PEVE (`packages/platform/src/value/`).
 */

import { PROTECTED_TRAIT_FIELDS } from '../taxonomy.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { HumanContributionValuationEngine } from '../valuation/engine.ts';
import type { HumanContributionValuationPolicy, ValuationReferenceDataPort } from '../valuation/types.ts';
import { refuseAiCanonicalPeveInput } from './ai-boundary.ts';
import { PRODUCTION_PEVE_ACTIVATED, WAVE6_PEVE_BOUNDARY } from './constitution.ts';
import { methodologySupportsClass, resolveMethodology } from './methodologies.ts';
import { rejectGpuvAsPeveSubstitute, rejectMarketPriceAsPeveInput } from './market-separation.ts';
import {
  authorizedInputsDigest,
  buildHumanEconomicValuationReceipt,
  wrapEngineResult,
} from './receipt.ts';
import type {
  PeveEvaluateResult,
  VerifiedHumanEconomicContributionInput,
} from './types.ts';

const FORBIDDEN_INPUT_KEYS = new Set([
  'humanWorthScore',
  'humanWorthAssigned',
  'personValue',
  'personWorth',
  'peveScore',
  'aiSubjectiveScore',
  'modelScore',
  'gpuvQuantity',
  'gpuvMinorUnits',
  'exchangePrice',
  'marketCap',
]);

function scanForbiddenPeveInput(extra?: Readonly<Record<string, unknown>>): PeveEvaluateResult | null {
  if (!extra) {
    return null;
  }
  const market = rejectMarketPriceAsPeveInput(extra);
  if (market) {
    return { ok: false, code: market.code, message: 'exchange price and market cap cannot be PEVE inputs' };
  }
  if ('gpuvQuantity' in extra || 'gpuvMinorUnits' in extra) {
    return {
      ok: false,
      code: 'GPUV_CANNOT_SUBSTITUTE_PEVE',
      message: 'MoonRey GPUV cannot substitute for Human Economic Valuation',
    };
  }
  if ('aiSubjectiveScore' in extra || 'modelScore' in extra || extra.actorKind === 'AI') {
    const refused = refuseAiCanonicalPeveInput('AI output cannot directly set canonical PEVE monetary input');
    return { ok: false, code: refused.code, message: refused.message };
  }
  for (const [key, value] of Object.entries(extra)) {
    if (FORBIDDEN_INPUT_KEYS.has(key)) {
      if (key.includes('peve') && value === false) {
        continue;
      }
      if (key.includes('humanWorth') || key.includes('person')) {
        return { ok: false, code: 'HUMAN_WORTH_INPUT_FORBIDDEN', message: `forbidden field '${key}'` };
      }
      if (key.includes('peve')) {
        return { ok: false, code: 'PEVE_INPUT_FORBIDDEN', message: `forbidden field '${key}'` };
      }
    }
    if ((PROTECTED_TRAIT_FIELDS as readonly string[]).includes(key)) {
      return {
        ok: false,
        code: 'PROTECTED_TRAIT_INPUT_FORBIDDEN',
        message: `protected trait '${key}' cannot alter contribution valuation`,
      };
    }
  }
  return null;
}

function validateInput(input: VerifiedHumanEconomicContributionInput): PeveEvaluateResult | null {
  if (input.contribution.status !== 'VERIFIED' || !input.contribution.verifiedMeasurement) {
    return { ok: false, code: 'CONTRIBUTION_NOT_VERIFIED', message: 'contribution must be VERIFIED with measurement' };
  }
  if (input.uniquenessStatus === 'DUPLICATE_REJECTED') {
    return { ok: false, code: 'DUPLICATE_CONTRIBUTION', message: 'duplicate contribution rejected' };
  }
  if (input.uniquenessStatus !== 'UNIQUE') {
    return { ok: false, code: 'UNIQUENESS_REJECTED', message: `uniqueness status ${input.uniquenessStatus} is not UNIQUE` };
  }
  if (input.identityAssuranceLevel === 'UNVERIFIED') {
    return {
      ok: false,
      code: 'IDENTITY_ASSURANCE_INSUFFICIENT',
      message: 'identity assurance level must be above UNVERIFIED',
    };
  }
  const methodology = resolveMethodology(input.methodologyId, input.methodologyVersion);
  if (!methodology) {
    return {
      ok: false,
      code: 'METHODOLOGY_MISMATCH',
      message: 'methodology id/version not found in simulation registry',
    };
  }
  if (!methodologySupportsClass(methodology, input.contributionClass)) {
    return {
      ok: false,
      code: 'METHODOLOGY_MISMATCH',
      message: 'methodology does not support contribution class',
    };
  }
  if (methodology.requiresRightsProof && input.rightsProofRefs.length === 0) {
    return { ok: false, code: 'RIGHTS_PROOF_MISSING', message: 'rights proof required for this methodology' };
  }
  if (methodology.requiresConsentProof && input.consentProofRefs.length === 0) {
    return { ok: false, code: 'CONSENT_PROOF_MISSING', message: 'consent proof required for this methodology' };
  }
  if (input.containsRawPersonalData) {
    return { ok: false, code: 'RAW_PERSONAL_DATA_REJECTED', message: 'raw personal data rejected' };
  }
  if (input.humanWorthAssigned || input.humanWorthScore || input.peveScoreUsedAsValue) {
    return { ok: false, code: 'HUMAN_WORTH_INPUT_FORBIDDEN', message: 'human-worth fields must remain false' };
  }
  return null;
}

export class HumanEconomicValueEngine {
  private readonly valuationEngine: HumanContributionValuationEngine;
  private readonly settledInputDigests = new Set<string>();

  constructor(references: ValuationReferenceDataPort) {
    this.valuationEngine = new HumanContributionValuationEngine(references);
  }

  get boundary(): typeof WAVE6_PEVE_BOUNDARY {
    return WAVE6_PEVE_BOUNDARY;
  }

  evaluate(input: {
    readonly valuationInput: VerifiedHumanEconomicContributionInput;
    readonly policy: HumanContributionValuationPolicy;
    readonly valuationTimestamp: UtcInstant;
    readonly policyReference: string;
    readonly extra?: Readonly<Record<string, unknown>>;
  }): PeveEvaluateResult {
    if (PRODUCTION_PEVE_ACTIVATED) {
      return { ok: false, code: 'PRODUCTION_PEVE_UNAVAILABLE', message: 'production PEVE is not activated' };
    }
    const forbidden = scanForbiddenPeveInput(input.extra);
    if (forbidden) {
      return forbidden;
    }
    if (input.extra?.gpuvQuantity) {
      return {
        ...rejectGpuvAsPeveSubstitute(input.extra.gpuvQuantity as { gpuvMinorUnits: bigint; productiveClaimId: string }),
        message: 'MoonRey GPUV cannot substitute for PEVE',
      };
    }
    const validation = validateInput(input.valuationInput);
    if (validation) {
      return validation;
    }
    const digest = authorizedInputsDigest(input.valuationInput);
    if (this.settledInputDigests.has(digest)) {
      return { ok: false, code: 'DUPLICATE_CONTRIBUTION', message: 'duplicate valuation input digest' };
    }
    const engineResult = this.valuationEngine.evaluate({
      contribution: input.valuationInput.contribution,
      policy: input.policy,
      valuationTimestamp: input.valuationTimestamp,
    });
    const result = wrapEngineResult({
      valuationInput: input.valuationInput,
      engineResult,
    });
    const receipt = buildHumanEconomicValuationReceipt({
      valuationInput: input.valuationInput,
      valuationResult: result,
      engineResult,
      policyReference: input.policyReference,
    });
    if (result.state === 'VALUED_SIMULATION') {
      this.settledInputDigests.add(digest);
    }
    return Object.freeze({ ok: true, result, receipt });
  }
}

export function refuseProductionPeve(): { readonly ok: false; readonly code: 'PRODUCTION_PEVE_UNAVAILABLE' } {
  return { ok: false, code: 'PRODUCTION_PEVE_UNAVAILABLE' };
}

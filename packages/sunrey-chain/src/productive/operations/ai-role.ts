/**
 * Wave 5 — AI role boundaries for productive operations.
 *
 * AI may identify anomalies, compare observations, explain conflicts,
 * suggest source dependencies, and summarize challenge evidence.
 *
 * AI may NOT declare a disputed productive fact valid, override source
 * quorum, override rights, approve issuance, or modify supply.
 */

import type { ProductiveOperationsRejection } from './types.ts';

export const AI_ALLOWED_CAPABILITIES = [
  'IDENTIFY_ANOMALIES',
  'COMPARE_OBSERVATIONS',
  'EXPLAIN_CONFLICTS',
  'SUGGEST_SOURCE_DEPENDENCIES',
  'SUMMARIZE_CHALLENGE_EVIDENCE',
] as const;
export type AiAllowedCapability = (typeof AI_ALLOWED_CAPABILITIES)[number];

export const AI_FORBIDDEN_CAPABILITIES = [
  'DECLARE_DISPUTED_FACT_VALID',
  'OVERRIDE_SOURCE_QUORUM',
  'OVERRIDE_RIGHTS',
  'APPROVE_ISSUANCE',
  'MODIFY_SUPPLY',
] as const;
export type AiForbiddenCapability = (typeof AI_FORBIDDEN_CAPABILITIES)[number];

export type AiSuggestion = {
  readonly suggestionId: string;
  readonly capability: AiAllowedCapability;
  readonly summary: string;
  readonly evidenceCommitment: string;
  readonly authoritative: false;
};

export function createAiSuggestion(input: {
  readonly suggestionId: string;
  readonly capability: AiAllowedCapability;
  readonly summary: string;
  readonly evidenceCommitment: string;
}): AiSuggestion {
  return Object.freeze({
    suggestionId: input.suggestionId,
    capability: input.capability,
    summary: input.summary,
    evidenceCommitment: input.evidenceCommitment,
    authoritative: false,
  });
}

export function refuseAiHardRuleOverride(
  capability: AiForbiddenCapability,
): { readonly ok: false; readonly rejection: ProductiveOperationsRejection } {
  return {
    ok: false,
    rejection: Object.freeze({
      code: 'AI_CANNOT_OVERRIDE_HARD_RULE',
      detail: `AI cannot perform forbidden capability: ${capability}`,
    }),
  };
}

export function refuseAiFactValidation(): {
  readonly ok: false;
  readonly rejection: ProductiveOperationsRejection;
} {
  return {
    ok: false,
    rejection: Object.freeze({
      code: 'AI_CANNOT_DECLARE_FACT_VALID',
      detail: 'AI cannot declare a disputed productive fact valid',
    }),
  };
}

export function refuseAiIssuanceApproval(): {
  readonly ok: false;
  readonly rejection: ProductiveOperationsRejection;
} {
  return {
    ok: false,
    rejection: Object.freeze({
      code: 'AI_CANNOT_APPROVE_ISSUANCE',
      detail: 'AI cannot approve MoonRey issuance or modify supply',
    }),
  };
}

export function aiCapabilityAllowed(capability: string): capability is AiAllowedCapability {
  return (AI_ALLOWED_CAPABILITIES as readonly string[]).includes(capability);
}

export function aiCapabilityForbidden(capability: string): capability is AiForbiddenCapability {
  return (AI_FORBIDDEN_CAPABILITIES as readonly string[]).includes(capability);
}

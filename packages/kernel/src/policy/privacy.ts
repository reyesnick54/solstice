import {
  evaluatePurposeCompatibility,
  type DataPurpose,
  type PersonalDataCategory,
} from '../purpose.ts';
import type { LegalReviewState } from './schema.ts';
import { packFor } from './evaluate.ts';

export type PrivacyWhen = {
  readonly category?: string;
  readonly purpose?: string;
  readonly purposeIn?: readonly string[];
};

export type PrivacyRule = {
  readonly id: string;
  readonly title: string;
  readonly legalReviewState: LegalReviewState;
  readonly enabled: boolean;
  readonly effect: {
    readonly type: 'FORBID_PURPOSE';
    readonly when: PrivacyWhen;
  };
  readonly plainLanguageReason: string;
};

export type PrivacyDecision = {
  readonly allow: boolean;
  readonly reasons: readonly string[];
  readonly matchedRuleIds: readonly string[];
};

function privacyRuleIsLive(rule: PrivacyRule): boolean {
  if (rule.legalReviewState === 'CONFIRMED_BY_COUNSEL') {
    return false;
  }
  if (rule.legalReviewState === 'RESEARCH_REQUIRED') {
    return false;
  }
  return rule.enabled && rule.legalReviewState === 'DRAFT';
}

function whenMatches(
  when: PrivacyWhen,
  category: PersonalDataCategory,
  purpose: DataPurpose,
): boolean {
  if (when.category !== undefined && when.category !== category) {
    return false;
  }
  if (when.purpose !== undefined && when.purpose !== purpose) {
    return false;
  }
  if (when.purposeIn !== undefined && !when.purposeIn.includes(purpose)) {
    return false;
  }
  return true;
}

/**
 * Jurisdiction privacy rules. All rules in this build are DRAFT.
 * None are CONFIRMED_BY_COUNSEL. RESEARCH_REQUIRED rules never permit.
 */
export function evaluatePrivacyRules(input: {
  readonly jurisdiction: string;
  readonly category: PersonalDataCategory;
  readonly purpose: DataPurpose;
}): PrivacyDecision {
  const compatibility = evaluatePurposeCompatibility(input.category, input.purpose);
  if (!compatibility.allowed) {
    return Object.freeze({
      allow: false,
      reasons: compatibility.reasons,
      matchedRuleIds: Object.freeze(['PURPOSE_MATRIX']),
    });
  }

  const pack = packFor(input.jurisdiction) ?? packFor('US');
  const rules = (pack as { privacyRules?: readonly PrivacyRule[] } | undefined)?.privacyRules ?? [];
  const matched: string[] = [];
  const reasons: string[] = [];
  for (const rule of rules) {
    if (rule.effect.type !== 'FORBID_PURPOSE') {
      continue;
    }
    if (!privacyRuleIsLive(rule) || !whenMatches(rule.effect.when, input.category, input.purpose)) {
      continue;
    }
    matched.push(rule.id);
    reasons.push(rule.plainLanguageReason);
    return Object.freeze({
      allow: false,
      reasons: Object.freeze(reasons),
      matchedRuleIds: Object.freeze(matched),
    });
  }

  return Object.freeze({
    allow: true,
    reasons: Object.freeze([
      `no live privacy forbid matched for ${input.category}/${input.purpose} in ${pack?.jurisdiction ?? input.jurisdiction}`,
    ]),
    matchedRuleIds: Object.freeze(matched),
  });
}

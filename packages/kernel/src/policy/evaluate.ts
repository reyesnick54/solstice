import { ENVIRONMENT, LIVE_FLAGS, assertSimulationOnly } from '../flags.ts';
import type {
  JurisdictionPack,
  LegalReviewState,
  PolicyQuestion,
  ProductRule,
  RuleWhen,
} from './schema.ts';
import aePack from './packs/AE.json' with { type: 'json' };
import euPack from './packs/EU.json' with { type: 'json' };
import gbPack from './packs/GB.json' with { type: 'json' };
import saPack from './packs/SA.json' with { type: 'json' };
import usPack from './packs/US.json' with { type: 'json' };

export type PolicyDecision = {
  readonly allow: boolean;
  readonly posture: 'CLEAR' | 'BLOCK';
  readonly packVersion: string;
  readonly packJurisdiction: string;
  readonly matchedRuleIds: readonly string[];
  readonly reasons: readonly string[];
  readonly legalReviewStates: readonly LegalReviewState[];
};

const PACKS: readonly JurisdictionPack[] = [
  usPack as JurisdictionPack,
  gbPack as JurisdictionPack,
  euPack as JurisdictionPack,
  saPack as JurisdictionPack,
  aePack as JurisdictionPack,
];

export function loadPacks(): readonly JurisdictionPack[] {
  return PACKS;
}

export function packFor(jurisdiction: string): JurisdictionPack | undefined {
  if (jurisdiction === 'DE' || jurisdiction === 'FR' || jurisdiction === 'IE' || jurisdiction === 'NL') {
    return PACKS.find((pack) => pack.jurisdiction === 'EU');
  }
  return PACKS.find((pack) => pack.jurisdiction === jurisdiction);
}

function whenMatches(when: RuleWhen, question: PolicyQuestion): boolean {
  if (when.action !== undefined && when.action !== question.action) {
    return false;
  }
  if (when.product !== undefined && when.product !== question.product) {
    return false;
  }
  if (when.sourceCountry !== undefined && when.sourceCountry !== question.sourceCountry) {
    return false;
  }
  if (when.destinationCountry !== undefined && when.destinationCountry !== question.destinationCountry) {
    return false;
  }
  if (
    when.destinationCountryIn !== undefined &&
    !when.destinationCountryIn.includes(question.destinationCountry)
  ) {
    return false;
  }
  if (when.currency !== undefined && when.currency !== question.currency) {
    return false;
  }
  if (when.sameCountry === true && question.sourceCountry !== question.destinationCountry) {
    return false;
  }
  if (when.sameCountry === false && question.sourceCountry === question.destinationCountry) {
    return false;
  }
  return true;
}

function ruleIsLive(rule: ProductRule): boolean {
  if (rule.legalReviewState === 'CONFIRMED_BY_COUNSEL') {
    // This build must not treat any rule as counsel-confirmed.
    return false;
  }
  if (rule.legalReviewState === 'RESEARCH_REQUIRED') {
    return false;
  }
  if (!rule.enabled) {
    return false;
  }
  return rule.legalReviewState === 'DRAFT' && ENVIRONMENT === 'simulation';
}

/**
 * Default-deny policy engine. A product is allowed only when a live
 * SIMULATION_EXCEPTION matches, no live FORBID matches, and no LIVE_*
 * flag is on. RESEARCH_REQUIRED rules never permit. No rule in this
 * repository is CONFIRMED_BY_COUNSEL.
 */
export function evaluatePolicy(question: PolicyQuestion): PolicyDecision {
  assertSimulationOnly();
  if (Object.values(LIVE_FLAGS).some((flag) => flag !== false)) {
    return deny(question, 'live flags must stay false');
  }

  const pack = packFor(question.sourceCountry) ?? packFor('US');
  if (!pack) {
    return deny(question, 'no jurisdiction pack loaded');
  }

  const reasons: string[] = [];
  const matched: string[] = [];
  const states: LegalReviewState[] = [];

  for (const rule of pack.rules) {
    if (rule.effect.type !== 'FORBID') {
      continue;
    }
    if (!ruleIsLive(rule) || !whenMatches(rule.effect.when, question)) {
      continue;
    }
    matched.push(rule.id);
    states.push(rule.legalReviewState);
    reasons.push(rule.plainLanguageReason);
    return Object.freeze({
      allow: false,
      posture: 'BLOCK',
      packVersion: pack.version,
      packJurisdiction: pack.jurisdiction,
      matchedRuleIds: Object.freeze(matched),
      reasons: Object.freeze(reasons),
      legalReviewStates: Object.freeze(states),
    });
  }

  let exception: ProductRule | undefined;
  for (const rule of pack.rules) {
    if (rule.effect.type !== 'SIMULATION_EXCEPTION') {
      continue;
    }
    if (!ruleIsLive(rule) || !whenMatches(rule.effect.when, question)) {
      continue;
    }
    if (rule.effect.product !== question.product) {
      continue;
    }
    exception = rule;
    matched.push(rule.id);
    states.push(rule.legalReviewState);
    reasons.push(rule.plainLanguageReason);
    break;
  }

  if (!exception) {
    return Object.freeze({
      allow: false,
      posture: 'BLOCK',
      packVersion: pack.version,
      packJurisdiction: pack.jurisdiction,
      matchedRuleIds: Object.freeze(matched),
      reasons: Object.freeze([
        `default deny: no live simulation exception for product ${question.product} in ${pack.jurisdiction}`,
      ]),
      legalReviewStates: Object.freeze(states),
    });
  }

  return Object.freeze({
    allow: true,
    posture: 'CLEAR',
    packVersion: pack.version,
    packJurisdiction: pack.jurisdiction,
    matchedRuleIds: Object.freeze(matched),
    reasons: Object.freeze(reasons),
    legalReviewStates: Object.freeze(states),
  });
}

function deny(question: PolicyQuestion, reason: string): PolicyDecision {
  return Object.freeze({
    allow: false,
    posture: 'BLOCK',
    packVersion: 'none',
    packJurisdiction: question.sourceCountry,
    matchedRuleIds: Object.freeze([] as string[]),
    reasons: Object.freeze([reason]),
    legalReviewStates: Object.freeze([] as LegalReviewState[]),
  });
}

export function assertNoCounselConfirmed(packs: readonly JurisdictionPack[] = PACKS): void {
  for (const pack of packs) {
    for (const rule of pack.rules) {
      if (rule.legalReviewState === 'CONFIRMED_BY_COUNSEL') {
        throw new Error(
          `Rule ${rule.id} in pack ${pack.jurisdiction} is marked CONFIRMED_BY_COUNSEL, which this build forbids`,
        );
      }
    }
    for (const rule of pack.privacyRules ?? []) {
      if (rule.legalReviewState === 'CONFIRMED_BY_COUNSEL') {
        throw new Error(
          `Privacy rule ${rule.id} in pack ${pack.jurisdiction} is marked CONFIRMED_BY_COUNSEL, which this build forbids`,
        );
      }
    }
  }
}

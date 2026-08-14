import { asUtcInstant, isUtcInstant } from '../../../../domain/src/time.ts';
import { hashCanonical } from '../hash.ts';
import { isFactPath, type PolicyPredicate } from '../predicates.ts';
import type { ScreeningRequirements } from '../../compliance/types.ts';
import { DEFAULT_SIMULATION_SCREENING_REQUIREMENTS } from '../../compliance/types.ts';
import type {
  LegalReviewStatus,
  OverrideClass,
  PolicyPack,
  PolicyPackId,
  PolicyRule,
  PolicyVersionRecord,
  RuleEffect,
} from '../types.ts';
import {
  isLegalReviewStatus,
  isPolicyLifecycle,
  isPolicyPackId,
  LEGAL_REVIEW_STATUSES,
  OVERRIDE_CLASSES,
  RULE_EFFECTS,
} from '../types.ts';

export type PackFile = {
  readonly packId: PolicyPackId;
  readonly name: string;
  readonly description: string;
  readonly versions: readonly PackFileVersion[];
};

export type PackFileVersion = {
  readonly versionId: string;
  readonly version: string;
  readonly lifecycle: string;
  readonly legalReviewStatus: string;
  readonly effectiveFrom: string;
  readonly effectiveUntil?: string;
  readonly rules: readonly PackFileRule[];
};

export type PackFileRule = {
  readonly ruleId: string;
  readonly version: string;
  readonly jurisdiction: string;
  readonly scope: string;
  readonly actionTypes: readonly string[];
  readonly productTypes: readonly string[];
  readonly customerTypes: readonly string[];
  readonly legalEntity?: string;
  readonly predicate: PolicyPredicate;
  readonly effect: string;
  readonly reasonCode: string;
  readonly effectiveFrom: string;
  readonly effectiveUntil?: string;
  readonly sourceReference?: string;
  readonly legalReviewStatus: string;
  readonly overrideClass: string;
};

export function loadPackFile(raw: unknown): PolicyPack {
  if (!isRecord(raw)) {
    throw new Error('policy pack is not an object');
  }
  if (!isPolicyPackId(raw.packId)) {
    throw new Error('policy pack is missing a valid packId');
  }
  if (typeof raw.name !== 'string' || typeof raw.description !== 'string') {
    throw new Error(`policy pack ${String(raw.packId)} is missing name/description`);
  }
  if (!Array.isArray(raw.versions) || raw.versions.length === 0) {
    throw new Error(`policy pack ${raw.packId} has no versions`);
  }
  const packId = raw.packId;
  const versions = raw.versions.map((row) => loadVersion(packId, row));
  return Object.freeze({
    packId: raw.packId,
    name: raw.name,
    description: raw.description,
    versions: Object.freeze(versions),
  });
}

function loadVersion(packId: PolicyPackId, raw: unknown): PolicyVersionRecord {
  if (!isRecord(raw)) {
    throw new Error(`policy pack ${packId} has an invalid version`);
  }
  if (typeof raw.versionId !== 'string' || typeof raw.version !== 'string') {
    throw new Error(`policy pack ${packId} version is missing identifiers`);
  }
  if (!isPolicyLifecycle(raw.lifecycle)) {
    throw new Error(`policy pack ${packId} version ${raw.versionId} has invalid lifecycle`);
  }
  if (!isLegalReviewStatus(raw.legalReviewStatus)) {
    throw new Error(`policy pack ${packId} version ${raw.versionId} is missing legalReviewStatus`);
  }
  if (raw.legalReviewStatus === 'CONFIRMED_BY_COUNSEL') {
    throw new Error(
      `policy pack ${packId} version ${raw.versionId} cannot be CONFIRMED_BY_COUNSEL; no counsel confirmation exists in this repository`,
    );
  }
  if (typeof raw.effectiveFrom !== 'string' || !isUtcInstant(raw.effectiveFrom)) {
    throw new Error(`policy pack ${packId} version ${raw.versionId} has a non-UTC effectiveFrom`);
  }
  if (raw.effectiveUntil !== undefined && (typeof raw.effectiveUntil !== 'string' || !isUtcInstant(raw.effectiveUntil))) {
    throw new Error(`policy pack ${packId} version ${raw.versionId} has a non-UTC effectiveUntil`);
  }
  if (!Array.isArray(raw.rules)) {
    throw new Error(`policy pack ${packId} version ${raw.versionId} rules must be an array`);
  }
  const rules = raw.rules.map((rule) => loadRule(packId, rule));
  const screeningRequirements = loadScreeningRequirements(raw.screeningRequirements);
  const draft: Omit<PolicyVersionRecord, 'contentHash'> = {
    versionId: raw.versionId,
    packId,
    version: raw.version,
    lifecycle: raw.lifecycle,
    legalReviewStatus: raw.legalReviewStatus,
    effectiveFrom: asUtcInstant(raw.effectiveFrom),
    ...(raw.effectiveUntil ? { effectiveUntil: asUtcInstant(raw.effectiveUntil) } : {}),
    rules,
    screeningRequirements,
  };
  return Object.freeze({
    ...draft,
    contentHash: hashCanonical({
      packId: draft.packId,
      version: draft.version,
      lifecycle: draft.lifecycle,
      legalReviewStatus: draft.legalReviewStatus,
      effectiveFrom: draft.effectiveFrom,
      effectiveUntil: draft.effectiveUntil ?? null,
      rules: draft.rules,
      screeningRequirements: draft.screeningRequirements,
    }),
  });
}

function loadScreeningRequirements(raw: unknown): ScreeningRequirements {
  if (!isRecord(raw)) {
    return DEFAULT_SIMULATION_SCREENING_REQUIREMENTS;
  }
  return Object.freeze({
    sanctions: loadRequirement(raw.sanctions, DEFAULT_SIMULATION_SCREENING_REQUIREMENTS.sanctions),
    pep: loadRequirement(raw.pep, DEFAULT_SIMULATION_SCREENING_REQUIREMENTS.pep),
    adverseMedia: loadRequirement(raw.adverseMedia, DEFAULT_SIMULATION_SCREENING_REQUIREMENTS.adverseMedia),
    transactionMonitoring: loadRequirement(
      raw.transactionMonitoring,
      DEFAULT_SIMULATION_SCREENING_REQUIREMENTS.transactionMonitoring,
    ),
    fraud: loadRequirement(raw.fraud, DEFAULT_SIMULATION_SCREENING_REQUIREMENTS.fraud),
    deviceRisk: loadRequirement(raw.deviceRisk, DEFAULT_SIMULATION_SCREENING_REQUIREMENTS.deviceRisk),
  });
}

function loadRequirement(
  raw: unknown,
  fallback: ScreeningRequirements['sanctions'],
): ScreeningRequirements['sanctions'] {
  if (!isRecord(raw)) {
    return fallback;
  }
  return Object.freeze({
    required: typeof raw.required === 'boolean' ? raw.required : fallback.required,
    maxAgeHours: typeof raw.maxAgeHours === 'number' ? raw.maxAgeHours : fallback.maxAgeHours,
    onUnavailable:
      raw.onUnavailable === 'DEFER' ||
      raw.onUnavailable === 'REQUIRE_MANUAL_REVIEW' ||
      raw.onUnavailable === 'BLOCK'
        ? raw.onUnavailable
        : fallback.onUnavailable,
  });
}

function loadRule(packId: PolicyPackId, raw: unknown): PolicyRule {
  if (!isRecord(raw)) {
    throw new Error(`policy pack ${packId} contains a non-object rule`);
  }
  if (typeof raw.ruleId !== 'string' || typeof raw.version !== 'string') {
    throw new Error(`policy pack ${packId} rule is missing ruleId/version`);
  }
  if (!isPolicyPackId(raw.jurisdiction) || raw.jurisdiction !== packId) {
    throw new Error(`policy pack ${packId} rule ${String(raw.ruleId)} jurisdiction mismatch`);
  }
  if (!isLegalReviewStatus(raw.legalReviewStatus)) {
    throw new Error(`policy pack ${packId} rule ${raw.ruleId} is missing legalReviewStatus`);
  }
  if (raw.legalReviewStatus === 'CONFIRMED_BY_COUNSEL') {
    throw new Error(
      `policy pack ${packId} rule ${raw.ruleId} cannot be CONFIRMED_BY_COUNSEL; no counsel confirmation exists in this repository`,
    );
  }
  if (!isRuleEffect(raw.effect)) {
    throw new Error(`policy pack ${packId} rule ${raw.ruleId} has an invalid effect`);
  }
  if (!isOverrideClass(raw.overrideClass)) {
    throw new Error(`policy pack ${packId} rule ${raw.ruleId} has an invalid overrideClass`);
  }
  if (typeof raw.effectiveFrom !== 'string' || !isUtcInstant(raw.effectiveFrom)) {
    throw new Error(`policy pack ${packId} rule ${raw.ruleId} has a non-UTC effectiveFrom`);
  }
  assertPredicate(raw.predicate, `${packId}/${raw.ruleId}`);
  return Object.freeze({
    ruleId: raw.ruleId,
    version: raw.version,
    jurisdiction: raw.jurisdiction,
    scope: String(raw.scope ?? 'default'),
    actionTypes: Object.freeze(asStringArray(raw.actionTypes)),
    productTypes: Object.freeze(asStringArray(raw.productTypes)),
    customerTypes: Object.freeze(asStringArray(raw.customerTypes)),
    ...(typeof raw.legalEntity === 'string' ? { legalEntity: raw.legalEntity } : {}),
    predicate: raw.predicate as PolicyPredicate,
    effect: raw.effect,
    reasonCode: String(raw.reasonCode),
    effectiveFrom: asUtcInstant(raw.effectiveFrom),
    ...(typeof raw.effectiveUntil === 'string'
      ? { effectiveUntil: asUtcInstant(raw.effectiveUntil) }
      : {}),
    ...(typeof raw.sourceReference === 'string' ? { sourceReference: raw.sourceReference } : {}),
    legalReviewStatus: raw.legalReviewStatus,
    overrideClass: raw.overrideClass,
  });
}

function assertPredicate(value: unknown, label: string): void {
  if (!isRecord(value) || typeof value.op !== 'string') {
    throw new Error(`policy predicate ${label} is not a typed operator`);
  }
  if (value.op === 'and' || value.op === 'or') {
    if (!Array.isArray(value.predicates)) {
      throw new Error(`policy predicate ${label} is missing child predicates`);
    }
    for (const child of value.predicates) {
      assertPredicate(child, label);
    }
    return;
  }
  if (value.op === 'not') {
    assertPredicate(value.predicate, label);
    return;
  }
  if (!isFactPath(value.fact)) {
    throw new Error(`policy predicate ${label} uses an unknown fact path`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

function isRuleEffect(value: unknown): value is RuleEffect {
  return typeof value === 'string' && (RULE_EFFECTS as readonly string[]).includes(value);
}

function isOverrideClass(value: unknown): value is OverrideClass {
  return typeof value === 'string' && (OVERRIDE_CLASSES as readonly string[]).includes(value);
}

export const LEGAL_REVIEW_STATUS_VALUES = LEGAL_REVIEW_STATUSES;

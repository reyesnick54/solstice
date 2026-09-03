import { err, ok, type Result } from '../../../domain/src/result.ts';
import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import {
  ACCESS_CATEGORIES,
  ACCESS_CONSTRAINT_KINDS,
  ACCESS_DURATION_UNITS,
  ACCESS_EXPERIENCE_LEVELS,
  ACCESS_INTENT_KINDS,
  ACCESS_RECURRENCE,
  isAccessCategory,
  isAccessIntentKind,
  isAuthorizedGraphCategory,
} from './taxonomy.ts';
import type { AccessIntent, AccessIntentFailure } from './types.ts';
import { asAccessIntentId } from './types.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function validateTarget(value: unknown): Result<AccessIntent['target'], AccessIntentFailure> {
  if (!isRecord(value) || typeof value.productType !== 'string' || value.productType.length === 0) {
    return err({ code: 'MALFORMED_INTENT', message: 'target.productType is required' });
  }
  const attributes = value.attributes;
  if (!Array.isArray(attributes)) {
    return err({ code: 'MALFORMED_INTENT', message: 'target.attributes must be an array' });
  }
  for (const attribute of attributes) {
    if (!isRecord(attribute) || typeof attribute.key !== 'string' || typeof attribute.value !== 'string') {
      return err({ code: 'MALFORMED_INTENT', message: 'target.attributes entries require key and value strings' });
    }
  }
  return ok(
    Object.freeze({
      productType: value.productType,
      attributes: Object.freeze(
        attributes.map((attribute) =>
          Object.freeze({
            key: attribute.key as string,
            value: attribute.value as string,
          }),
        ),
      ),
      ...(typeof value.brandOrModel === 'string' ? { brandOrModel: value.brandOrModel } : {}),
    }),
  );
}

function validateGeography(value: unknown): Result<AccessIntent['geography'], AccessIntentFailure> {
  if (!isRecord(value) || typeof value.region !== 'string' || value.region.length === 0) {
    return err({ code: 'MALFORMED_INTENT', message: 'geography.region is required' });
  }
  return ok(
    Object.freeze({
      region: value.region,
      ...(typeof value.country === 'string' ? { country: value.country } : {}),
      ...(typeof value.city === 'string' ? { city: value.city } : {}),
    }),
  );
}

function validateWindow(value: unknown): Result<AccessIntent['window'], AccessIntentFailure> {
  if (!isRecord(value)) {
    return err({ code: 'MALFORMED_INTENT', message: 'window must be an object' });
  }
  if (value.recurrence !== undefined && !(ACCESS_RECURRENCE as readonly string[]).includes(String(value.recurrence))) {
    return err({ code: 'MALFORMED_INTENT', message: 'window.recurrence is invalid' });
  }
  return ok(
    Object.freeze({
      ...(typeof value.startAt === 'string' ? { startAt: asUtcInstant(value.startAt) } : {}),
      ...(typeof value.endAt === 'string' ? { endAt: asUtcInstant(value.endAt) } : {}),
      ...(typeof value.durationDays === 'number' ? { durationDays: value.durationDays } : {}),
      ...(typeof value.durationWeeks === 'number' ? { durationWeeks: value.durationWeeks } : {}),
      ...(value.recurrence ? { recurrence: value.recurrence as AccessIntent['window']['recurrence'] } : {}),
    }),
  );
}

export function validateAccessIntentDraft(
  draft: unknown,
): Result<Omit<AccessIntent, 'executable' | 'confirmsReservation'>, AccessIntentFailure> {
  if (!isRecord(draft)) {
    return err({ code: 'MALFORMED_INTENT', message: 'intent must be an object' });
  }
  if (typeof draft.intentId !== 'string' || typeof draft.subjectId !== 'string' || draft.subjectId.length === 0) {
    return err({ code: 'MALFORMED_INTENT', message: 'intentId and subjectId are required' });
  }
  if (!isAccessCategory(draft.category)) {
    return err({ code: 'MALFORMED_INTENT', message: `category must be one of ${ACCESS_CATEGORIES.join(', ')}` });
  }
  if (!isAccessIntentKind(draft.kind)) {
    return err({ code: 'MALFORMED_INTENT', message: `kind must be one of ${ACCESS_INTENT_KINDS.join(', ')}` });
  }
  if (!(ACCESS_EXPERIENCE_LEVELS as readonly string[]).includes(String(draft.experienceLevel))) {
    return err({ code: 'MALFORMED_INTENT', message: 'experienceLevel is invalid' });
  }
  const target = validateTarget(draft.target);
  if (!target.ok) {
    return target;
  }
  const geography = validateGeography(draft.geography);
  if (!geography.ok) {
    return geography;
  }
  const window = validateWindow(draft.window);
  if (!window.ok) {
    return window;
  }
  if (!isStringArray(draft.qualityPreferences)) {
    return err({ code: 'MALFORMED_INTENT', message: 'qualityPreferences must be a string array' });
  }
  if (!isRecord(draft.substitutions) || typeof draft.substitutions.acceptable !== 'boolean') {
    return err({ code: 'MALFORMED_INTENT', message: 'substitutions.acceptable is required' });
  }
  if (!isStringArray(draft.substitutions.alternatives)) {
    return err({ code: 'MALFORMED_INTENT', message: 'substitutions.alternatives must be a string array' });
  }
  if (!Array.isArray(draft.constraints)) {
    return err({ code: 'MALFORMED_INTENT', message: 'constraints must be an array' });
  }
  for (const constraint of draft.constraints) {
    if (!isRecord(constraint) || !(ACCESS_CONSTRAINT_KINDS as readonly string[]).includes(String(constraint.kind))) {
      return err({ code: 'MALFORMED_INTENT', message: 'constraint kind is invalid' });
    }
  }
  if (!isStringArray(draft.consentRefs) || !isStringArray(draft.pegContextRefs)) {
    return err({ code: 'MALFORMED_INTENT', message: 'consentRefs and pegContextRefs must be string arrays' });
  }
  if (typeof draft.purpose !== 'string' || typeof draft.sourceText !== 'string' || typeof draft.explanation !== 'string') {
    return err({ code: 'MALFORMED_INTENT', message: 'purpose, sourceText, and explanation are required strings' });
  }
  if (typeof draft.createdAt !== 'string') {
    return err({ code: 'MALFORMED_INTENT', message: 'createdAt must be an ISO timestamp' });
  }
  let duration: AccessIntent['duration'];
  if (draft.duration !== undefined) {
    if (
      !isRecord(draft.duration) ||
      typeof draft.duration.value !== 'number' ||
      !(ACCESS_DURATION_UNITS as readonly string[]).includes(String(draft.duration.unit))
    ) {
      return err({ code: 'MALFORMED_INTENT', message: 'duration requires numeric value and DAY|WEEK|MONTH unit' });
    }
    duration = Object.freeze({
      value: draft.duration.value,
      unit: draft.duration.unit as NonNullable<AccessIntent['duration']>['unit'],
    });
  }
  return ok(
    Object.freeze({
      intentId: asAccessIntentId(draft.intentId),
      subjectId: draft.subjectId,
      category: draft.category,
      kind: draft.kind,
      experienceLevel: draft.experienceLevel as AccessIntent['experienceLevel'],
      target: target.value,
      geography: geography.value,
      window: window.value,
      ...(duration ? { duration } : {}),
      qualityPreferences: Object.freeze([...draft.qualityPreferences]),
      substitutions: Object.freeze({
        acceptable: draft.substitutions.acceptable,
        alternatives: Object.freeze([...draft.substitutions.alternatives]),
      }),
      constraints: Object.freeze(
        draft.constraints.map((constraint) =>
          Object.freeze({
            kind: constraint.kind as AccessIntent['constraints'][number]['kind'],
            ...(typeof constraint.maxMinorUnits === 'string' ? { maxMinorUnits: constraint.maxMinorUnits } : {}),
            ...(typeof constraint.currency === 'string' ? { currency: constraint.currency } : {}),
            ...(typeof constraint.note === 'string' ? { note: constraint.note } : {}),
          }),
        ),
      ),
      mandateRef: typeof draft.mandateRef === 'string' ? draft.mandateRef : null,
      purpose: draft.purpose,
      consentRefs: Object.freeze([...draft.consentRefs]),
      pegContextRefs: Object.freeze([...draft.pegContextRefs]),
      sourceText: draft.sourceText,
      explanation: draft.explanation,
      createdAt: draft.createdAt as UtcInstant,
    }),
  );
}

export function freezeAccessIntent(intent: Omit<AccessIntent, 'executable' | 'confirmsReservation'>): AccessIntent {
  return Object.freeze({
    ...intent,
    executable: false,
    confirmsReservation: false,
  });
}

export function consumeAuthorizedGraphContext(input: {
  readonly slice: {
    readonly authorizedCategories: readonly string[];
    readonly categoryLabels: Readonly<Record<string, readonly string[]>>;
    readonly consentRefs: readonly string[];
  };
  readonly requestedCategories: readonly string[];
  readonly requestedLabels: Readonly<Record<string, readonly string[]>>;
}): Result<{ readonly pegContextRefs: readonly string[]; readonly consentRefs: readonly string[] }, AccessIntentFailure> {
  const authorized = new Set(input.slice.authorizedCategories);
  const usedRefs: string[] = [];
  for (const category of input.requestedCategories) {
    if (!isAuthorizedGraphCategory(category) || !authorized.has(category)) {
      return err({
        code: 'PROHIBITED_GRAPH_CONTEXT',
        message: `graph category ${category} is not authorized for this purpose`,
      });
    }
    const labels = input.requestedLabels[category] ?? [];
    const permitted = new Set(input.slice.categoryLabels[category] ?? []);
    for (const label of labels) {
      if (!permitted.has(label)) {
        return err({
          code: 'PROHIBITED_GRAPH_CONTEXT',
          message: `graph label ${category}:${label} is not authorized`,
        });
      }
      usedRefs.push(`${category}:${label}`);
    }
  }
  return ok({
    pegContextRefs: Object.freeze([...usedRefs]),
    consentRefs: Object.freeze([...input.slice.consentRefs]),
  });
}

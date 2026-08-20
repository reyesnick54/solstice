/**
 * Event-specific base-value schedule for a production-candidate policy.
 *
 * Maps verified contribution semantics to reference-value bases.
 * Forbidden dimensions (protected traits, human quality, credit, wealth)
 * are rejected. Numeric bases may remain UNCONFIGURED.
 */

import { err, ok, type Result } from '../../../../domain/src/result.ts';
import {
  CONTRIBUTION_CLASSES,
  MEASUREMENT_UNITS,
  type ContributionClass,
  type MeasurementUnit,
} from '../../taxonomy.ts';

import {
  FORBIDDEN_SCHEDULE_DIMENSIONS,
  MEASUREMENT_BASES,
  PURPOSE_CLASSES,
  VERIFIED_EVENT_TYPES,
  valuationCandidateFailure,
  type MeasurementBasis,
  type NumericPolicyValue,
  type ProductionCandidateValuationFailure,
  type PurposeClass,
  type VerifiedEventType,
} from './types.ts';

export type BaseValueScheduleEntry = {
  readonly contributionClass: ContributionClass;
  readonly measurementBasis: MeasurementBasis;
  readonly measurementUnit: MeasurementUnit;
  readonly purposeClass: PurposeClass;
  readonly verifiedEventType: VerifiedEventType;
  readonly jurisdictionPolicyClass: string | null;
  readonly baseValue: NumericPolicyValue;
};

const FORBIDDEN_DIMENSION_SET = new Set<string>(
  FORBIDDEN_SCHEDULE_DIMENSIONS.map((key) => key.toLowerCase()),
);

export function scheduleValuesConfigured(entries: readonly BaseValueScheduleEntry[]): boolean {
  return entries.length > 0 && entries.every((row) => row.baseValue.status === 'CONFIGURED');
}

export function validateScheduleEntry(
  entry: BaseValueScheduleEntry,
): Result<true, ProductionCandidateValuationFailure> {
  if (!(CONTRIBUTION_CLASSES as readonly string[]).includes(entry.contributionClass)) {
    return err(
      valuationCandidateFailure('POLICY_SCHEMA_INVALID', `unknown contribution class '${entry.contributionClass}'`),
    );
  }
  if (!(MEASUREMENT_BASES as readonly string[]).includes(entry.measurementBasis)) {
    return err(
      valuationCandidateFailure('POLICY_SCHEMA_INVALID', `unknown measurement basis '${entry.measurementBasis}'`),
    );
  }
  if (!(MEASUREMENT_UNITS as readonly string[]).includes(entry.measurementUnit)) {
    return err(
      valuationCandidateFailure('POLICY_SCHEMA_INVALID', `unknown measurement unit '${entry.measurementUnit}'`),
    );
  }
  if (!(PURPOSE_CLASSES as readonly string[]).includes(entry.purposeClass)) {
    return err(valuationCandidateFailure('POLICY_SCHEMA_INVALID', `unknown purpose class '${entry.purposeClass}'`));
  }
  if (!(VERIFIED_EVENT_TYPES as readonly string[]).includes(entry.verifiedEventType)) {
    return err(
      valuationCandidateFailure('POLICY_SCHEMA_INVALID', `unknown verified event type '${entry.verifiedEventType}'`),
    );
  }
  if (entry.baseValue.status === 'CONFIGURED' && typeof entry.baseValue.value !== 'bigint') {
    return err(valuationCandidateFailure('FLOAT_MONETARY_MATH_FORBIDDEN', 'schedule base values must be bigint'));
  }
  return ok(true);
}

export function scanForbiddenScheduleDimensions(
  input: unknown,
): Result<true, ProductionCandidateValuationFailure> {
  const keys: string[] = [];
  const strings: string[] = [];
  walk(input, keys, strings);
  for (const key of keys) {
    if (FORBIDDEN_DIMENSION_SET.has(key.toLowerCase())) {
      return err(
        valuationCandidateFailure(
          'FORBIDDEN_SCHEDULE_DIMENSION',
          `schedule dimension '${key}' is a forbidden protected-trait or person-rank input`,
        ),
      );
    }
  }
  for (const text of strings) {
    if (FORBIDDEN_DIMENSION_SET.has(text.toLowerCase())) {
      return err(
        valuationCandidateFailure(
          'PROTECTED_TRAIT_FORBIDDEN',
          `protected trait or person-rank value '${text}' cannot appear in a valuation schedule`,
        ),
      );
    }
  }
  return ok(true);
}

export function matchScheduleEntry(
  entries: readonly BaseValueScheduleEntry[],
  query: {
    readonly contributionClass: ContributionClass;
    readonly measurementBasis: MeasurementBasis;
    readonly measurementUnit: MeasurementUnit;
    readonly purposeClass: PurposeClass;
    readonly verifiedEventType: VerifiedEventType;
    readonly jurisdictionPolicyClass: string | null;
  },
): BaseValueScheduleEntry | null {
  return (
    entries.find(
      (row) =>
        row.contributionClass === query.contributionClass &&
        row.measurementBasis === query.measurementBasis &&
        row.measurementUnit === query.measurementUnit &&
        row.purposeClass === query.purposeClass &&
        row.verifiedEventType === query.verifiedEventType &&
        row.jurisdictionPolicyClass === query.jurisdictionPolicyClass,
    ) ?? null
  );
}

function walk(value: unknown, keys: string[], strings: string[]): void {
  if (typeof value === 'string') {
    strings.push(value);
    return;
  }
  if (typeof value === 'bigint' || typeof value === 'boolean' || value === null || typeof value === 'number') {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      walk(item, keys, strings);
    }
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      keys.push(key);
      walk(item, keys, strings);
    }
  }
}

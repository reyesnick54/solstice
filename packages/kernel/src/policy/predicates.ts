/**
 * Declarative predicate language. Predicates are data, not stored code.
 * The engine interprets a closed operator set. Arbitrary functions cannot
 * be persisted or evaluated.
 */

export const FACT_PATHS = [
  'actor.id',
  'actionType',
  'environment',
  'customer.status',
  'customer.kycState',
  'customer.kycRecordVersion',
  'customer.jurisdiction',
  'customer.residency',
  'customer.legalEntityId',
  'identity.kycState',
  'identity.kycRecordVersion',
  'identity.citizenship',
  'identity.residency',
  'legalEntity.id',
  'legalEntity.status',
  'legalEntity.jurisdiction',
  'product.id',
  'product.status',
  'product.accountClass',
  'product.jurisdiction',
  'product.currency',
  'product.legalEntityId',
  'amount.minorUnits',
  'amount.currency',
  'serviceLocation',
  'transactionOrigin',
  'transactionDestination',
  'capability.enabled',
  'capability.environment',
  'offeringMode',
  'screening.sanctionsOutcome',
  'screening.pepOutcome',
  'screening.adverseMediaOutcome',
  'screening.fresh',
  'screening.providerAvailable',
  'aml.riskCategory',
  'fraud.outcome',
  'velocity.triggered',
] as const;

export type FactPath = (typeof FACT_PATHS)[number];

export type PolicyPredicate =
  | { readonly op: 'eq'; readonly fact: FactPath; readonly value: string | number | boolean }
  | { readonly op: 'neq'; readonly fact: FactPath; readonly value: string | number | boolean }
  | { readonly op: 'in'; readonly fact: FactPath; readonly values: readonly string[] }
  | { readonly op: 'exists'; readonly fact: FactPath }
  | { readonly op: 'missing'; readonly fact: FactPath }
  | { readonly op: 'gte'; readonly fact: FactPath; readonly value: string }
  | { readonly op: 'lte'; readonly fact: FactPath; readonly value: string }
  | { readonly op: 'and'; readonly predicates: readonly PolicyPredicate[] }
  | { readonly op: 'or'; readonly predicates: readonly PolicyPredicate[] }
  | { readonly op: 'not'; readonly predicate: PolicyPredicate };

export type PredicateOutcome =
  | { readonly ok: true; readonly matched: boolean }
  | { readonly ok: false; readonly reason: 'FACT_MISSING' | 'FACT_UNEVALUABLE' };

export type FactMap = Readonly<Partial<Record<FactPath, string | number | boolean | undefined>>>;

export function isFactPath(value: unknown): value is FactPath {
  return typeof value === 'string' && (FACT_PATHS as readonly string[]).includes(value);
}

export function evaluatePredicate(predicate: PolicyPredicate, facts: FactMap): PredicateOutcome {
  switch (predicate.op) {
    case 'exists':
      return { ok: true, matched: hasFact(facts, predicate.fact) };
    case 'missing':
      return { ok: true, matched: !hasFact(facts, predicate.fact) };
    case 'eq':
    case 'neq':
    case 'in':
    case 'gte':
    case 'lte': {
      if (!hasFact(facts, predicate.fact)) {
        return { ok: false, reason: 'FACT_MISSING' };
      }
      const actual = facts[predicate.fact];
      if (predicate.op === 'eq') {
        return { ok: true, matched: valuesEqual(actual, predicate.value) };
      }
      if (predicate.op === 'neq') {
        return { ok: true, matched: !valuesEqual(actual, predicate.value) };
      }
      if (predicate.op === 'in') {
        return { ok: true, matched: predicate.values.includes(String(actual)) };
      }
      const left = toComparable(actual);
      const right = toComparable(predicate.value);
      if (left === undefined || right === undefined) {
        return { ok: false, reason: 'FACT_UNEVALUABLE' };
      }
      if (predicate.op === 'gte') {
        return { ok: true, matched: left >= right };
      }
      return { ok: true, matched: left <= right };
    }
    case 'and': {
      let matched = true;
      for (const child of predicate.predicates) {
        const result = evaluatePredicate(child, facts);
        if (!result.ok) {
          return result;
        }
        matched = matched && result.matched;
      }
      return { ok: true, matched };
    }
    case 'or': {
      let sawMissing = false;
      for (const child of predicate.predicates) {
        const result = evaluatePredicate(child, facts);
        if (!result.ok) {
          sawMissing = true;
          continue;
        }
        if (result.matched) {
          return { ok: true, matched: true };
        }
      }
      if (sawMissing) {
        return { ok: false, reason: 'FACT_MISSING' };
      }
      return { ok: true, matched: false };
    }
    case 'not': {
      const inner = evaluatePredicate(predicate.predicate, facts);
      if (!inner.ok) {
        return inner;
      }
      return { ok: true, matched: !inner.matched };
    }
    default: {
      const _never: never = predicate;
      return _never;
    }
  }
}

function hasFact(facts: FactMap, path: FactPath): boolean {
  const value = facts[path];
  return value !== undefined && value !== null && value !== '';
}

function valuesEqual(actual: string | number | boolean | undefined, expected: string | number | boolean): boolean {
  if (typeof actual === 'boolean' || typeof expected === 'boolean') {
    return Boolean(actual) === Boolean(expected);
  }
  return String(actual) === String(expected);
}

function toComparable(value: string | number | boolean | undefined): bigint | undefined {
  if (value === undefined || typeof value === 'boolean') {
    return undefined;
  }
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

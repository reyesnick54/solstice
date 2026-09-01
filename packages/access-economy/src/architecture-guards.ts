/**
 * ACCESS-01 semantic architecture guards.
 *
 * Detects prohibited implementation patterns (field names, yield language,
 * access-coin semantics) rather than innocent documentation or invariant
 * evidence strings.
 */

import {
  FORBIDDEN_ACCESS_SCORE_FIELDS,
  FORBIDDEN_ACCESS_TOKEN_FIELDS,
} from './taxonomy.ts';

export type ArchitectureGuardViolation = {
  readonly kind: 'FORBIDDEN_SCORE_FIELD' | 'FORBIDDEN_TOKEN_FIELD' | 'FORBIDDEN_YIELD_LANGUAGE';
  readonly detail: string;
};

const STRUCTURAL_FALSE_MARKER = /:\s*false(?:\s+as\s+const)?\b/;
const INCLUDES_GUARD = /\.includes\s*\(\s*['"]/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

function isStructuralNegationMarker(line: string, field: string): boolean {
  const fieldPattern = new RegExp(`\\b${escapeRegExp(field)}\\b`);
  if (!fieldPattern.test(line)) {
    return false;
  }
  if (STRUCTURAL_FALSE_MARKER.test(line)) {
    return true;
  }
  if (/\bImplemented\s*:\s*false/.test(line) && field.endsWith('Implemented')) {
    return true;
  }
  return false;
}

function isInvariantAbsenceCheck(line: string, field: string): boolean {
  if (!INCLUDES_GUARD.test(line)) {
    return false;
  }
  return line.includes(`'${field}'`) || line.includes(`"${field}"`);
}

function findForbiddenFieldImplementations(
  source: string,
  fields: readonly string[],
  kind: ArchitectureGuardViolation['kind'],
): ArchitectureGuardViolation[] {
  const violations: ArchitectureGuardViolation[] = [];
  const stripped = stripComments(source);
  const lines = stripped.split('\n');

  for (const field of fields) {
    const requiredPropertyPattern = new RegExp(`\\b${escapeRegExp(field)}\\s*:`);
    const optionalPropertyPattern = new RegExp(`\\b${escapeRegExp(field)}\\s*\\?:`);
    const requiredTypeMemberPattern = new RegExp(`\\b${escapeRegExp(field)}\\s*;`);
    const optionalTypeMemberPattern = new RegExp(`\\b${escapeRegExp(field)}\\s*\\?;`);
    const quotedKeyPattern = new RegExp(`["']${escapeRegExp(field)}["']\\s*:`);

    for (const line of lines) {
      const hasRequiredProperty = requiredPropertyPattern.test(line) && !optionalPropertyPattern.test(line);
      const hasRequiredTypeMember = requiredTypeMemberPattern.test(line) && !optionalTypeMemberPattern.test(line);
      if (!hasRequiredProperty && !hasRequiredTypeMember && !quotedKeyPattern.test(line)) {
        continue;
      }
      if (isStructuralNegationMarker(line, field)) {
        continue;
      }
      if (isInvariantAbsenceCheck(line, field)) {
        continue;
      }
      violations.push(Object.freeze({ kind, detail: `forbidden field implementation: ${field}` }));
      break;
    }
  }

  return violations;
}

const FORBIDDEN_YIELD_PATTERNS = Object.freeze([
  { pattern: /\bAPY\b/, detail: 'APY yield language' },
  { pattern: /\bAPR\b/, detail: 'APR yield language' },
  { pattern: /\bblended\s+return\b/i, detail: 'blended return language' },
  { pattern: /\bguaranteed\s+profit\b/i, detail: 'guaranteed profit language' },
] as const);

function findForbiddenYieldLanguage(source: string): ArchitectureGuardViolation[] {
  const violations: ArchitectureGuardViolation[] = [];
  const stripped = stripComments(source);

  for (const rule of FORBIDDEN_YIELD_PATTERNS) {
    if (rule.pattern.test(stripped)) {
      violations.push(Object.freeze({ kind: 'FORBIDDEN_YIELD_LANGUAGE', detail: rule.detail }));
    }
  }

  return violations;
}

export function scanAccessEconomySourceArchitecture(source: string): readonly ArchitectureGuardViolation[] {
  return Object.freeze([
    ...findForbiddenFieldImplementations(source, FORBIDDEN_ACCESS_SCORE_FIELDS, 'FORBIDDEN_SCORE_FIELD'),
    ...findForbiddenFieldImplementations(source, FORBIDDEN_ACCESS_TOKEN_FIELDS, 'FORBIDDEN_TOKEN_FIELD'),
    ...findForbiddenYieldLanguage(source),
  ]);
}

export function accessEconomySourceArchitectureIsClean(source: string): boolean {
  return scanAccessEconomySourceArchitecture(source).length === 0;
}

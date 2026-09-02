/**
 * Wave 4 Task 5 — query minimization defaults and enforcement.
 *
 * Prefer required fields, aggregates, derived values, and proofs over
 * entire tables, complete user records, or unnecessary personal data.
 */

import type { FederatedQueryRequest, FederationRejection } from './types.ts';
import { federationRejection } from './types.ts';

export const DEFAULT_ROW_LIMIT = 100 as const;
export const MAX_ROW_LIMIT = 1_000 as const;
export const DEFAULT_TIMEOUT_MS = 5_000 as const;
export const MAX_TIMEOUT_MS = 30_000 as const;
export const MAX_FIELDS_PER_QUERY = 16 as const;
export const MAX_METRICS_PER_QUERY = 8 as const;
export const MAX_SOURCES_PER_QUERY = 6 as const;

const FORBIDDEN_BROAD_FIELDS = Object.freeze([
  '*',
  'all',
  'full_record',
  'raw_payload',
  'complete_table',
  'entire_dataset',
]);

const PREFERRED_AGGREGATE_KINDS = new Set([
  'AGGREGATE_SUM',
  'AGGREGATE_AVG',
  'AGGREGATE_COUNT',
  'DERIVED_RATIO',
  'PROOF_COMMITMENT',
]);

export function applyMinimizationDefaults(
  request: FederatedQueryRequest,
): FederatedQueryRequest {
  return Object.freeze({
    ...request,
    rowLimit: Math.min(request.rowLimit ?? DEFAULT_ROW_LIMIT, MAX_ROW_LIMIT),
    timeoutMs: Math.min(request.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS),
    allowPartial: request.allowPartial ?? false,
  });
}

export function validateQueryMinimization(
  request: FederatedQueryRequest,
): FederationRejection | null {
  if (request.metrics.length === 0) {
    return federationRejection('QUERY_TOO_BROAD', 'at least one metric is required');
  }
  if (request.metrics.length > MAX_METRICS_PER_QUERY) {
    return federationRejection('QUERY_TOO_BROAD', `exceeds max metrics (${MAX_METRICS_PER_QUERY})`);
  }
  if (request.sourceConstraints.length === 0) {
    return federationRejection('QUERY_TOO_BROAD', 'at least one source constraint is required');
  }
  if (request.sourceConstraints.length > MAX_SOURCES_PER_QUERY) {
    return federationRejection('QUERY_TOO_BROAD', `exceeds max sources (${MAX_SOURCES_PER_QUERY})`);
  }
  if (request.requestedFields.length > MAX_FIELDS_PER_QUERY) {
    return federationRejection('FIELD_NOT_PERMITTED', `exceeds max fields (${MAX_FIELDS_PER_QUERY})`);
  }

  for (const field of request.requestedFields) {
    if (FORBIDDEN_BROAD_FIELDS.includes(field.toLowerCase())) {
      return federationRejection('ARBITRARY_QUERY_FORBIDDEN', `field ${field} requests unrestricted data`);
    }
  }

  const rowLimit = request.rowLimit ?? DEFAULT_ROW_LIMIT;
  if (rowLimit > MAX_ROW_LIMIT) {
    return federationRejection('ROW_LIMIT_EXCEEDED', `row limit ${rowLimit} exceeds maximum`);
  }

  const allAggregate = request.metrics.every((metric) => PREFERRED_AGGREGATE_KINDS.has(metric.kind));
  if (!allAggregate && request.requestedFields.length === 0) {
    return federationRejection(
      'QUERY_TOO_BROAD',
      'non-aggregate metrics require explicit requestedFields for minimization',
    );
  }

  return null;
}

export function prefersAggregates(request: FederatedQueryRequest): boolean {
  return request.metrics.every((metric) => PREFERRED_AGGREGATE_KINDS.has(metric.kind));
}

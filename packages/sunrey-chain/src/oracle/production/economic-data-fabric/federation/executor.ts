/**
 * Wave 4 — Federated query executor.
 *
 * Orchestrates purpose gates, minimization, source registry, adapter queries,
 * failure isolation, and audit receipts. Does not mint, post journals, or
 * finalize economic facts.
 */

import type { FederationAdapter } from './adapter.ts';
import { createDefaultFederationAdapter } from './adapter.ts';
import { FederationAuditJournal, recordFederationAuditReceipt } from './audit.ts';
import { applyMinimizationDefaults, validateQueryMinimization } from './minimization.ts';
import { resolveMaterialization } from './materialization.ts';
import { evaluateFederationPurpose } from './purpose-gate.ts';
import { FederationSourceRegistry } from './source-registry.ts';
import type {
  FederatedQueryRequest,
  FederatedQueryResult,
  FederatedSourceOutcome,
  FederationRejection,
} from './types.ts';
import { federationRejection } from './types.ts';

export type FederationExecuteInput = Readonly<{
  readonly request: FederatedQueryRequest;
  readonly nowUnix: bigint;
  readonly adapter?: FederationAdapter;
  readonly sourceRegistry?: FederationSourceRegistry;
  readonly auditJournal?: FederationAuditJournal;
}>;

export type FederationExecuteOutput = Readonly<{
  readonly result: FederatedQueryResult;
  readonly auditReceiptId: string;
}>;

function failedResult(
  request: FederatedQueryRequest,
  rejection: FederationRejection,
  materialization: FederatedQueryResult['materialization'] = 'QUERIED_ONLY',
): FederatedQueryResult {
  return Object.freeze({
    queryId: request.queryId,
    purpose: request.purpose,
    completeness: 'FAILED',
    materialization,
    persistenceAuthorized: false,
    sourceOutcomes: Object.freeze([]),
    metrics: Object.freeze([]),
    rejection,
  });
}

async function querySources(
  request: FederatedQueryRequest,
  adapter: FederationAdapter,
  registry: FederationSourceRegistry,
  nowUnix: bigint,
): Promise<readonly FederatedSourceOutcome[]> {
  const outcomes: FederatedSourceOutcome[] = [];

  for (const constraint of request.sourceConstraints) {
    const source = registry.get(constraint.sourceId);
    if (!source) {
      outcomes.push(
        Object.freeze({
          sourceId: constraint.sourceId,
          status: 'DENIED',
          metrics: Object.freeze([]),
          rejection: federationRejection(
            'SOURCE_NOT_REGISTERED',
            `source ${constraint.sourceId} is not in federation registry`,
            constraint.sourceId,
          ),
        }),
      );
      continue;
    }

    if (source.accessMode === 'NOT_QUERYABLE') {
      outcomes.push(
        Object.freeze({
          sourceId: constraint.sourceId,
          status: 'DENIED',
          metrics: Object.freeze([]),
          rejection: federationRejection(
            'SOURCE_NOT_PERMITTED',
            `source ${constraint.sourceId} is not queryable through federation`,
            constraint.sourceId,
          ),
        }),
      );
      continue;
    }

    const outcome = await adapter.querySource({ request, constraint, nowUnix });
    if (!outcome.ok) {
      const status =
        outcome.rejection.code === 'TIMEOUT'
          ? 'TIMEOUT'
          : outcome.rejection.code === 'SCHEMA_MISMATCH'
            ? 'SCHEMA_MISMATCH'
            : outcome.rejection.code === 'SOURCE_UNAVAILABLE'
              ? 'UNAVAILABLE'
              : 'DENIED';
      outcomes.push(
        Object.freeze({
          sourceId: constraint.sourceId,
          status,
          metrics: Object.freeze([]),
          rejection: outcome.rejection,
        }),
      );
      continue;
    }

    outcomes.push(
      Object.freeze({
        sourceId: constraint.sourceId,
        status: 'OK',
        metrics: Object.freeze([...outcome.metrics]),
      }),
    );
  }

  return Object.freeze(outcomes);
}

function deriveCompleteness(
  outcomes: readonly FederatedSourceOutcome[],
  allowPartial: boolean,
): Readonly<{
  readonly completeness: FederatedQueryResult['completeness'];
  readonly rejection: FederationRejection | null;
  readonly partialWarning: string | null;
}> {
  const okCount = outcomes.filter((outcome) => outcome.status === 'OK').length;
  if (okCount === outcomes.length) {
    return Object.freeze({ completeness: 'COMPLETE', rejection: null, partialWarning: null });
  }
  if (okCount === 0) {
    const first = outcomes.find((outcome) => outcome.rejection)?.rejection;
    return Object.freeze({
      completeness: 'FAILED',
      rejection:
        first ??
        federationRejection('SOURCE_UNAVAILABLE', 'all federation sources failed'),
      partialWarning: null,
    });
  }
  if (!allowPartial) {
    const failed = outcomes.filter((outcome) => outcome.status !== 'OK');
    return Object.freeze({
      completeness: 'FAILED',
      rejection: federationRejection(
        'PARTIAL_RESULT_UNSAFE',
        `partial federation: ${failed.map((outcome) => outcome.sourceId).join(', ')} unavailable; allowPartial is false`,
      ),
      partialWarning: null,
    });
  }
  const failed = outcomes.filter((outcome) => outcome.status !== 'OK');
  return Object.freeze({
    completeness: 'PARTIAL',
    rejection: null,
    partialWarning: `partial result: ${failed.map((outcome) => `${outcome.sourceId}(${outcome.status})`).join(', ')}`,
  });
}

export async function executeFederatedQuery(
  input: FederationExecuteInput,
): Promise<FederationExecuteOutput> {
  const adapter = input.adapter ?? createDefaultFederationAdapter();
  const registry = input.sourceRegistry ?? new FederationSourceRegistry();
  const auditJournal = input.auditJournal ?? new FederationAuditJournal();

  const request = applyMinimizationDefaults(input.request);

  const purposeRejection = evaluateFederationPurpose({
    requestedPurpose: request.purpose,
    rightsContext: request.rightsContext,
  });
  if (purposeRejection) {
    const result = failedResult(request, purposeRejection);
    const receipt = recordFederationAuditReceipt({
      request,
      result,
      rightsContext: request.rightsContext,
      rightsRejection: purposeRejection,
      nowUnix: input.nowUnix,
    });
    auditJournal.append(receipt);
    return Object.freeze({ result, auditReceiptId: receipt.receiptId });
  }

  const minimizationRejection = validateQueryMinimization(request);
  if (minimizationRejection) {
    const result = failedResult(request, minimizationRejection);
    const receipt = recordFederationAuditReceipt({
      request,
      result,
      rightsContext: request.rightsContext,
      rightsRejection: null,
      nowUnix: input.nowUnix,
    });
    auditJournal.append(receipt);
    return Object.freeze({ result, auditReceiptId: receipt.receiptId });
  }

  const materialization = resolveMaterialization({
    request,
    rightsContext: request.rightsContext,
  });

  for (const constraint of request.sourceConstraints) {
    const source = registry.get(constraint.sourceId);
    if (!source) {
      const result = failedResult(
        request,
        federationRejection('SOURCE_NOT_REGISTERED', `unknown source ${constraint.sourceId}`, constraint.sourceId),
      );
      const receipt = recordFederationAuditReceipt({
        request,
        result,
        rightsContext: request.rightsContext,
        rightsRejection: null,
        nowUnix: input.nowUnix,
      });
      auditJournal.append(receipt);
      return Object.freeze({ result, auditReceiptId: receipt.receiptId });
    }
  }

  const sourceOutcomes = await querySources(request, adapter, registry, input.nowUnix);
  const completeness = deriveCompleteness(sourceOutcomes, request.allowPartial ?? false);

  const metrics = Object.freeze(
    sourceOutcomes.flatMap((outcome) => (outcome.status === 'OK' ? outcome.metrics : [])),
  );

  const result: FederatedQueryResult = Object.freeze({
    queryId: request.queryId,
    purpose: request.purpose,
    completeness: completeness.completeness,
    materialization: materialization.level,
    persistenceAuthorized: materialization.persistenceAuthorized && completeness.completeness !== 'FAILED',
    sourceOutcomes,
    metrics,
    ...(completeness.rejection ? { rejection: completeness.rejection } : {}),
    ...(completeness.partialWarning ? { partialWarning: completeness.partialWarning } : {}),
    ...(materialization.rejection && completeness.completeness !== 'FAILED'
      ? { rejection: materialization.rejection }
      : {}),
  });

  const receipt = recordFederationAuditReceipt({
    request,
    result,
    rightsContext: request.rightsContext,
    rightsRejection: null,
    nowUnix: input.nowUnix,
  });
  auditJournal.append(receipt);

  return Object.freeze({ result, auditReceiptId: receipt.receiptId });
}

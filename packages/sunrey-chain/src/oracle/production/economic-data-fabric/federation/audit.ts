/**
 * Wave 4 Task 8 — federated query audit receipts.
 *
 * Records who/what queried, purpose, source, time, scope, result reference,
 * and rights decision. Does not log raw sensitive result payloads.
 */

import { sha256Hex } from '../../../../../../security/src/hash.ts';
import type {
  FederatedQueryRequest,
  FederatedQueryResult,
  FederationRejection,
  FederationRightsContext,
  MaterializationLevel,
} from './types.ts';

export const FEDERATION_AUDIT_RECEIPT_VERSION = 'sunrey.federation.audit-receipt.v1' as const;

export type FederationAuditReceipt = Readonly<{
  readonly receiptId: string;
  readonly version: typeof FEDERATION_AUDIT_RECEIPT_VERSION;
  readonly queryId: string;
  readonly principalId: string;
  readonly principalKind: FederatedQueryRequest['principal']['principalKind'];
  readonly purpose: FederatedQueryRequest['purpose'];
  readonly domain: FederatedQueryRequest['domain'];
  readonly sourceIds: readonly string[];
  readonly metricIds: readonly string[];
  readonly requestedFields: readonly string[];
  readonly timeRangeFromUnix: string;
  readonly timeRangeToUnix: string;
  readonly geographyJurisdiction: string | null;
  readonly rightsDecision: 'ALLOW' | 'DENY';
  readonly rightsRejectionCode: FederationRejection['code'] | null;
  readonly licenseRef: string | null;
  readonly consentRef: string | null;
  readonly materialization: MaterializationLevel;
  readonly persistenceAuthorized: boolean;
  readonly completeness: FederatedQueryResult['completeness'];
  readonly resultReference: string;
  readonly recordedAtUnix: string;
  readonly payloadLogged: false;
}>;

export function resultReferenceOf(result: FederatedQueryResult): string {
  const metricRefs = result.metrics
    .map((metric) => `${metric.metricId}:${metric.attribution.contentCommitment}`)
    .sort()
    .join('|');
  const sourceRefs = result.sourceOutcomes
    .map((outcome) => `${outcome.sourceId}:${outcome.status}`)
    .sort()
    .join('|');
  return sha256Hex(
    `fed.result.v1:${result.queryId}:${result.completeness}:${metricRefs}:${sourceRefs}`,
  );
}

export function recordFederationAuditReceipt(input: {
  readonly request: FederatedQueryRequest;
  readonly result: FederatedQueryResult;
  readonly rightsContext: FederationRightsContext;
  readonly rightsRejection: FederationRejection | null;
  readonly nowUnix: bigint;
}): FederationAuditReceipt {
  const rightsDecision = input.rightsRejection || input.result.rejection ? 'DENY' : 'ALLOW';
  const resultReference = resultReferenceOf(input.result);
  const receiptId = sha256Hex(
    `fed.audit.v1:${input.request.queryId}:${input.nowUnix}:${resultReference}`,
  );

  return Object.freeze({
    receiptId,
    version: FEDERATION_AUDIT_RECEIPT_VERSION,
    queryId: input.request.queryId,
    principalId: input.request.principal.principalId,
    principalKind: input.request.principal.principalKind,
    purpose: input.request.purpose,
    domain: input.request.domain,
    sourceIds: Object.freeze(input.request.sourceConstraints.map((constraint) => constraint.sourceId)),
    metricIds: Object.freeze(input.request.metrics.map((metric) => metric.metricId)),
    requestedFields: Object.freeze([...input.request.requestedFields]),
    timeRangeFromUnix: input.request.timeRange.fromUnix.toString(),
    timeRangeToUnix: input.request.timeRange.toUnix.toString(),
    geographyJurisdiction: input.request.geography?.jurisdiction ?? null,
    rightsDecision,
    rightsRejectionCode:
      input.rightsRejection?.code ?? input.result.rejection?.code ?? null,
    licenseRef: input.rightsContext.licenseId ?? null,
    consentRef: input.rightsContext.consentRef ?? null,
    materialization: input.result.materialization,
    persistenceAuthorized: input.result.persistenceAuthorized,
    completeness: input.result.completeness,
    resultReference,
    recordedAtUnix: input.nowUnix.toString(),
    payloadLogged: false,
  });
}

export class FederationAuditJournal {
  private readonly receipts: FederationAuditReceipt[] = [];

  append(receipt: FederationAuditReceipt): void {
    this.receipts.push(receipt);
  }

  list(): readonly FederationAuditReceipt[] {
    return Object.freeze([...this.receipts]);
  }

  findByQueryId(queryId: string): readonly FederationAuditReceipt[] {
    return Object.freeze(this.receipts.filter((receipt) => receipt.queryId === queryId));
  }
}

import type {
  DomainSnapshots,
  HealthEdge,
  HealthNode,
  HealthNodeId,
  RootCauseCandidate,
} from './types.ts';

export const PAYMENT_HEALTH_EDGES: readonly HealthEdge[] = Object.freeze([
  { from: 'payments', to: 'kernel' },
  { from: 'payments', to: 'ledger' },
  { from: 'payments', to: 'provider_candidate' },
  { from: 'payments', to: 'credential_health' },
  { from: 'payments', to: 'fx' },
  { from: 'payments', to: 'event_fabric' },
  { from: 'payments', to: 'persistence' },
]);

export const MOONREY_EVIDENCE_EDGES: readonly HealthEdge[] = Object.freeze([
  { from: 'moonrey_evidence', to: 'economic_data_provider' },
  { from: 'moonrey_evidence', to: 'connector' },
  { from: 'moonrey_evidence', to: 'certification' },
  { from: 'moonrey_evidence', to: 'oracle_quorum' },
  { from: 'moonrey_evidence', to: 'productive_contribution' },
  { from: 'moonrey_evidence', to: 'attribution' },
  { from: 'moonrey_evidence', to: 'productive_value' },
  { from: 'moonrey_evidence', to: 'monetary_authority' },
]);

export function paymentHealthGraph(snapshots: DomainSnapshots): readonly HealthNode[] {
  const provider = snapshots.providers?.find((row) => row.domain === 'payments');
  const credentials = snapshots.credentials?.find((row) => row.domain === 'payments');
  const payment = snapshots.payments?.[0];
  const persistence = snapshots.persistence;
  const events = snapshots.events;
  const fxRequired = (payment?.fxQuoteStaleRejections ?? 0n) > 0n;
  const providerHealthy = provider?.technicalHealth === 'TECHNICALLY_HEALTHY';
  const credentialHealthy = credentials !== undefined && credentials.resolutionFailures === 0n && !credentials.rotationRequired;
  const persistenceHealthy = persistence?.primaryHealthy === true && (persistence.recoveryReconciliationQueue ?? 0n) === 0n;
  const eventsHealthy = (events?.outboxBacklog ?? 0n) === 0n && (events?.deadLetterCount ?? 0n) === 0n;
  const fxHealthy = !fxRequired;
  const paymentsHealthy =
    providerHealthy &&
    credentialHealthy &&
    persistenceHealthy &&
    eventsHealthy &&
    (payment?.submissionUnknown ?? 0n) === 0n &&
    (payment?.reconciliationRequired ?? 0n) === 0n;

  return Object.freeze([
    node('kernel', true, 'Compliance Kernel remains the authorization owner'),
    node('ledger', snapshots.financialSafety?.ledgerImbalance !== true, 'Ledger imbalance is an invariant signal only'),
    node('provider_candidate', providerHealthy, provider?.technicalHealth ?? 'UNAVAILABLE'),
    node('credential_health', credentialHealthy, credentialHealthy ? 'credential horizon healthy' : 'credential attention required'),
    node('fx', fxHealthy, fxHealthy ? 'no stale FX use' : 'stale FX quote rejections observed'),
    node('event_fabric', eventsHealthy, eventsHealthy ? 'outbox drained' : 'event fabric backlog'),
    node('persistence', persistenceHealthy, persistenceHealthy ? 'primary healthy' : 'persistence recovery required'),
    node('payments', paymentsHealthy, paymentsHealthy ? 'payment path healthy' : 'payment path degraded'),
  ]);
}

export function moonreyEvidenceHealthGraph(snapshots: DomainSnapshots): readonly HealthNode[] {
  const economic = snapshots.economic;
  const quorumHealthy = economic?.oracleQuorumDegraded !== true;
  const reviewHealthy = (economic?.productiveValueReviewQueue ?? 0n) === 0n;
  const contributionHealthy = (economic?.humanContributionReviewQueue ?? 0n) === 0n;
  const supplyHealthy = (economic?.supplyReconciliationMismatches ?? 0n) === 0n;
  const pathHealthy = quorumHealthy && reviewHealthy && contributionHealthy && supplyHealthy;

  return Object.freeze([
    node('economic_data_provider', quorumHealthy, quorumHealthy ? 'provider observations present' : 'oracle quorum degraded'),
    node('connector', quorumHealthy, 'connector is observation-only'),
    node('certification', quorumHealthy, 'certification is not production approval'),
    node('oracle_quorum', quorumHealthy, quorumHealthy ? 'quorum available' : 'quorum degraded'),
    node('productive_contribution', contributionHealthy, contributionHealthy ? 'no contribution review backlog' : 'human contribution review queue'),
    node('attribution', contributionHealthy, 'attribution remains policy-owned'),
    node('productive_value', reviewHealthy, reviewHealthy ? 'no productive value review backlog' : 'productive value review queue'),
    node('monetary_authority', supplyHealthy, 'Chunk 71 remains the mint; control room cannot mint'),
    node('moonrey_evidence', pathHealthy, pathHealthy ? 'MoonRey evidence path healthy' : 'MoonRey evidence path degraded'),
  ]);
}

export function rootCauseCandidates(
  nodes: readonly HealthNode[],
  edges: readonly HealthEdge[],
): readonly RootCauseCandidate[] {
  const byId = new Map(nodes.map((row) => [row.id, row]));
  const candidates: RootCauseCandidate[] = [];
  for (const nodeRow of nodes) {
    if (nodeRow.healthy) {
      continue;
    }
    const dependencies = edges.filter((edge) => edge.from === nodeRow.id).map((edge) => byId.get(edge.to));
    const unhealthyDeps = dependencies.filter((dep) => dep !== undefined && !dep.healthy);
    if (unhealthyDeps.length === 0) {
      candidates.push({
        nodeId: nodeRow.id,
        reason: nodeRow.detail,
        correlationIsNotCausation: true,
      });
    }
  }
  return Object.freeze(candidates);
}

function node(id: HealthNodeId, healthy: boolean, detail: string): HealthNode {
  return Object.freeze({
    id,
    healthy,
    status: healthy ? 'NORMAL' : 'DEGRADED',
    detail,
  });
}

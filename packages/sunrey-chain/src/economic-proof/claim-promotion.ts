import { err, ok, type Result } from '../../../domain/src/result.ts';
import { deriveClaimFingerprint } from './claim-fingerprint.ts';
import { deriveDuplicateClusterId } from './duplicate-cluster.ts';
import {
  buildCandidateFromObservation,
  isReconciliationClaimReady,
  reconcileProductiveEvents,
  type BuildCandidateInput,
  type ReconcileEventsInput,
} from './event-reconciliation.ts';
import type {
  ProductiveEventReconciliationResult,
  ReconciliationFailure,
} from './productive-event-types.ts';
import {
  EconomicClaimRegistry,
  type RegisterClaimInput,
  type RegistryFailure,
} from './registry.ts';
import type { EconomicClaim, RegisteredEconomicObservation } from './types.ts';

export type PromoteReconciliationInput = {
  readonly claimId: string;
  readonly economy: EconomicClaim['economy'];
  readonly entityMaterial: RegisterClaimInput['entityMaterial'];
  readonly economicAction: string;
  readonly validFromUtc: string;
  readonly validUntilUtc: string | null;
  readonly jurisdictionCommitment?: string;
  readonly categoryCommitment?: string;
  readonly methodologyVersion: string;
  readonly lineageEdges?: RegisterClaimInput['lineageEdges'];
};

export type ClaimPromotionFailure = ReconciliationFailure | RegistryFailure | {
  readonly code: 'RECONCILIATION_NOT_READY' | 'UNRESOLVED_CLUSTER';
  readonly message: string;
};

/**
 * Gate: only resolved canonical productive events may progress into claims.
 * Unresolved duplicate clusters must not silently generate multiple claims.
 */
export function canPromoteReconciliationToClaim(
  reconciliation: ProductiveEventReconciliationResult,
): boolean {
  return isReconciliationClaimReady(reconciliation);
}

export function promoteReconciliationToClaim(
  registry: EconomicClaimRegistry,
  reconciliation: ProductiveEventReconciliationResult,
  input: PromoteReconciliationInput,
): Result<EconomicClaim, ClaimPromotionFailure> {
  if (!canPromoteReconciliationToClaim(reconciliation)) {
    return err({
      code: 'RECONCILIATION_NOT_READY',
      message: `Reconciliation ${reconciliation.reconciliationId} is not ready for claim promotion (status: ${reconciliation.resolutionStatus})`,
    });
  }

  const canonical = reconciliation.candidateEvents.find(
    (c) => c.eventKey === reconciliation.canonicalEventKey,
  );
  if (!canonical || !reconciliation.quantityReconciliation) {
    return err({
      code: 'RECONCILIATION_NOT_READY',
      message: 'Missing canonical event or quantity reconciliation',
    });
  }

  const cluster = registry.getClusterForEvent(reconciliation.canonicalEventId!);
  if (cluster?.claimId) {
    return err({
      code: 'CLUSTER_ALREADY_MONETIZED',
      message: `Cluster already monetized with claim ${cluster.claimId}`,
    });
  }

  const observationIds = [...new Set(
    reconciliation.candidateEvents.flatMap((c) => [...c.observationIds]),
  )];

  for (const observationId of observationIds) {
    if (!registry.getObservation(observationId)) {
      return err({
        code: 'OBSERVATION_NOT_FOUND',
        message: `Observation ${observationId} not registered`,
      });
    }
  }

  const eventMaterial = {
    economicAction: input.economicAction,
    quantity: reconciliation.quantityReconciliation.reconciledQuantity,
    unit: canonical.unit,
    validFromUtc: input.validFromUtc,
    validUntilUtc: input.validUntilUtc,
    locationCommitment: canonical.geographyCommitment,
    domainIdentifierCommitment: canonical.batchRunJobId,
  };

  const claimFingerprint = deriveClaimFingerprint({
    economy: input.economy,
    canonicalEntityId: canonical.canonicalEntityId,
    canonicalEventId: reconciliation.canonicalEventId!,
    economicAction: input.economicAction,
    quantity: reconciliation.quantityReconciliation.reconciledQuantity,
    unit: canonical.unit,
    validFromUtc: input.validFromUtc,
    validUntilUtc: input.validUntilUtc,
    jurisdictionCommitment: input.jurisdictionCommitment,
    categoryCommitment: input.categoryCommitment,
  });

  const existing = registry.getClaimByFingerprint(claimFingerprint);
  if (existing) {
    return err({
      code: 'CLAIM_ALREADY_EXISTS',
      message: `Claim fingerprint already registered: ${claimFingerprint}`,
    });
  }

  return registry.registerClaim({
    claimId: input.claimId,
    economy: input.economy,
    entityMaterial: input.entityMaterial,
    eventMaterial,
    economicAction: input.economicAction,
    validFromUtc: input.validFromUtc,
    validUntilUtc: input.validUntilUtc,
    jurisdictionCommitment: input.jurisdictionCommitment,
    categoryCommitment: input.categoryCommitment,
    observationIds,
    lineageEdges: [
      ...(input.lineageEdges ?? []),
      ...reconciliation.lineage.edges,
    ],
    methodologyVersion: input.methodologyVersion,
    producedRefs: reconciliation.canonicalEventKey ? [reconciliation.canonicalEventKey] : [],
    reconciledCanonicalEventId: reconciliation.canonicalEventId!,
  });
}

export type ReconcileAndPromoteInput = {
  readonly observations: readonly RegisteredEconomicObservation[];
  readonly candidateInputs: readonly BuildCandidateInput[];
  readonly reconcileInput?: Omit<ReconcileEventsInput, 'candidates'>;
  readonly promoteInput: PromoteReconciliationInput;
};

/**
 * Full Wave 5 pipeline: reconcile observations → promote to claim if resolved.
 * Blocks unresolved clusters from generating claims.
 */
export function reconcileAndPromoteToClaim(
  registry: EconomicClaimRegistry,
  input: ReconcileAndPromoteInput,
): Result<{ reconciliation: ProductiveEventReconciliationResult; claim?: EconomicClaim }, ClaimPromotionFailure> {
  const candidates = input.candidateInputs.map((candidateInput) =>
    buildCandidateFromObservation(candidateInput),
  );

  const reconciliationResult = reconcileProductiveEvents({
    candidates,
    ...input.reconcileInput,
  });

  if (!reconciliationResult.ok) {
    return err(reconciliationResult.error);
  }

  const reconciliation = reconciliationResult.value;

  if (!canPromoteReconciliationToClaim(reconciliation)) {
    return ok({ reconciliation });
  }

  const claimResult = promoteReconciliationToClaim(registry, reconciliation, input.promoteInput);
  if (!claimResult.ok) {
    return err(claimResult.error);
  }

  return ok({ reconciliation, claim: claimResult.value });
}

export { buildCandidateFromObservation };

/**
 * Monetization lock guard: one canonical productive event → one claim monetization context.
 * Prevents bypass via different provider combinations.
 */
export function assertMonetizationLockForReconciliation(
  registry: EconomicClaimRegistry,
  reconciliation: ProductiveEventReconciliationResult,
): Result<void, ClaimPromotionFailure> {
  if (!reconciliation.canonicalEventId) {
    return err({
      code: 'RECONCILIATION_NOT_READY',
      message: 'No canonical event id for monetization lock check',
    });
  }

  const clusterId = deriveDuplicateClusterId(reconciliation.canonicalEventId);
  const cluster = registry.getClusterForEvent(reconciliation.canonicalEventId);

  if (cluster?.claimId) {
    const claim = registry.getClaim(cluster.claimId);
    if (claim && claim.canonicalEventId === reconciliation.canonicalEventId) {
      return ok(undefined);
    }
    return err({
      code: 'CLUSTER_ALREADY_MONETIZED',
      message: `Event cluster ${clusterId} already has monetized claim`,
    });
  }

  return ok(undefined);
}

import { randomUUID } from 'node:crypto';

import { Money } from '../../../money/src/money.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AccessResourceKind } from '../types/access-right.ts';
import type {
  BundleAlternative,
  BundleComponent,
  BundleFailurePolicy,
  ExperienceBundle,
  ExperienceIntent,
  ReservationWindow,
} from '../types/experience-bundle.ts';

export type CompositionComponentSpec = {
  readonly componentId: string;
  readonly label: string;
  readonly mandatory: 'MANDATORY' | 'OPTIONAL';
  readonly dependsOn?: readonly string[];
  readonly alternativeGroup?: string | null;
  readonly providerId: string;
  readonly resourceKind: AccessResourceKind;
  readonly quantity: number;
  readonly unit: string;
  readonly considerationMinorUnits: bigint;
  readonly currency: string;
  readonly reservationWindow: ReservationWindow;
};

export type CompositionSpec = {
  readonly intentSummary: string;
  readonly failurePolicy: BundleFailurePolicy;
  readonly quoteValidHours: number;
  readonly components: readonly CompositionComponentSpec[];
  readonly alternatives?: readonly BundleAlternative[];
};

export type CompositionProposal = {
  readonly proposalId: string;
  readonly intent: ExperienceIntent;
  readonly spec: CompositionSpec;
  readonly proposedBy: 'AI';
  readonly proposedAt: UtcInstant;
};

function addHours(instant: UtcInstant, hours: number): UtcInstant {
  return new Date(Date.parse(instant) + hours * 3_600_000).toISOString() as UtcInstant;
}

/**
 * AI may propose composition but cannot confirm the final bundle.
 */
export function proposeComposition(input: {
  readonly intent: ExperienceIntent;
  readonly spec: CompositionSpec;
  readonly now: UtcInstant;
}): CompositionProposal {
  return Object.freeze({
    proposalId: randomUUID(),
    intent: input.intent,
    spec: input.spec,
    proposedBy: 'AI',
    proposedAt: input.now,
  });
}

export function materializeBundle(input: {
  readonly proposal: CompositionProposal;
  readonly now: UtcInstant;
}): ExperienceBundle {
  const { proposal, now } = input;
  const quoteValidUntil = addHours(now, proposal.spec.quoteValidHours);
  const components: BundleComponent[] = proposal.spec.components.map((spec) => {
    const quote = Object.freeze({
      quoteId: randomUUID(),
      consideration: Money.fromMinorUnits(spec.considerationMinorUnits, spec.currency),
      quotedAt: now,
      validUntil: quoteValidUntil,
    });
    return Object.freeze({
      componentId: spec.componentId,
      label: spec.label,
      providerId: spec.providerId,
      resourceKind: spec.resourceKind,
      unit: spec.unit,
      mandatory: spec.mandatory,
      dependsOn: spec.dependsOn ?? [],
      alternativeGroup: spec.alternativeGroup ?? null,
      quote,
      reservationWindow: spec.reservationWindow,
      accessRight: null,
      reservation: null,
      entitlementConsumption: spec.quantity,
      state: 'PENDING' as const,
      failureReason: null,
    });
  });
  const totalConsideration = components.reduce(
    (sum, component) => sum.plus(component.quote.consideration),
    Money.zero(components[0]?.quote.consideration.currency ?? 'USD'),
  );
  return Object.freeze({
    bundleId: randomUUID(),
    subjectRef: proposal.intent.subjectRef,
    intentSummary: proposal.spec.intentSummary,
    failurePolicy: proposal.spec.failurePolicy,
    rollbackPolicy: Object.freeze({
      releaseHolds: true,
      refundCommitted: false,
      surfaceAlternatives: true,
    }),
    completionState: 'PROPOSED',
    components: Object.freeze(components),
    alternatives: Object.freeze(proposal.spec.alternatives ?? []),
    totalConsideration,
    quoteValidUntil,
    userApprovals: Object.freeze([]),
    proposedBy: 'AI',
    confirmedBy: null,
    authorizationEvidenceId: null,
    workflowEvidenceIds: Object.freeze([]),
    createdAt: now,
    updatedAt: now,
  });
}

export function confirmBundle(input: {
  readonly bundle: ExperienceBundle;
  readonly confirmedBy: string;
  readonly now: UtcInstant;
}): ExperienceBundle {
  if (input.bundle.completionState !== 'PROPOSED' && input.bundle.completionState !== 'AWAITING_USER_APPROVAL') {
    throw new Error(`bundle cannot be confirmed from state ${input.bundle.completionState}`);
  }
  const approval = Object.freeze({
    approvalId: randomUUID(),
    approvedBy: input.confirmedBy,
    approvedAt: input.now,
    scope: 'BUNDLE_CONFIRMATION' as const,
    approvedComponentIds: null,
  });
  return Object.freeze({
    ...input.bundle,
    completionState: 'AWAITING_USER_APPROVAL',
    confirmedBy: input.confirmedBy,
    userApprovals: Object.freeze([...input.bundle.userApprovals, approval]),
    updatedAt: input.now,
  });
}

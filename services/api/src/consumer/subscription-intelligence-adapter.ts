/**
 * Consumer BFF adapter for Wave 5 subscription intelligence.
 */

import type { EconomicActivity } from '../../../../packages/personal-economic-graph/src/store.ts';
import {
  SubscriptionIntelligenceService,
  type SubscriptionIntelligenceSnapshot,
  type SubscriptionActionProposal,
  type UsageSignal,
} from '../../../../packages/platform/src/subscription-intelligence/index.ts';

export type SubscriptionIntelligenceBff = {
  readonly analyze: (
    subjectId: string,
    activities: readonly EconomicActivity[],
    usageSignals?: readonly UsageSignal[],
  ) => SubscriptionIntelligenceSnapshot;
  readonly getSnapshot: (subjectId: string) => SubscriptionIntelligenceSnapshot;
  readonly proposeAction: (input: {
    readonly subjectId: string;
    readonly opportunityId: string;
    readonly idempotencyKey: string;
    readonly actorKind: string;
  }) => ReturnType<SubscriptionIntelligenceService['proposeAction']>;
  readonly authorizeAction: (input: {
    readonly subjectId: string;
    readonly actionId: string;
    readonly actorId: string;
    readonly actorKind: string;
    readonly stepUpSatisfied: boolean;
  }) => ReturnType<SubscriptionIntelligenceService['authorizeAction']>;
  readonly executeAction: (input: {
    readonly subjectId: string;
    readonly actionId: string;
    readonly actorKind: string;
    readonly merchantNormalized: string;
  }) => ReturnType<SubscriptionIntelligenceService['executeAction']>;
  readonly listAuditEvents: (subjectId: string) => ReturnType<SubscriptionIntelligenceService['audit']['list']>;
};

export function createSubscriptionIntelligenceBff(
  service: SubscriptionIntelligenceService,
): SubscriptionIntelligenceBff {
  return Object.freeze({
    analyze: (subjectId, activities, usageSignals) =>
      service.analyze({
        subjectId,
        activities,
        ...(usageSignals !== undefined ? { usageSignals } : {}),
      }),
    getSnapshot: (subjectId) => service.getSnapshot(subjectId),
    proposeAction: (input) => service.proposeAction(input),
    authorizeAction: (input) =>
      service.authorizeAction({
        ...input,
        actionId: input.actionId as SubscriptionActionProposal['actionId'],
      }),
    executeAction: (input) =>
      service.executeAction({
        ...input,
        actionId: input.actionId as SubscriptionActionProposal['actionId'],
      }),
    listAuditEvents: (subjectId) => service.audit.list(subjectId),
  });
}

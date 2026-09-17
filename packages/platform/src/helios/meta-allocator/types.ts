import type { CustomerId } from '../../../../domain/src/customer.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { EconomicWorkOrderId } from '../ids.ts';
import type { OpportunityCandidateId } from '../executable-opportunity/ids.ts';
import type { StrategyCapsuleRef } from '../strategy-capsule/types.ts';

export type MetaAllocatorRecommendationId = `marec_${string}`;

export type MetaAllocatorRecommendation = {
  readonly recommendationId: MetaAllocatorRecommendationId;
  readonly candidateId: OpportunityCandidateId;
  readonly workOrderId: EconomicWorkOrderId;
  readonly customerId: CustomerId;
  readonly capsuleRef: StrategyCapsuleRef;
  readonly recommendedAt: UtcInstant;
  readonly expectedEdgeBps: number;
  readonly rationale: string;
  readonly grantsExecutionAuthority: false;
};

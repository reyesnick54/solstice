/**
 * HELIOS EARN02 — temporal earnings event graph types.
 */

import type { UtcInstant } from '@solstice/domain';
import type { EarningsExternalObservation, EarningsFiscalIdentity } from '@solstice/external-data';
import type { EarningsSessionTiming } from '@solstice/external-data';
import type {
  EarningsGraphEdgeKind,
  EarningsGraphNodeKind,
  HELIOS_EARNINGS_EVENT_GRAPH_SCHEMA,
} from './taxonomy.ts';

export type EarningsEventTimeView = {
  readonly scheduledEventTime: UtcInstant | null;
  readonly confirmedEventTime: UtcInstant | null;
  readonly actualReleaseTime: UtcInstant | null;
  readonly secAcceptedTime: UtcInstant | null;
  readonly callStartTime: UtcInstant | null;
  readonly providerAvailabilityTime: UtcInstant | null;
  readonly sunreyArrivalTime: UtcInstant | null;
  readonly knowableAt: UtcInstant | null;
};

export type EarningsGraphNode = {
  readonly nodeId: string;
  readonly kind: EarningsGraphNodeKind;
  readonly earningsEventKey: string;
  readonly canonicalEntityId: string;
  readonly fiscal: EarningsFiscalIdentity | null;
  readonly observationId: string | null;
  readonly knowableAt: UtcInstant;
  readonly payload: Readonly<Record<string, string>>;
  readonly grantsExecutionAuthority: false;
};

export type EarningsGraphEdge = {
  readonly edgeId: string;
  readonly kind: EarningsGraphEdgeKind;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly knowableAt: UtcInstant;
  readonly lineageRootId: string | null;
};

export type SealedEarningsGraphObservation = {
  readonly observation: EarningsExternalObservation;
  readonly sealedAt: UtcInstant;
};

export type EarningsEventGraphSnapshot = {
  readonly schema: typeof HELIOS_EARNINGS_EVENT_GRAPH_SCHEMA;
  readonly graphVersion: number;
  readonly nodes: readonly EarningsGraphNode[];
  readonly edges: readonly EarningsGraphEdge[];
  readonly observations: readonly SealedEarningsGraphObservation[];
};

export type PointInTimeEarningsEventSnapshot = {
  readonly schema: typeof HELIOS_EARNINGS_EVENT_GRAPH_SCHEMA;
  readonly decisionTimeUtc: UtcInstant;
  readonly earningsEventKey: string;
  readonly canonicalEntityId: string;
  readonly fiscal: EarningsFiscalIdentity;
  readonly times: EarningsEventTimeView;
  readonly sessionTiming: EarningsSessionTiming;
  readonly nodes: readonly EarningsGraphNode[];
  readonly edges: readonly EarningsGraphEdge[];
  readonly revisionChainIds: readonly string[];
  readonly rescheduledFromEventKey: string | null;
  readonly grantsExecutionAuthority: false;
};

export type CompilePointInTimeSnapshotInput = {
  readonly earningsEventKey: string;
  readonly decisionTimeUtc: UtcInstant;
  readonly revisionPolicy?: 'LATEST_KNOWABLE_REVISION' | 'INITIAL_PUBLICATION_ONLY';
};

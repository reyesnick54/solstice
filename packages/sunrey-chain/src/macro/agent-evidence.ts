/**
 * Read-only agent evidence exposure for macro observations.
 */

import {
  bundleObservationEvidence,
  EXTERNAL_OBSERVATION_EVIDENCE_KIND,
  toAgentEvidenceRef,
  type AgentEvidenceBundle,
  type ExternalObservationEvidenceRef,
} from '../../../provider-sdk/src/agent-evidence.ts';
import type { ExternalObservation } from '../../../provider-sdk/src/types.ts';
import type { MacroIndicator, MacroTimeSeries } from './types.ts';

export { EXTERNAL_OBSERVATION_EVIDENCE_KIND, toAgentEvidenceRef, bundleObservationEvidence };
export type { ExternalObservationEvidenceRef, AgentEvidenceBundle };

export function macroIndicatorToAgentEvidence(
  observation: ExternalObservation<MacroIndicator>,
): ExternalObservationEvidenceRef {
  return toAgentEvidenceRef(observation);
}

export function macroTimeSeriesToAgentEvidence(
  observation: ExternalObservation<MacroTimeSeries>,
): ExternalObservationEvidenceRef {
  return toAgentEvidenceRef(observation);
}

export function bundleMacroObservations(
  observations: readonly ExternalObservation<MacroIndicator | MacroTimeSeries>[],
): AgentEvidenceBundle {
  return bundleObservationEvidence(observations);
}

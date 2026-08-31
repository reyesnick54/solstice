/**
 * Financial Agent external evidence BFF adapter.
 *
 * Evidence references only. Never grants Execution Authority.
 */

import type { ExternalDataPlane } from '../../../../packages/external-data/src/plane.ts';
import {
  buildAgentEvidenceCatalog,
  type AgentEvidenceCatalog,
} from '../../../../packages/external-data/src/agent-evidence-catalog.ts';
import { sampleActionCenterEvents } from '../../../../packages/external-data/src/bridges.ts';
import type { Wave2ActionCenterEvent } from '../../../../packages/external-data/src/events.ts';

export type AgentExternalEvidenceBff = {
  readonly evidenceCatalog: () => Promise<AgentEvidenceCatalog>;
  readonly externalEvents: () => readonly Wave2ActionCenterEvent[];
};

export function createAgentExternalEvidenceBff(plane: ExternalDataPlane): AgentExternalEvidenceBff {
  return Object.freeze({
    async evidenceCatalog() {
      return buildAgentEvidenceCatalog(plane);
    },
    externalEvents() {
      return sampleActionCenterEvents(plane);
    },
  });
}

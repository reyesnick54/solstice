import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { JurisdictionCapabilityRegistry } from './registry.ts';
import type {
  CanPerformInput,
  CanPerformResult,
  CapabilityDecisionRecord,
  JurisdictionCapabilityStoreSnapshot,
} from './types.ts';

export class JurisdictionCapabilityStore {
  private readonly decisions: CapabilityDecisionRecord[] = [];

  recordDecision(input: CanPerformInput, result: CanPerformResult, sealedAt: UtcInstant): CapabilityDecisionRecord {
    const record = Object.freeze({
      decisionId: `jcap-dec_${randomUUID()}`,
      input: Object.freeze({ ...input }),
      result: Object.freeze({ ...result }),
      sealedAt,
    });
    this.decisions.push(record);
    return record;
  }

  listDecisions(): readonly CapabilityDecisionRecord[] {
    return Object.freeze([...this.decisions]);
  }

  decisionsForCustomer(customerId: string): readonly CapabilityDecisionRecord[] {
    return Object.freeze(this.decisions.filter((row) => row.input.customerId === customerId));
  }

  snapshot(registry: JurisdictionCapabilityRegistry): JurisdictionCapabilityStoreSnapshot {
    const reg = registry.snapshot();
    return Object.freeze({
      packs: reg.packs,
      decisions: this.listDecisions(),
      activePackVersions: reg.activePackVersions,
    });
  }

  restore(snapshot: JurisdictionCapabilityStoreSnapshot, registry: JurisdictionCapabilityRegistry): void {
    registry.hydrate(snapshot.packs);
    for (const [jurisdictionId, version] of Object.entries(snapshot.activePackVersions)) {
      registry.activatePackVersion(jurisdictionId as Parameters<typeof registry.activatePackVersion>[0], version);
    }
    this.decisions.length = 0;
    for (const decision of snapshot.decisions) {
      this.decisions.push(Object.freeze({ ...decision }));
    }
  }
}

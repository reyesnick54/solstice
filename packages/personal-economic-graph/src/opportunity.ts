import type { UtcInstant } from '../../domain/src/time.ts';
import type { EconomicGraphId, EconomicNodeId, EconomicOpportunityId } from './ids.ts';
import type { FactConfidence, Provenance } from './provenance.ts';
import type { OpportunityKind, SerializedMoney } from './taxonomy.ts';

/**
 * Opportunities are proposal-only data objects. They cannot execute
 * financial changes, post journals, or issue Execution Authority.
 */
export type EconomicOpportunity = {
  readonly opportunityId: EconomicOpportunityId;
  readonly graphId: EconomicGraphId;
  readonly nodeId: EconomicNodeId;
  readonly kind: OpportunityKind;
  readonly title: string;
  readonly relatedNodeIds: readonly EconomicNodeId[];
  readonly estimatedImpact?: SerializedMoney;
  readonly status: 'PROPOSAL';
  readonly executable: false;
  readonly confidence: FactConfidence;
  readonly provenance: Provenance;
  readonly createdAt: UtcInstant;
  readonly survivesRebuild: boolean;
};

export function freezeOpportunity(opportunity: EconomicOpportunity): EconomicOpportunity {
  return Object.freeze({
    ...opportunity,
    relatedNodeIds: Object.freeze([...opportunity.relatedNodeIds]),
    provenance: Object.freeze({ ...opportunity.provenance }),
    status: 'PROPOSAL',
    executable: false,
  });
}

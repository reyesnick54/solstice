import type { UtcInstant } from '../../domain/src/time.ts';
import { freezeEdge, type EconomicEdge } from './edge.ts';
import { freezeFact, isCurrentFact, type EconomicFact } from './fact.ts';
import { freezeGraph, type EconomicGraph } from './graph.ts';
import type {
  EconomicActivityId,
  EconomicEdgeId,
  EconomicFactId,
  EconomicGraphId,
  EconomicNodeId,
  EconomicOpportunityId,
  EconomicSnapshotId,
} from './ids.ts';
import { freezeNode, type EconomicNode } from './node.ts';
import { freezeOpportunity, type EconomicOpportunity } from './opportunity.ts';
import { sourcesDisagree, type DataQualityState, type SourceType } from './provenance.ts';
import type { ActivityClassification, Counterpart, SerializedMoney } from './taxonomy.ts';

export type EconomicActivity = {
  readonly activityId: EconomicActivityId;
  readonly graphId: EconomicGraphId;
  readonly subjectId: string;
  readonly accountId?: string;
  readonly direction: 'INFLOW' | 'OUTFLOW';
  readonly amount: SerializedMoney;
  readonly occurredAt: UtcInstant;
  readonly counterpart?: Counterpart;
  readonly classification: ActivityClassification;
  readonly sourceType: SourceType;
  readonly sourceRef: string;
  readonly sourceEventType: string;
  readonly sourceEventId: string;
};

export type StoredSnapshot = {
  readonly snapshotId: EconomicSnapshotId;
  readonly graphId: EconomicGraphId;
  readonly generatedAt: UtcInstant;
  readonly bodyCanonical: string;
};

export type EconomicGraphSnapshotState = {
  readonly graphs: readonly EconomicGraph[];
  readonly nodes: readonly EconomicNode[];
  readonly edges: readonly EconomicEdge[];
  readonly facts: readonly EconomicFact[];
  readonly activities: readonly EconomicActivity[];
  readonly opportunities: readonly EconomicOpportunity[];
  readonly snapshots: readonly StoredSnapshot[];
  readonly processedEventIds: readonly string[];
};

export class InMemoryEconomicGraphStore {
  private readonly graphs = new Map<string, EconomicGraph>();
  private readonly nodes = new Map<string, EconomicNode>();
  private readonly edges = new Map<string, EconomicEdge>();
  private readonly facts = new Map<string, EconomicFact>();
  private readonly activities = new Map<string, EconomicActivity>();
  private readonly opportunities = new Map<string, EconomicOpportunity>();
  private readonly snapshots = new Map<string, StoredSnapshot>();
  private readonly processedEventIds = new Set<string>();

  putGraph(graph: EconomicGraph): EconomicGraph {
    const frozen = freezeGraph(graph);
    this.graphs.set(frozen.graphId, frozen);
    return frozen;
  }

  getGraph(graphId: EconomicGraphId): EconomicGraph | undefined {
    return this.graphs.get(graphId);
  }

  getGraphBySubject(subjectId: string): EconomicGraph | undefined {
    for (const graph of this.graphs.values()) {
      if (graph.subjectId === subjectId) {
        return graph;
      }
    }
    return undefined;
  }

  putNode(node: EconomicNode): EconomicNode {
    const frozen = freezeNode(node);
    this.nodes.set(frozen.nodeId, frozen);
    return frozen;
  }

  getNode(nodeId: EconomicNodeId): EconomicNode | undefined {
    return this.nodes.get(nodeId);
  }

  nodesFor(graphId: EconomicGraphId): readonly EconomicNode[] {
    return [...this.nodes.values()].filter((node) => node.graphId === graphId);
  }

  putEdge(edge: EconomicEdge): EconomicEdge {
    const frozen = freezeEdge(edge);
    this.edges.set(frozen.edgeId, frozen);
    return frozen;
  }

  getEdge(edgeId: EconomicEdgeId): EconomicEdge | undefined {
    return this.edges.get(edgeId);
  }

  edgesFor(graphId: EconomicGraphId): readonly EconomicEdge[] {
    return [...this.edges.values()].filter((edge) => edge.graphId === graphId);
  }

  putFact(fact: EconomicFact): EconomicFact {
    const frozen = freezeFact(fact);
    if (!frozen.ok) {
      throw new Error(frozen.error.message);
    }
    this.facts.set(frozen.value.factId, frozen.value);
    this.markConflicts(frozen.value);
    return frozen.value;
  }

  supersedeFact(previousId: EconomicFactId, next: EconomicFact): EconomicFact {
    const previous = this.facts.get(previousId);
    if (previous && previous.supersededBy === null) {
      this.facts.set(previousId, Object.freeze({ ...previous, supersededBy: next.factId }));
    }
    return this.putFact(next);
  }

  currentFactsFor(graphId: EconomicGraphId, at: UtcInstant): readonly EconomicFact[] {
    return [...this.facts.values()].filter((fact) => fact.graphId === graphId && isCurrentFact(fact, at));
  }

  factsForNode(nodeId: EconomicNodeId, at: UtcInstant): readonly EconomicFact[] {
    return [...this.facts.values()].filter(
      (fact) => fact.nodeId === nodeId && isCurrentFact(fact, at),
    );
  }

  putActivity(activity: EconomicActivity): EconomicActivity {
    const frozen = Object.freeze({
      ...activity,
      amount: Object.freeze({ ...activity.amount }),
      ...(activity.counterpart ? { counterpart: Object.freeze({ ...activity.counterpart }) } : {}),
    });
    this.activities.set(frozen.activityId, frozen);
    return frozen;
  }

  activitiesFor(graphId: EconomicGraphId): readonly EconomicActivity[] {
    return [...this.activities.values()]
      .filter((activity) => activity.graphId === graphId)
      .sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0));
  }

  putOpportunity(opportunity: EconomicOpportunity): EconomicOpportunity {
    const frozen = freezeOpportunity(opportunity);
    this.opportunities.set(frozen.opportunityId, frozen);
    return frozen;
  }

  getOpportunity(opportunityId: EconomicOpportunityId): EconomicOpportunity | undefined {
    return this.opportunities.get(opportunityId);
  }

  opportunitiesFor(graphId: EconomicGraphId): readonly EconomicOpportunity[] {
    return [...this.opportunities.values()].filter((item) => item.graphId === graphId);
  }

  putSnapshot(snapshot: StoredSnapshot): StoredSnapshot {
    const frozen = Object.freeze({ ...snapshot });
    this.snapshots.set(frozen.snapshotId, frozen);
    return frozen;
  }

  getSnapshot(snapshotId: EconomicSnapshotId): StoredSnapshot | undefined {
    return this.snapshots.get(snapshotId);
  }

  snapshotsFor(graphId: EconomicGraphId): readonly StoredSnapshot[] {
    return [...this.snapshots.values()].filter((item) => item.graphId === graphId);
  }

  markProcessed(eventId: string): void {
    this.processedEventIds.add(eventId);
  }

  hasProcessed(eventId: string): boolean {
    return this.processedEventIds.has(eventId);
  }

  /**
   * Destroys derived projection state. User-declared nodes, edges, facts,
   * opportunities, and activities survive rebuild.
   */
  destroyDerived(graphId: EconomicGraphId): void {
    for (const [id, node] of [...this.nodes.entries()]) {
      if (node.graphId === graphId && !node.survivesRebuild) {
        this.nodes.delete(id);
      }
    }
    for (const [id, edge] of [...this.edges.entries()]) {
      if (edge.graphId === graphId && !edge.survivesRebuild) {
        this.edges.delete(id);
      }
    }
    for (const [id, fact] of [...this.facts.entries()]) {
      if (fact.graphId === graphId && !fact.survivesRebuild) {
        this.facts.delete(id);
      }
    }
    for (const [id, activity] of [...this.activities.entries()]) {
      if (activity.graphId === graphId && activity.sourceType !== 'USER_DECLARED') {
        this.activities.delete(id);
      }
    }
    for (const [id, opportunity] of [...this.opportunities.entries()]) {
      if (opportunity.graphId === graphId && !opportunity.survivesRebuild) {
        this.opportunities.delete(id);
      }
    }
    for (const [id, snapshot] of [...this.snapshots.entries()]) {
      if (snapshot.graphId === graphId) {
        this.snapshots.delete(id);
      }
    }
    this.processedEventIds.clear();
  }

  exportState(): EconomicGraphSnapshotState {
    return Object.freeze({
      graphs: Object.freeze([...this.graphs.values()]),
      nodes: Object.freeze([...this.nodes.values()]),
      edges: Object.freeze([...this.edges.values()]),
      facts: Object.freeze([...this.facts.values()]),
      activities: Object.freeze([...this.activities.values()]),
      opportunities: Object.freeze([...this.opportunities.values()]),
      snapshots: Object.freeze([...this.snapshots.values()]),
      processedEventIds: Object.freeze([...this.processedEventIds]),
    });
  }

  loadState(state: EconomicGraphSnapshotState): void {
    this.graphs.clear();
    this.nodes.clear();
    this.edges.clear();
    this.facts.clear();
    this.activities.clear();
    this.opportunities.clear();
    this.snapshots.clear();
    this.processedEventIds.clear();
    for (const graph of state.graphs) {
      this.putGraph(graph);
    }
    for (const node of state.nodes) {
      this.putNode(node);
    }
    for (const edge of state.edges) {
      this.putEdge(edge);
    }
    for (const fact of state.facts) {
      this.facts.set(fact.factId, fact);
    }
    for (const activity of state.activities) {
      this.putActivity(activity);
    }
    for (const opportunity of state.opportunities) {
      this.putOpportunity(opportunity);
    }
    for (const snapshot of state.snapshots) {
      this.putSnapshot(snapshot);
    }
    for (const eventId of state.processedEventIds) {
      this.processedEventIds.add(eventId);
    }
  }

  private markConflicts(incoming: EconomicFact): void {
    if (incoming.supersededBy !== null || incoming.nodeId === undefined) {
      return;
    }
    for (const [id, existing] of this.facts.entries()) {
      if (
        existing.factId === incoming.factId ||
        existing.nodeId !== incoming.nodeId ||
        existing.key !== incoming.key ||
        existing.supersededBy !== null
      ) {
        continue;
      }
      if (
        sourcesDisagree(
          { confidence: existing.confidence, valueKey: JSON.stringify(existing.value) },
          { confidence: incoming.confidence, valueKey: JSON.stringify(incoming.value) },
        )
      ) {
        const quality: DataQualityState = 'CONFLICTED';
        this.facts.set(id, Object.freeze({ ...existing, quality }));
        this.facts.set(incoming.factId, Object.freeze({ ...incoming, quality }));
      }
    }
  }
}

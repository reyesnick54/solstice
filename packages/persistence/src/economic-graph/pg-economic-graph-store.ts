import type { Pool } from 'pg';

import type { EconomicEdge } from '../../../personal-economic-graph/src/edge.ts';
import type { EconomicFact } from '../../../personal-economic-graph/src/fact.ts';
import type { EconomicGraph } from '../../../personal-economic-graph/src/graph.ts';
import type { EconomicNode } from '../../../personal-economic-graph/src/node.ts';
import type { EconomicOpportunity } from '../../../personal-economic-graph/src/opportunity.ts';
import type {
  ClassifiedActivityOverlay,
  EconomicActivity,
  EconomicGraphSnapshotState,
  StoredSnapshot,
} from '../../../personal-economic-graph/src/store.ts';
import type { ActivityClassification } from '../../../personal-economic-graph/src/taxonomy.ts';
import { withClient } from '../postgres/pools.ts';

export async function persistEconomicGraphState(
  pool: Pool,
  state: EconomicGraphSnapshotState,
): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const graph of state.graphs) {
        await client.query(
          `INSERT INTO economic_graph.graph
             (graph_id, subject_id, customer_id, created_at, authoritative_balance, mutates_financial_state)
           VALUES ($1,$2,$3,$4,FALSE,FALSE)
           ON CONFLICT (graph_id) DO UPDATE SET
             customer_id = EXCLUDED.customer_id`,
          [graph.graphId, graph.subjectId, graph.customerId ?? null, graph.createdAt],
        );
      }
      for (const node of state.nodes) {
        await client.query(
          `INSERT INTO economic_graph.node
             (node_id, graph_id, kind, attributes_canonical, canonical_system, canonical_id,
              quality, confidence, provenance_canonical, created_at, survives_rebuild)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (node_id) DO UPDATE SET
             attributes_canonical = EXCLUDED.attributes_canonical,
             quality = EXCLUDED.quality,
             confidence = EXCLUDED.confidence,
             provenance_canonical = EXCLUDED.provenance_canonical`,
          [
            node.nodeId,
            node.graphId,
            node.kind,
            JSON.stringify(node.attributes),
            node.canonicalRef?.system ?? null,
            node.canonicalRef?.id ?? null,
            node.quality,
            node.confidence,
            JSON.stringify(node.provenance),
            node.createdAt,
            node.survivesRebuild,
          ],
        );
      }
      for (const edge of state.edges) {
        await client.query(
          `INSERT INTO economic_graph.edge
             (edge_id, graph_id, kind, from_node_id, to_node_id, valid_from, valid_to,
              quality, confidence, provenance_canonical, created_at, survives_rebuild)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (edge_id) DO UPDATE SET
             valid_to = EXCLUDED.valid_to,
             quality = EXCLUDED.quality`,
          [
            edge.edgeId,
            edge.graphId,
            edge.kind,
            edge.fromNodeId,
            edge.toNodeId,
            edge.validFrom,
            edge.validTo,
            edge.quality,
            edge.confidence,
            JSON.stringify(edge.provenance),
            edge.createdAt,
            edge.survivesRebuild,
          ],
        );
      }
      for (const fact of state.facts) {
        await client.query(
          `INSERT INTO economic_graph.fact
             (fact_id, graph_id, node_id, edge_id, fact_key, value_canonical, confidence, quality,
              provenance_canonical, valid_from, valid_to, observed_at, effective_at, superseded_by,
              version, survives_rebuild)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
           ON CONFLICT (fact_id) DO UPDATE SET
             superseded_by = EXCLUDED.superseded_by,
             quality = EXCLUDED.quality`,
          [
            fact.factId,
            fact.graphId,
            fact.nodeId ?? null,
            fact.edgeId ?? null,
            fact.key,
            JSON.stringify(fact.value),
            fact.confidence,
            fact.quality,
            JSON.stringify(fact.provenance),
            fact.validFrom,
            fact.validTo,
            fact.observedAt,
            fact.effectiveAt,
            fact.supersededBy,
            fact.version,
            fact.survivesRebuild,
          ],
        );
      }
      for (const activity of state.activities) {
        await client.query(
          `INSERT INTO economic_graph.activity
             (activity_id, graph_id, subject_id, account_id, direction, amount_minor_units, currency,
              occurred_at, counterpart_canonical, classification, source_type, source_ref,
              source_event_type, source_event_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT (activity_id) DO NOTHING`,
          [
            activity.activityId,
            activity.graphId,
            activity.subjectId,
            activity.accountId ?? null,
            activity.direction,
            activity.amount.minorUnits,
            activity.amount.currency,
            activity.occurredAt,
            activity.counterpart ? JSON.stringify(activity.counterpart) : null,
            activity.classification,
            activity.sourceType,
            activity.sourceRef,
            activity.sourceEventType,
            activity.sourceEventId,
          ],
        );
      }
      for (const opportunity of state.opportunities) {
        await client.query(
          `INSERT INTO economic_graph.opportunity
             (opportunity_id, graph_id, node_id, kind, title, related_node_ids, estimated_impact_canonical,
              status, executable, confidence, provenance_canonical, created_at, survives_rebuild)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'PROPOSAL',FALSE,$8,$9,$10,$11)
           ON CONFLICT (opportunity_id) DO NOTHING`,
          [
            opportunity.opportunityId,
            opportunity.graphId,
            opportunity.nodeId,
            opportunity.kind,
            opportunity.title,
            JSON.stringify(opportunity.relatedNodeIds),
            opportunity.estimatedImpact ? JSON.stringify(opportunity.estimatedImpact) : null,
            opportunity.confidence,
            JSON.stringify(opportunity.provenance),
            opportunity.createdAt,
            opportunity.survivesRebuild,
          ],
        );
      }
      for (const snapshot of state.snapshots) {
        await client.query(
          `INSERT INTO economic_graph.snapshot
             (snapshot_id, graph_id, generated_at, body_canonical)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (snapshot_id) DO NOTHING`,
          [snapshot.snapshotId, snapshot.graphId, snapshot.generatedAt, snapshot.bodyCanonical],
        );
      }
      for (const eventId of state.processedEventIds) {
        await client.query(
          `INSERT INTO economic_graph.processed_event (event_id) VALUES ($1) ON CONFLICT DO NOTHING`,
          [eventId],
        );
      }
      for (const overlay of state.overlays ?? []) {
        await client.query(
          `INSERT INTO economic_graph.overlay
             (source_event_id, subject_id, classification, counterpart_canonical, user_corrected, account_id, amount_canonical, direction)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (source_event_id) DO UPDATE SET
             classification = EXCLUDED.classification,
             counterpart_canonical = EXCLUDED.counterpart_canonical,
             user_corrected = EXCLUDED.user_corrected`,
          [
            overlay.sourceEventId,
            overlay.subjectId,
            overlay.classification,
            overlay.counterpart ? JSON.stringify(overlay.counterpart) : null,
            overlay.userCorrected === true,
            overlay.accountId ?? null,
            overlay.amount ? JSON.stringify(overlay.amount) : null,
            overlay.direction ?? null,
          ],
        );
      }
      for (const row of state.accountCurrencies ?? []) {
        await client.query(
          `INSERT INTO economic_graph.account_currency (account_id, currency)
           VALUES ($1,$2)
           ON CONFLICT (account_id) DO UPDATE SET currency = EXCLUDED.currency`,
          [row.accountId, row.currency],
        );
      }
      for (const insight of state.insights ?? []) {
        await client.query(
          `INSERT INTO economic_graph.insight
             (insight_id, graph_id, insight_type, severity, body_canonical, calculated_at)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (insight_id) DO UPDATE SET
             severity = EXCLUDED.severity,
             body_canonical = EXCLUDED.body_canonical,
             calculated_at = EXCLUDED.calculated_at`,
          [
            insight.insightId,
            insight.graphId,
            insight.type,
            insight.severity,
            JSON.stringify(insight),
            insight.calculatedAt,
          ],
        );
      }
      for (const row of state.suitability ?? []) {
        await client.query(
          `INSERT INTO economic_graph.suitability (subject_id, body_canonical, assessed_at)
           VALUES ($1,$2,$3)
           ON CONFLICT (subject_id) DO UPDATE SET
             body_canonical = EXCLUDED.body_canonical,
             assessed_at = EXCLUDED.assessed_at`,
          [row.subjectId, JSON.stringify(row.profile), row.profile.assessedAt],
        );
      }
      for (const row of state.accessEvidence ?? []) {
        await client.query(
          `INSERT INTO economic_graph.access_evidence
             (evidence_id, graph_id, actor_id, subject_id, purpose, categories_canonical, decision, reason, occurred_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (evidence_id) DO NOTHING`,
          [
            row.evidenceId,
            row.graphId,
            row.actorId,
            row.subjectId,
            row.purpose,
            JSON.stringify(row.categories),
            row.decision,
            row.reason,
            row.at,
          ],
        );
      }
      for (const row of state.history ?? []) {
        await client.query(
          `INSERT INTO economic_graph.history_point
             (history_id, graph_id, captured_at, series, currency, minor_units, source_snapshot_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (history_id) DO NOTHING`,
          [
            row.historyId,
            row.graphId,
            row.capturedAt,
            row.series,
            row.currency,
            row.minorUnits,
            row.sourceSnapshotId,
          ],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function loadEconomicGraphState(pool: Pool): Promise<EconomicGraphSnapshotState> {
  return withClient(pool, async (client) => {
    const graphs = await client.query<{
      graph_id: string;
      subject_id: string;
      customer_id: string | null;
      created_at: Date;
    }>('SELECT graph_id, subject_id, customer_id, created_at FROM economic_graph.graph');
    const nodes = await client.query<{
      node_id: string;
      graph_id: string;
      kind: string;
      attributes_canonical: string;
      canonical_system: string | null;
      canonical_id: string | null;
      quality: string;
      confidence: string;
      provenance_canonical: string;
      created_at: Date;
      survives_rebuild: boolean;
    }>('SELECT * FROM economic_graph.node');
    const edges = await client.query('SELECT * FROM economic_graph.edge');
    const facts = await client.query('SELECT * FROM economic_graph.fact');
    const activities = await client.query('SELECT * FROM economic_graph.activity');
    const opportunities = await client.query('SELECT * FROM economic_graph.opportunity');
    const snapshots = await client.query('SELECT * FROM economic_graph.snapshot');
    const processed = await client.query<{ event_id: string }>('SELECT event_id FROM economic_graph.processed_event');
    const overlays = await client.query('SELECT * FROM economic_graph.overlay');
    const currencies = await client.query('SELECT * FROM economic_graph.account_currency');
    const insights = await client.query('SELECT * FROM economic_graph.insight');
    const suitability = await client.query('SELECT * FROM economic_graph.suitability');
    const access = await client.query('SELECT * FROM economic_graph.access_evidence');
    const history = await client.query('SELECT * FROM economic_graph.history_point');

    return Object.freeze({
      graphs: Object.freeze(
        graphs.rows.map(
          (row) =>
            ({
              graphId: row.graph_id,
              subjectId: row.subject_id,
              ...(row.customer_id ? { customerId: row.customer_id } : {}),
              createdAt: row.created_at.toISOString(),
              authoritativeBalance: false,
              mutatesFinancialState: false,
            }) as EconomicGraph,
        ),
      ),
      nodes: Object.freeze(
        nodes.rows.map((row) => {
          const node = {
            nodeId: row.node_id as EconomicNode['nodeId'],
            graphId: row.graph_id as EconomicNode['graphId'],
            kind: row.kind as EconomicNode['kind'],
            attributes: JSON.parse(row.attributes_canonical) as EconomicNode['attributes'],
            quality: row.quality as EconomicNode['quality'],
            confidence: row.confidence as EconomicNode['confidence'],
            provenance: JSON.parse(row.provenance_canonical) as EconomicNode['provenance'],
            createdAt: row.created_at.toISOString() as EconomicNode['createdAt'],
            survivesRebuild: row.survives_rebuild,
            ...(row.canonical_system && row.canonical_id
              ? {
                  canonicalRef: {
                    system: row.canonical_system as NonNullable<EconomicNode['canonicalRef']>['system'],
                    id: row.canonical_id,
                  },
                }
              : {}),
          };
          return node as EconomicNode;
        }),
      ),
      edges: Object.freeze(edges.rows.map(rowToEdge)) as readonly EconomicEdge[],
      facts: Object.freeze(facts.rows.map(rowToFact)) as readonly EconomicFact[],
      activities: Object.freeze(activities.rows.map(rowToActivity)) as readonly EconomicActivity[],
      opportunities: Object.freeze(opportunities.rows.map(rowToOpportunity)) as readonly EconomicOpportunity[],
      snapshots: Object.freeze(snapshots.rows.map(rowToSnapshot)) as readonly StoredSnapshot[],
      processedEventIds: Object.freeze(processed.rows.map((row) => row.event_id)),
      overlays: Object.freeze(
        overlays.rows.map((row) => ({
          sourceEventId: String(row.source_event_id),
          subjectId: String(row.subject_id),
          classification: String(row.classification) as ActivityClassification,
          ...(row.counterpart_canonical ? { counterpart: JSON.parse(String(row.counterpart_canonical)) } : {}),
          ...(row.user_corrected ? { userCorrected: true } : {}),
          ...(row.account_id ? { accountId: String(row.account_id) } : {}),
          ...(row.amount_canonical ? { amount: JSON.parse(String(row.amount_canonical)) } : {}),
          ...(row.direction ? { direction: String(row.direction) } : {}),
        })) as ClassifiedActivityOverlay[],
      ),
      accountCurrencies: Object.freeze(
        currencies.rows.map((row) => ({
          accountId: String(row.account_id),
          currency: String(row.currency),
        })),
      ),
      insights: Object.freeze(insights.rows.map((row) => JSON.parse(String(row.body_canonical)))),
      suitability: Object.freeze(
        suitability.rows.map((row) => ({
          subjectId: String(row.subject_id),
          profile: JSON.parse(String(row.body_canonical)),
        })),
      ),
      accessEvidence: Object.freeze(
        access.rows.map((row) => ({
          evidenceId: String(row.evidence_id),
          graphId: String(row.graph_id),
          actorId: String(row.actor_id),
          subjectId: String(row.subject_id),
          purpose: String(row.purpose),
          categories: JSON.parse(String(row.categories_canonical)),
          decision: String(row.decision),
          reason: String(row.reason),
          at: new Date(String(row.occurred_at)).toISOString(),
        })),
      ),
      history: Object.freeze(
        history.rows.map((row) => ({
          historyId: String(row.history_id),
          graphId: String(row.graph_id),
          capturedAt: new Date(String(row.captured_at)).toISOString(),
          series: String(row.series),
          currency: String(row.currency),
          minorUnits: String(row.minor_units),
          sourceSnapshotId: row.source_snapshot_id ? String(row.source_snapshot_id) : null,
        })),
      ),
    } as EconomicGraphSnapshotState);
  });
}

function rowToEdge(row: Record<string, unknown>): EconomicEdge {
  return {
    edgeId: String(row.edge_id) as EconomicEdge['edgeId'],
    graphId: String(row.graph_id) as EconomicEdge['graphId'],
    kind: String(row.kind) as EconomicEdge['kind'],
    fromNodeId: String(row.from_node_id) as EconomicEdge['fromNodeId'],
    toNodeId: String(row.to_node_id) as EconomicEdge['toNodeId'],
    validFrom: new Date(String(row.valid_from)).toISOString() as EconomicEdge['validFrom'],
    validTo: row.valid_to ? (new Date(String(row.valid_to)).toISOString() as EconomicEdge['validTo']) : null,
    quality: String(row.quality) as EconomicEdge['quality'],
    confidence: String(row.confidence) as EconomicEdge['confidence'],
    provenance: JSON.parse(String(row.provenance_canonical)) as EconomicEdge['provenance'],
    createdAt: new Date(String(row.created_at)).toISOString() as EconomicEdge['createdAt'],
    survivesRebuild: Boolean(row.survives_rebuild),
  };
}

function rowToFact(row: Record<string, unknown>): EconomicFact {
  const fact = {
    factId: String(row.fact_id) as EconomicFact['factId'],
    graphId: String(row.graph_id) as EconomicFact['graphId'],
    ...(row.node_id ? { nodeId: String(row.node_id) as EconomicFact['nodeId'] } : {}),
    ...(row.edge_id ? { edgeId: String(row.edge_id) as EconomicFact['edgeId'] } : {}),
    key: String(row.fact_key),
    value: JSON.parse(String(row.value_canonical)) as EconomicFact['value'],
    confidence: String(row.confidence) as EconomicFact['confidence'],
    quality: String(row.quality) as EconomicFact['quality'],
    provenance: JSON.parse(String(row.provenance_canonical)) as EconomicFact['provenance'],
    validFrom: new Date(String(row.valid_from)).toISOString() as EconomicFact['validFrom'],
    validTo: row.valid_to ? (new Date(String(row.valid_to)).toISOString() as EconomicFact['validTo']) : null,
    observedAt: new Date(String(row.observed_at)).toISOString() as EconomicFact['observedAt'],
    effectiveAt: new Date(String(row.effective_at)).toISOString() as EconomicFact['effectiveAt'],
    supersededBy: row.superseded_by ? (String(row.superseded_by) as EconomicFact['supersededBy']) : null,
    version: Number(row.version),
    survivesRebuild: Boolean(row.survives_rebuild),
  };
  return fact as EconomicFact;
}

function rowToActivity(row: Record<string, unknown>): EconomicActivity {
  const activity = {
    activityId: String(row.activity_id) as EconomicActivity['activityId'],
    graphId: String(row.graph_id) as EconomicActivity['graphId'],
    subjectId: String(row.subject_id),
    ...(row.account_id ? { accountId: String(row.account_id) } : {}),
    direction: String(row.direction) as EconomicActivity['direction'],
    amount: {
      minorUnits: String(row.amount_minor_units),
      currency: String(row.currency),
    },
    occurredAt: new Date(String(row.occurred_at)).toISOString() as EconomicActivity['occurredAt'],
    ...(row.counterpart_canonical
      ? { counterpart: JSON.parse(String(row.counterpart_canonical)) as NonNullable<EconomicActivity['counterpart']> }
      : {}),
    classification: String(row.classification) as EconomicActivity['classification'],
    sourceType: String(row.source_type) as EconomicActivity['sourceType'],
    sourceRef: String(row.source_ref),
    sourceEventType: String(row.source_event_type),
    sourceEventId: String(row.source_event_id),
  };
  return activity as EconomicActivity;
}

function rowToOpportunity(row: Record<string, unknown>): EconomicOpportunity {
  return {
    opportunityId: String(row.opportunity_id) as EconomicOpportunity['opportunityId'],
    graphId: String(row.graph_id) as EconomicOpportunity['graphId'],
    nodeId: String(row.node_id) as EconomicOpportunity['nodeId'],
    kind: String(row.kind) as EconomicOpportunity['kind'],
    title: String(row.title),
    relatedNodeIds: JSON.parse(String(row.related_node_ids)) as EconomicOpportunity['relatedNodeIds'],
    ...(row.estimated_impact_canonical
      ? { estimatedImpact: JSON.parse(String(row.estimated_impact_canonical)) }
      : {}),
    status: 'PROPOSAL',
    executable: false,
    confidence: String(row.confidence) as EconomicOpportunity['confidence'],
    provenance: JSON.parse(String(row.provenance_canonical)) as EconomicOpportunity['provenance'],
    createdAt: new Date(String(row.created_at)).toISOString() as EconomicOpportunity['createdAt'],
    survivesRebuild: Boolean(row.survives_rebuild),
  };
}

function rowToSnapshot(row: Record<string, unknown>): StoredSnapshot {
  return {
    snapshotId: String(row.snapshot_id) as StoredSnapshot['snapshotId'],
    graphId: String(row.graph_id) as StoredSnapshot['graphId'],
    generatedAt: new Date(String(row.generated_at)).toISOString() as StoredSnapshot['generatedAt'],
    bodyCanonical: String(row.body_canonical),
  };
}

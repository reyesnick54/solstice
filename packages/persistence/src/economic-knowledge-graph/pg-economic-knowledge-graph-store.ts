import type { Pool } from 'pg';
import { createHash } from 'node:crypto';

import { withClient } from '../postgres/pools.ts';

/** Persistence boundary type — avoids importing packages/economic-asset-registry. */
export type PersistedKnowledgeGraphSnapshot = {
  readonly nodes: readonly Record<string, unknown>[];
  readonly edges: readonly Record<string, unknown>[];
  readonly aliases: readonly Record<string, unknown>[];
  readonly resolutions: readonly Record<string, unknown>[];
  readonly suggestions: readonly Record<string, unknown>[];
  readonly claimLinkages: readonly Record<string, unknown>[];
  readonly snapshotHash: string;
};

export async function persistKnowledgeGraphSnapshot(pool: Pool, snapshot: PersistedKnowledgeGraphSnapshot): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const node of snapshot.nodes) {
        await client.query(
          `INSERT INTO economic_knowledge_graph.node
             (node_id, node_class, domain, canonical_entity_id, label, external_ref, payload_canonical, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (node_id) DO UPDATE SET
             label = EXCLUDED.label,
             payload_canonical = EXCLUDED.payload_canonical`,
          [
            node.nodeId,
            node.nodeClass,
            node.domain,
            node.canonicalEntityId ?? null,
            node.label,
            node.externalRef ?? null,
            JSON.stringify(node.payload ?? {}),
            node.createdAt,
          ],
        );
      }
      for (const edge of snapshot.edges) {
        await client.query(
          `INSERT INTO economic_knowledge_graph.edge
             (edge_id, kind, from_node_id, to_node_id, domain, authorized, provenance_ref, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (edge_id) DO NOTHING`,
          [
            edge.edgeId,
            edge.kind,
            edge.fromNodeId,
            edge.toNodeId,
            edge.domain,
            edge.authorized,
            edge.provenanceRef,
            edge.createdAt,
          ],
        );
      }
      for (const alias of snapshot.aliases) {
        const externalIdentifier = alias.externalIdentifier as { system: string; id: string };
        await client.query(
          `INSERT INTO economic_knowledge_graph.alias
             (alias_id, canonical_entity_id, system, external_id, preserved_original_id, merge_status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (alias_id) DO NOTHING`,
          [
            alias.aliasId,
            alias.canonicalEntityId,
            externalIdentifier.system,
            externalIdentifier.id,
            alias.preservedOriginalId,
            alias.mergeStatus,
            alias.createdAt,
          ],
        );
      }
      for (const resolution of snapshot.resolutions) {
        await client.query(
          `INSERT INTO economic_knowledge_graph.entity_resolution
             (resolution_id, outcome, method, canonical_entity_id, input_identifiers_canonical,
              candidate_entity_ids_canonical, confidence, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (resolution_id) DO NOTHING`,
          [
            resolution.resolutionId,
            resolution.outcome,
            resolution.method,
            resolution.canonicalEntityId ?? null,
            JSON.stringify(resolution.inputIdentifiers ?? []),
            JSON.stringify(resolution.candidateEntityIds ?? []),
            resolution.confidence ?? null,
            resolution.createdAt,
          ],
        );
      }
      for (const suggestion of snapshot.suggestions) {
        const left = suggestion.leftIdentifier as { system: string; id: string };
        const right = suggestion.rightIdentifier as { system: string; id: string };
        await client.query(
          `INSERT INTO economic_knowledge_graph.match_suggestion
             (suggestion_id, left_system, left_id, right_system, right_id, suggested_outcome,
              method, confidence, high_impact, requires_governed_review, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (suggestion_id) DO NOTHING`,
          [
            suggestion.suggestionId,
            left.system,
            left.id,
            right.system,
            right.id,
            suggestion.suggestedOutcome,
            suggestion.method,
            suggestion.confidence,
            suggestion.highImpact,
            suggestion.requiresGovernedReview,
            suggestion.createdAt,
          ],
        );
      }
      for (const linkage of snapshot.claimLinkages) {
        const claimRef = linkage.claimRef as { claimId: string; claimClass: string };
        await client.query(
          `INSERT INTO economic_knowledge_graph.claim_linkage
             (claim_id, claim_class, claim_node_id, canonical_event_node_id,
              observation_node_ids_canonical, evidence_node_ids_canonical, provider_node_ids_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (claim_id, claim_class) DO UPDATE SET
             canonical_event_node_id = EXCLUDED.canonical_event_node_id`,
          [
            claimRef.claimId,
            claimRef.claimClass,
            linkage.claimNodeId,
            linkage.canonicalEventNodeId,
            JSON.stringify(linkage.observationNodeIds ?? []),
            JSON.stringify(linkage.evidenceNodeIds ?? []),
            JSON.stringify(linkage.providerNodeIds ?? []),
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

export async function loadKnowledgeGraphSnapshot(pool: Pool): Promise<PersistedKnowledgeGraphSnapshot> {
  return await withClient(pool, async (client) => {
    const nodes = await client.query('SELECT * FROM economic_knowledge_graph.node ORDER BY node_id');
    const edges = await client.query('SELECT * FROM economic_knowledge_graph.edge ORDER BY edge_id');
    const aliases = await client.query('SELECT * FROM economic_knowledge_graph.alias ORDER BY alias_id');
    const resolutions = await client.query('SELECT * FROM economic_knowledge_graph.entity_resolution ORDER BY resolution_id');
    const suggestions = await client.query('SELECT * FROM economic_knowledge_graph.match_suggestion ORDER BY suggestion_id');
    const linkages = await client.query('SELECT * FROM economic_knowledge_graph.claim_linkage ORDER BY claim_id');

    const parsedNodes = nodes.rows.map((row) =>
      Object.freeze({
        nodeId: row.node_id,
        nodeClass: row.node_class,
        domain: row.domain,
        canonicalEntityId: row.canonical_entity_id,
        label: row.label,
        externalRef: row.external_ref,
        payload: Object.freeze(JSON.parse(row.payload_canonical)),
        createdAt: row.created_at.toISOString(),
        authoritative: false,
        mutatesFinancialState: false,
      }),
    );

    const parsedEdges = edges.rows.map((row) =>
      Object.freeze({
        edgeId: row.edge_id,
        kind: row.kind,
        fromNodeId: row.from_node_id,
        toNodeId: row.to_node_id,
        domain: row.domain,
        authorized: row.authorized,
        createdAt: row.created_at.toISOString(),
        provenanceRef: row.provenance_ref,
      }),
    );

    const parsedAliases = aliases.rows.map((row) =>
      Object.freeze({
        aliasId: row.alias_id,
        canonicalEntityId: row.canonical_entity_id,
        externalIdentifier: Object.freeze({
          system: row.system,
          id: row.external_id,
          authorityClass: 'PROVIDER',
        }),
        preservedOriginalId: row.preserved_original_id,
        createdAt: row.created_at.toISOString(),
        mergeStatus: row.merge_status,
      }),
    );

    const parsedResolutions = resolutions.rows.map((row) =>
      Object.freeze({
        resolutionId: row.resolution_id,
        inputIdentifiers: Object.freeze(JSON.parse(row.input_identifiers_canonical)),
        outcome: row.outcome,
        method: row.method,
        canonicalEntityId: row.canonical_entity_id,
        candidateEntityIds: Object.freeze(JSON.parse(row.candidate_entity_ids_canonical)),
        confidence: row.confidence,
        createdAt: row.created_at.toISOString(),
        autoMerged: false,
      }),
    );

    const parsedSuggestions = suggestions.rows.map((row) =>
      Object.freeze({
        suggestionId: row.suggestion_id,
        leftIdentifier: Object.freeze({
          system: row.left_system,
          id: row.left_id,
          authorityClass: 'PROVIDER',
        }),
        rightIdentifier: Object.freeze({
          system: row.right_system,
          id: row.right_id,
          authorityClass: 'PROVIDER',
        }),
        suggestedOutcome: row.suggested_outcome,
        method: 'AI_ASSISTED',
        confidence: row.confidence,
        highImpact: row.high_impact,
        requiresGovernedReview: row.requires_governed_review,
        createdAt: row.created_at.toISOString(),
        autoApplied: false,
      }),
    );

    const parsedLinkages = linkages.rows.map((row) =>
      Object.freeze({
        claimRef: Object.freeze({
          claimId: row.claim_id,
          claimClass: row.claim_class,
          fingerprint: null,
        }),
        claimNodeId: row.claim_node_id,
        canonicalEventNodeId: row.canonical_event_node_id,
        observationNodeIds: Object.freeze(JSON.parse(row.observation_node_ids_canonical)),
        evidenceNodeIds: Object.freeze(JSON.parse(row.evidence_node_ids_canonical)),
        providerNodeIds: Object.freeze(JSON.parse(row.provider_node_ids_canonical)),
      }),
    );

    const material = [
      ...parsedNodes.map((n) => String(n.nodeId)),
      ...parsedEdges.map((e) => String(e.edgeId)),
      ...parsedAliases.map((a) => String(a.aliasId)),
    ].join('|');
    const snapshotHash = createHash('sha256').update(material).digest('hex');
    return Object.freeze({
      nodes: Object.freeze(parsedNodes),
      edges: Object.freeze(parsedEdges),
      aliases: Object.freeze(parsedAliases),
      resolutions: Object.freeze(parsedResolutions),
      suggestions: Object.freeze(parsedSuggestions),
      claimLinkages: Object.freeze(parsedLinkages),
      snapshotHash,
    });
  });
}

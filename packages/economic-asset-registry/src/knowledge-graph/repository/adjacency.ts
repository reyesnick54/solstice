import { createHash } from 'node:crypto';

import type { KnowledgeGraphSnapshot } from '../types.ts';
import type { KnowledgeEdge } from '../types.ts';
import type { KnowledgeNode } from '../types.ts';
import type { EntityAlias } from '../types.ts';
import type { EntityResolutionRecord } from '../types.ts';
import type { MatchSuggestion } from '../types.ts';
import type { ClaimLinkage } from '../types.ts';
import type { KnowledgeNodeId } from '../ids.ts';
import type { KnowledgeEdgeId } from '../ids.ts';
import type { CanonicalEntityId } from '../ids.ts';

export type GraphRepositoryPort = {
  upsertNode(node: KnowledgeNode): void;
  upsertEdge(edge: KnowledgeEdge): void;
  getNode(nodeId: KnowledgeNodeId): KnowledgeNode | null;
  getEdge(edgeId: KnowledgeEdgeId): KnowledgeEdge | null;
  nodes(): readonly KnowledgeNode[];
  edges(): readonly KnowledgeEdge[];
  neighbors(fromNodeId: KnowledgeNodeId, kind?: string): readonly KnowledgeNode[];
  reverseNeighbors(toNodeId: KnowledgeNodeId, kind?: string): readonly KnowledgeNode[];
  edgesFrom(fromNodeId: KnowledgeNodeId, kind?: string): readonly KnowledgeEdge[];
  edgesTo(toNodeId: KnowledgeNodeId, kind?: string): readonly KnowledgeEdge[];
  snapshot(): KnowledgeGraphSnapshot;
  restore(snapshot: KnowledgeGraphSnapshot): void;
};

export type AdjacencyGraphState = {
  readonly nodes: readonly KnowledgeNode[];
  readonly edges: readonly KnowledgeEdge[];
  readonly aliases: readonly EntityAlias[];
  readonly resolutions: readonly EntityResolutionRecord[];
  readonly suggestions: readonly MatchSuggestion[];
  readonly claimLinkages: readonly ClaimLinkage[];
};

export class AdjacencyTableGraphRepository implements GraphRepositoryPort {
  readonly #nodes = new Map<KnowledgeNodeId, KnowledgeNode>();
  readonly #edges = new Map<KnowledgeEdgeId, KnowledgeEdge>();
  readonly #aliases: EntityAlias[] = [];
  readonly #resolutions: EntityResolutionRecord[] = [];
  readonly #suggestions: MatchSuggestion[] = [];
  readonly #claimLinkages: ClaimLinkage[] = [];
  readonly #outbound = new Map<KnowledgeNodeId, KnowledgeEdge[]>();
  readonly #inbound = new Map<KnowledgeNodeId, KnowledgeEdge[]>();
  readonly #nodesByCanonical = new Map<CanonicalEntityId, KnowledgeNodeId[]>();

  upsertNode(node: KnowledgeNode): void {
    this.#nodes.set(node.nodeId, node);
    if (node.canonicalEntityId) {
      const list = this.#nodesByCanonical.get(node.canonicalEntityId) ?? [];
      if (!list.includes(node.nodeId)) {
        list.push(node.nodeId);
        this.#nodesByCanonical.set(node.canonicalEntityId, list);
      }
    }
  }

  upsertEdge(edge: KnowledgeEdge): void {
    this.#edges.set(edge.edgeId, edge);
    const out = this.#outbound.get(edge.fromNodeId) ?? [];
    out.push(edge);
    this.#outbound.set(edge.fromNodeId, out);
    const inb = this.#inbound.get(edge.toNodeId) ?? [];
    inb.push(edge);
    this.#inbound.set(edge.toNodeId, inb);
  }

  getNode(nodeId: KnowledgeNodeId): KnowledgeNode | null {
    return this.#nodes.get(nodeId) ?? null;
  }

  getEdge(edgeId: KnowledgeEdgeId): KnowledgeEdge | null {
    return this.#edges.get(edgeId) ?? null;
  }

  nodes(): readonly KnowledgeNode[] {
    return Object.freeze([...this.#nodes.values()].sort((a, b) => a.nodeId.localeCompare(b.nodeId)));
  }

  edges(): readonly KnowledgeEdge[] {
    return Object.freeze([...this.#edges.values()].sort((a, b) => a.edgeId.localeCompare(b.edgeId)));
  }

  neighbors(fromNodeId: KnowledgeNodeId, kind?: string): readonly KnowledgeNode[] {
    const edges = this.edgesFrom(fromNodeId, kind);
    return Object.freeze(
      edges
        .map((edge) => this.getNode(edge.toNodeId))
        .filter((node): node is KnowledgeNode => node !== null)
        .sort((a, b) => a.nodeId.localeCompare(b.nodeId)),
    );
  }

  reverseNeighbors(toNodeId: KnowledgeNodeId, kind?: string): readonly KnowledgeNode[] {
    const edges = this.edgesTo(toNodeId, kind);
    return Object.freeze(
      edges
        .map((edge) => this.getNode(edge.fromNodeId))
        .filter((node): node is KnowledgeNode => node !== null)
        .sort((a, b) => a.nodeId.localeCompare(b.nodeId)),
    );
  }

  edgesFrom(fromNodeId: KnowledgeNodeId, kind?: string): readonly KnowledgeEdge[] {
    const edges = this.#outbound.get(fromNodeId) ?? [];
    const filtered = kind ? edges.filter((edge) => edge.kind === kind) : edges;
    return Object.freeze([...filtered].sort((a, b) => a.edgeId.localeCompare(b.edgeId)));
  }

  edgesTo(toNodeId: KnowledgeNodeId, kind?: string): readonly KnowledgeEdge[] {
    const edges = this.#inbound.get(toNodeId) ?? [];
    const filtered = kind ? edges.filter((edge) => edge.kind === kind) : edges;
    return Object.freeze([...filtered].sort((a, b) => a.edgeId.localeCompare(b.edgeId)));
  }

  registerAlias(alias: EntityAlias): void {
    this.#aliases.push(alias);
  }

  registerResolution(record: EntityResolutionRecord): void {
    this.#resolutions.push(record);
  }

  registerSuggestion(suggestion: MatchSuggestion): void {
    this.#suggestions.push(suggestion);
  }

  registerClaimLinkage(linkage: ClaimLinkage): void {
    this.#claimLinkages.push(linkage);
  }

  snapshot(): KnowledgeGraphSnapshot {
    const nodes = this.nodes();
    const edges = this.edges();
    const material = [
      ...nodes.map((n) => n.nodeId),
      ...edges.map((e) => e.edgeId),
      ...this.#aliases.map((a) => a.aliasId),
    ].join('|');
    const snapshotHash = createHash('sha256').update(material).digest('hex');
    return Object.freeze({
      nodes,
      edges,
      aliases: Object.freeze([...this.#aliases]),
      resolutions: Object.freeze([...this.#resolutions]),
      suggestions: Object.freeze([...this.#suggestions]),
      claimLinkages: Object.freeze([...this.#claimLinkages]),
      snapshotHash,
    });
  }

  restore(snapshot: KnowledgeGraphSnapshot): void {
    this.#nodes.clear();
    this.#edges.clear();
    this.#outbound.clear();
    this.#inbound.clear();
    this.#nodesByCanonical.clear();
    this.#aliases.length = 0;
    this.#resolutions.length = 0;
    this.#suggestions.length = 0;
    this.#claimLinkages.length = 0;
    for (const node of snapshot.nodes) {
      this.upsertNode(node);
    }
    for (const edge of snapshot.edges) {
      this.upsertEdge(edge);
    }
    for (const alias of snapshot.aliases) {
      this.#aliases.push(alias);
    }
    for (const resolution of snapshot.resolutions) {
      this.#resolutions.push(resolution);
    }
    for (const suggestion of snapshot.suggestions) {
      this.#suggestions.push(suggestion);
    }
    for (const linkage of snapshot.claimLinkages) {
      this.#claimLinkages.push(linkage);
    }
  }
}

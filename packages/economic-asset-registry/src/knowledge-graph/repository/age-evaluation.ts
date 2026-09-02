/**
 * Apache AGE evaluation for SunRey Economic Knowledge Graph storage.
 *
 * Decision: defer AGE as the active backend; use adjacency-table PostgreSQL storage
 * behind GraphRepositoryPort until the extension is available in CI and ops cells.
 *
 * Rationale for eventual AGE adoption:
 * - SunRey already standardizes on PostgreSQL (customer, ledger, evidence DBs).
 * - Relationship-heavy read paths (lineage, multi-hop provenance) benefit from Cypher.
 * - Avoids introducing a standalone graph database with separate ops and backup posture.
 *
 * Blockers today:
 * - Apache AGE extension is not installed in repository CI PostgreSQL images.
 * - PEG already occupies `economic_graph` schema name; knowledge graph uses `economic_knowledge_graph`.
 * - Merge-integrity and migration gates require explicit extension versioning before activation.
 *
 * Integration boundary:
 * - All writes flow through GraphRepositoryPort.
 * - AgeGraphRepositoryAdapter (stub) documents the future Cypher mapping.
 * - AdjacencyTableGraphRepository is the default durable implementation.
 */

export const AGE_EVALUATION = Object.freeze({
  preferredFutureTechnology: 'apache-age',
  activeBackend: 'postgresql-adjacency',
  ageExtensionRequired: true,
  ageAvailableInCi: false,
  standaloneGraphDatabase: false,
  repositoryPort: 'GraphRepositoryPort',
});

export type AgeCompatibilityReport = {
  readonly extensionName: 'age';
  readonly graphName: string;
  readonly cypherSupported: boolean;
  readonly reason: string;
};

export function evaluateApacheAgeAvailability(extensionPresent: boolean): AgeCompatibilityReport {
  if (!extensionPresent) {
    return Object.freeze({
      extensionName: 'age',
      graphName: 'economic_knowledge_graph',
      cypherSupported: false,
      reason: 'Apache AGE extension not present; adjacency repository remains authoritative',
    });
  }
  return Object.freeze({
    extensionName: 'age',
    graphName: 'economic_knowledge_graph',
    cypherSupported: true,
    reason: 'AGE extension detected; Cypher adapter may be wired without changing service API',
  });
}

/** Stub adapter documenting future AGE integration — not active in simulation. */
export class AgeGraphRepositoryAdapter {
  readonly #extensionPresent: boolean;

  constructor(extensionPresent = false) {
    this.#extensionPresent = extensionPresent;
  }

  compatibility(): AgeCompatibilityReport {
    return evaluateApacheAgeAvailability(this.#extensionPresent);
  }

  isActive(): false {
    return false;
  }
}

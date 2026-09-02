/**
 * Wave 4 Task 3 — FederationAdapter boundary and Trino evaluation.
 *
 * Trino is not operationally justified in the current simulation posture.
 * This adapter boundary is designed for future Trino implementation without
 * making any federation engine a monetary authority.
 */

import type {
  FederatedMetricResult,
  FederatedQueryRequest,
  FederationRejection,
  FederationSourceConstraint,
} from './types.ts';
import { federationRejection } from './types.ts';

export const TRINO_EVALUATION_VERSION = 'sunrey.federation.trino-evaluation.v1' as const;

export const TRINO_OPERATIONALLY_JUSTIFIED = false as const;
export const TRINO_INTEGRATION_ACTIVE = false as const;

export type TrinoEvaluationDecision = Readonly<{
  readonly engine: 'IN_MEMORY_FEDERATION_ADAPTER' | 'TRINO_CANDIDATE';
  readonly operationallyJustified: false;
  readonly rationale: string;
  readonly prerequisites: readonly string[];
  readonly blockedUntil: readonly string[];
}>;

export const TRINO_EVALUATION: TrinoEvaluationDecision = Object.freeze({
  engine: 'IN_MEMORY_FEDERATION_ADAPTER',
  operationallyJustified: false,
  rationale:
    'SunRey simulation runs fixture-only provider transports with purpose-preserving correlation. ' +
    'Trino would add operational complexity (catalog governance, credential isolation, query audit wiring) ' +
    'before durable fabric journals and Wave 3 claim commitment roots exist. FederationAdapter preserves ' +
    'the integration seam without elevating a query engine to monetary authority.',
  prerequisites: Object.freeze([
    'Durable fabric observation journals in PostgreSQL',
    'Wave 3 Evidence/Rights/Policy commitment model',
    'Production-candidate connector credential plane (Chunk 149)',
    'Counsel-reviewed enterprise data license registry',
  ]),
  blockedUntil: Object.freeze([
    'LIVE_* flags remain false',
    'No arbitrary SQL federation without purpose context',
    'Trino catalog must not write ledger journals or mint',
  ]),
});

export type FederationSourceQueryInput = Readonly<{
  readonly request: FederatedQueryRequest;
  readonly constraint: FederationSourceConstraint;
  readonly nowUnix: bigint;
}>;

export type FederationSourceQueryOutcome = Readonly<{
  readonly ok: true;
  readonly metrics: readonly FederatedMetricResult[];
} | {
  readonly ok: false;
  readonly rejection: FederationRejection;
}>;

export interface FederationAdapter {
  readonly adapterId: string;
  readonly engineKind: TrinoEvaluationDecision['engine'];
  querySource(input: FederationSourceQueryInput): Promise<FederationSourceQueryOutcome>;
}

export type InMemorySourceHandler = (
  input: FederationSourceQueryInput,
) => FederationSourceQueryOutcome | Promise<FederationSourceQueryOutcome>;

export class InMemoryFederationAdapter implements FederationAdapter {
  readonly adapterId = 'sunrey.federation.in-memory.v1';
  readonly engineKind = 'IN_MEMORY_FEDERATION_ADAPTER' as const;

  private readonly handlers = new Map<string, InMemorySourceHandler>();

  register(sourceId: string, handler: InMemorySourceHandler): void {
    this.handlers.set(sourceId, handler);
  }

  async querySource(input: FederationSourceQueryInput): Promise<FederationSourceQueryOutcome> {
    const handler = this.handlers.get(input.constraint.sourceId);
    if (!handler) {
      return {
        ok: false,
        rejection: federationRejection(
          'SOURCE_UNAVAILABLE',
          `no federation handler registered for ${input.constraint.sourceId}`,
          input.constraint.sourceId,
        ),
      };
    }
    return handler(input);
  }
}

/**
 * Future Trino adapter placeholder. Not active. Does not connect to networks.
 */
export class TrinoFederationAdapterPlaceholder implements FederationAdapter {
  readonly adapterId = 'sunrey.federation.trino.placeholder.v1';
  readonly engineKind = 'TRINO_CANDIDATE' as const;

  async querySource(input: FederationSourceQueryInput): Promise<FederationSourceQueryOutcome> {
    return {
      ok: false,
      rejection: federationRejection(
        'SOURCE_UNAVAILABLE',
        `Trino federation is not operationally active (${TRINO_EVALUATION.rationale})`,
        input.constraint.sourceId,
      ),
    };
  }
}

export function createDefaultFederationAdapter(): InMemoryFederationAdapter {
  return new InMemoryFederationAdapter();
}

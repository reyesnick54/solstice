/**
 * MainnetReadinessRegistry — assembled evidence, capabilities, and candidate.
 */

import { defaultActivationMatrix } from './capabilities.ts';
import { defaultDimensionCatalog } from './dimensions.ts';
import { evaluateReadiness, type EvaluatorPolicy, DEFAULT_PRODUCTION_POLICY } from './evaluator.ts';
import { buildGenesisCandidate, type GenesisCandidateBundle } from './genesis-candidate.ts';
import type {
  MainnetAuthorizationRecord,
  MainnetReadinessRegistry,
  ProductionCapabilityActivation,
  ReadinessEvidenceRecord,
} from './types.ts';

export type { MainnetReadinessRegistry };

export function assembleReadinessRegistry(input?: {
  readonly records?: readonly ReadinessEvidenceRecord[];
  readonly authorizations?: readonly MainnetAuthorizationRecord[];
  readonly capabilities?: readonly ProductionCapabilityActivation[];
  readonly genesis?: GenesisCandidateBundle;
  readonly policy?: EvaluatorPolicy;
}): MainnetReadinessRegistry {
  const records = input?.records ?? defaultDimensionCatalog();
  const authorizations = input?.authorizations ?? [];
  const capabilities = input?.capabilities ?? defaultActivationMatrix();
  const genesis = input?.genesis ?? buildGenesisCandidate();
  const policy = input?.policy ?? DEFAULT_PRODUCTION_POLICY;
  return Object.freeze({
    schemaVersion: 1,
    records,
    authorizations,
    capabilities,
    candidate: genesis.candidate,
    status: evaluateReadiness(records, authorizations, policy),
    genesisHash: genesis.genesisHash,
  });
}

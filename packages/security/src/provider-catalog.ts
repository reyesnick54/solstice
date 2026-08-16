import type { AlgorithmId } from './algorithm-ids.ts';
import type { KemProvider, ProviderCatalog, SignatureProvider } from './crypto-providers.ts';
import { createEd25519SignatureProvider } from './ed25519-provider.ts';
import { securityErr, securityOk, type SecurityResult } from './errors.ts';
import {
  createSimulationPqKemProvider,
  createSimulationPqSignatureProvider,
} from './pq-simulation-provider.ts';

/**
 * Canonical provider catalog. Unknown algorithm IDs fail closed.
 * No provider silently falls back to another algorithm.
 */
export class SecurityProviderCatalog implements ProviderCatalog {
  readonly #signatures = new Map<AlgorithmId, SignatureProvider>();
  readonly #kems = new Map<AlgorithmId, KemProvider>();

  constructor() {
    const ed25519 = createEd25519SignatureProvider();
    this.#signatures.set(ed25519.algorithmId, ed25519);
    const simMlDsa = createSimulationPqSignatureProvider('SIMULATION-ML-DSA-65');
    const simSlh = createSimulationPqSignatureProvider('SIMULATION-SLH-DSA-SHA2-128S');
    this.#signatures.set(simMlDsa.algorithmId, simMlDsa);
    this.#signatures.set(simSlh.algorithmId, simSlh);
    const simKem = createSimulationPqKemProvider();
    this.#kems.set(simKem.algorithmId, simKem);
    Object.freeze(this);
  }

  signature(algorithmId: AlgorithmId): SecurityResult<SignatureProvider> {
    const provider = this.#signatures.get(algorithmId);
    if (!provider) {
      return securityErr(
        'UNKNOWN_ALGORITHM',
        `no signature provider for ${algorithmId}; no silent fallback`,
      );
    }
    return securityOk(provider);
  }

  kem(algorithmId: AlgorithmId): SecurityResult<KemProvider> {
    const provider = this.#kems.get(algorithmId);
    if (!provider) {
      return securityErr(
        'UNKNOWN_ALGORITHM',
        `no KEM provider for ${algorithmId}; no silent fallback`,
      );
    }
    return securityOk(provider);
  }
}

export function createSecurityProviderCatalog(): SecurityProviderCatalog {
  return new SecurityProviderCatalog();
}

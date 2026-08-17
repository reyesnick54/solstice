import type { AlgorithmId } from './algorithm-ids.ts';
import type { KemProvider, ProviderCatalog, SignatureProvider } from './crypto-providers.ts';
import { createEd25519SignatureProvider } from './ed25519-provider.ts';
import { securityErr, securityOk, type SecurityResult } from './errors.ts';
import {
  createSimulationPqKemProvider,
  createSimulationPqSignatureProvider,
} from './pq-simulation-provider.ts';
import {
  createMlDsa65Provider,
  createMlKem768Provider,
  createSlhDsaSha2128sProvider,
  type StandardizedMlKemProvider,
  type StandardizedPqSignatureProvider,
} from './pq-provider.ts';

export type SecurityProviderCatalogOptions = {
  readonly pqEnabled?: boolean;
};

/**
 * Canonical provider catalog. Unknown algorithm IDs fail closed.
 * No provider silently falls back to another algorithm.
 * Real PQ may be disabled; callers then fail closed instead of
 * silently using classical-only signing.
 */
export class SecurityProviderCatalog implements ProviderCatalog {
  readonly #signatures = new Map<AlgorithmId, SignatureProvider>();
  readonly #kems = new Map<AlgorithmId, KemProvider>();
  readonly #mlDsa: StandardizedPqSignatureProvider;
  readonly #slh: StandardizedPqSignatureProvider;
  readonly #mlKem: StandardizedMlKemProvider;
  readonly pqEnabled: boolean;

  constructor(options: SecurityProviderCatalogOptions = {}) {
    this.pqEnabled = options.pqEnabled !== false;
    const ed25519 = createEd25519SignatureProvider();
    this.#signatures.set(ed25519.algorithmId, ed25519);
    const simMlDsa = createSimulationPqSignatureProvider('SIMULATION-ML-DSA-65');
    const simSlh = createSimulationPqSignatureProvider('SIMULATION-SLH-DSA-SHA2-128S');
    this.#signatures.set(simMlDsa.algorithmId, simMlDsa);
    this.#signatures.set(simSlh.algorithmId, simSlh);
    const simKem = createSimulationPqKemProvider();
    this.#kems.set(simKem.algorithmId, simKem);

    this.#mlDsa = createMlDsa65Provider(this.pqEnabled);
    this.#slh = createSlhDsaSha2128sProvider(this.pqEnabled);
    this.#mlKem = createMlKem768Provider(this.pqEnabled);
    this.#signatures.set('ML_DSA_65_V1', this.#mlDsa);
    this.#signatures.set('ML-DSA-65', this.#mlDsa);
    this.#signatures.set('SLH_DSA_SHA2_128S_V1', this.#slh);
    this.#signatures.set('SLH-DSA-SHA2-128S', this.#slh);
    this.#kems.set('ML_KEM_768_V1', this.#mlKem);
    this.#kems.set('ML-KEM-768', this.#mlKem);
    Object.freeze(this);
  }

  markPqUnavailable(): void {
    this.#mlDsa.markUnavailable();
    this.#slh.markUnavailable();
    this.#mlKem.markUnavailable();
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

export function createSecurityProviderCatalog(
  options: SecurityProviderCatalogOptions = {},
): SecurityProviderCatalog {
  return new SecurityProviderCatalog(options);
}

export function createFailClosedPqCatalog(): SecurityProviderCatalog {
  return new SecurityProviderCatalog({ pqEnabled: false });
}

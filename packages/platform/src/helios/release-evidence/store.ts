/**
 * HELIOS H36 — in-memory release evidence store.
 */

import type {
  HELIOSReleaseEvidencePackage,
  LivePilotAuthorization,
  LivePilotGate,
  ReleaseEvidenceStoreSnapshot,
} from './types.ts';

export class InMemoryReleaseEvidenceStore {
  readonly #packages = new Map<string, HELIOSReleaseEvidencePackage>();
  readonly #gates = new Map<string, LivePilotGate>();
  readonly #authorizations = new Map<string, LivePilotAuthorization>();

  savePackage(pkg: HELIOSReleaseEvidencePackage): void {
    this.#packages.set(pkg.identity.releaseId, pkg);
  }

  getPackage(releaseId: string): HELIOSReleaseEvidencePackage | null {
    return this.#packages.get(releaseId) ?? null;
  }

  saveGate(gate: LivePilotGate): void {
    this.#gates.set(gate.scope.scopeId, gate);
  }

  getGate(scopeId: string): LivePilotGate | null {
    return this.#gates.get(scopeId) ?? null;
  }

  saveAuthorization(authorization: LivePilotAuthorization): void {
    this.#authorizations.set(authorization.authorizationId, authorization);
  }

  getAuthorization(authorizationId: string): LivePilotAuthorization | null {
    return this.#authorizations.get(authorizationId) ?? null;
  }

  snapshot(): ReleaseEvidenceStoreSnapshot {
    return Object.freeze({
      packages: Object.freeze([...this.#packages.values()]),
      gates: Object.freeze([...this.#gates.values()]),
      authorizations: Object.freeze([...this.#authorizations.values()]),
    });
  }
}

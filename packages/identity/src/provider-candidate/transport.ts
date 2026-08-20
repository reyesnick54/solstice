import type { IdentityTransportScenario, RawIdentityVendorResponse } from './types.ts';

/**
 * Injected fake transport. Never opens a socket, never calls fetch.
 */
export type IdentityCandidateTransport = {
  readonly kind: 'FAKE';
  readonly realNetwork: false;
  exchange(input: {
    readonly capability: string;
    readonly subjectRef: string;
    readonly scenario?: IdentityTransportScenario;
  }): RawIdentityVendorResponse;
};

export class FakeIdentityTransport implements IdentityCandidateTransport {
  readonly kind = 'FAKE' as const;
  readonly realNetwork = false as const;
  readonly #scenarios = new Map<string, IdentityTransportScenario>();

  setScenario(subjectRef: string, scenario: IdentityTransportScenario): void {
    this.#scenarios.set(subjectRef, scenario);
  }

  exchange(input: {
    readonly capability: string;
    readonly subjectRef: string;
    readonly scenario?: IdentityTransportScenario;
  }): RawIdentityVendorResponse {
    const scenario =
      input.scenario ??
      this.#scenarios.get(input.subjectRef) ??
      inferScenario(input.subjectRef);
    return Object.freeze({
      scenario,
      vendorOutcome: scenario === 'verified' || scenario === 'ok' ? 'VERIFIED' : scenario.toUpperCase(),
      vendorReason: `FIXTURE_${scenario.toUpperCase()}`,
      vendorScore: scenario === 'ok' || scenario === 'verified' ? 0.91 : 0,
    });
  }
}

function inferScenario(subjectRef: string): IdentityTransportScenario {
  const ref = subjectRef.toLowerCase();
  if (ref.includes('timeout')) return 'timeout';
  if (ref.includes('schema')) return 'schema_drift';
  if (ref.includes('unavailable')) return 'unavailable';
  if (ref.includes('auth')) return 'auth_failure';
  if (ref.includes('fail')) return 'schema_drift';
  return 'ok';
}

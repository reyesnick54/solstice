/**
 * Phase D productized external oracle/data interface.
 *
 * Extends the Chunk 68/128/150 oracle owner. An observation is not a
 * mint. Unverified external data cannot invent productive value or
 * alter economic supply.
 */

import type { FactType, UnitCode } from '../types.ts';

export const ORACLE_PROVIDER_CONTRACT_VERSION = 'sunrey-oracle-provider-contract/1' as const;
export const ORACLE_OBSERVATION_CANNOT_MINT = true as const;

export const ORACLE_OBSERVATION_DOMAINS = [
  'energy',
  'compute',
  'manufacturing',
  'agriculture',
  'real_estate',
  'logistics',
] as const;
export type OracleObservationDomain = (typeof ORACLE_OBSERVATION_DOMAINS)[number];

export const ORACLE_QUALITY = ['FRESH', 'EXPIRED', 'INVALID_SIGNATURE', 'CONFLICTING', 'UNAVAILABLE'] as const;
export type OracleObservationQuality = (typeof ORACLE_QUALITY)[number];

export type OracleProvenance = {
  readonly source: string;
  readonly timeUtc: string;
  readonly method: string;
  readonly license: string;
  readonly verification: 'VERIFIED' | 'UNVERIFIED' | 'INVALID';
  readonly quality: OracleObservationQuality;
  readonly evidenceRef: string;
};

export type ExternalOracleObservation = {
  readonly observationId: string;
  readonly dataType: FactType;
  readonly domain: OracleObservationDomain;
  readonly quantity: bigint;
  readonly unit: UnitCode;
  readonly timestampUtc: string;
  readonly source: string;
  readonly license: string;
  readonly signatureValid: boolean;
  readonly quality: OracleObservationQuality;
  readonly confidenceBps: bigint;
  readonly expiresAtUtc: string;
  readonly freshnessMs: bigint;
  readonly provenance: OracleProvenance;
  readonly mintsMoonRey: false;
  readonly altersEconomicSupply: false;
  readonly inventsProductiveValue: false;
};

export type OracleProviderResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: string; readonly message: string };

export type ExternalOracleProvider = {
  readonly providerId: string;
  readonly productionAuthorized: false;
  readonly liveProviderConnected: false;
  observe(domain: OracleObservationDomain, nowUtc: string): OracleProviderResult<ExternalOracleObservation>;
};

export type OracleSandboxScenario =
  | 'normal'
  | 'expired'
  | 'invalid_signature'
  | 'unavailable'
  | 'conflicting';

const DOMAIN_FACT: Record<OracleObservationDomain, { readonly fact: FactType; readonly unit: UnitCode }> = {
  energy: { fact: 'ENERGY_PRODUCTION', unit: 'MWh' },
  compute: { fact: 'COMPUTE_USAGE', unit: 'compute_s' },
  manufacturing: { fact: 'MANUFACTURING_OUTPUT', unit: 'units_produced' },
  agriculture: { fact: 'AGRICULTURAL_OUTPUT', unit: 'kg' },
  real_estate: { fact: 'REAL_ESTATE_USAGE', unit: 'm2_hour' },
  logistics: { fact: 'DELIVERY_COMPLETION', unit: 'tonne_km' },
};

export class DeterministicOracleAdapter implements ExternalOracleProvider {
  readonly productionAuthorized = false as const;
  readonly liveProviderConnected = false as const;
  #scenario: OracleSandboxScenario = 'normal';

  readonly providerId: string;
  readonly quantity: bigint;

  constructor(providerId: string, quantity: bigint) {
    this.providerId = providerId;
    this.quantity = quantity;
  }

  setScenario(scenario: OracleSandboxScenario): void {
    this.#scenario = scenario;
  }

  observe(domain: OracleObservationDomain, nowUtc: string): OracleProviderResult<ExternalOracleObservation> {
    if (this.#scenario === 'unavailable') {
      return { ok: false, code: 'ORACLE_UNAVAILABLE', message: 'oracle provider unavailable' };
    }
    const spec = DOMAIN_FACT[domain];
    const expired = this.#scenario === 'expired';
    const invalid = this.#scenario === 'invalid_signature';
    const quality: OracleObservationQuality =
      this.#scenario === 'conflicting'
        ? 'CONFLICTING'
        : expired
          ? 'EXPIRED'
          : invalid
            ? 'INVALID_SIGNATURE'
            : 'FRESH';
    const verification = invalid ? 'INVALID' : expired ? 'UNVERIFIED' : 'VERIFIED';
    if (invalid) {
      return { ok: false, code: 'ORACLE_INVALID_SIGNATURE', message: 'oracle signature/verification failed' };
    }
    const observation: ExternalOracleObservation = Object.freeze({
      observationId: `${this.providerId}:${domain}`,
      dataType: spec.fact,
      domain,
      quantity: this.quantity,
      unit: spec.unit,
      timestampUtc: expired ? '2026-01-01T00:00:00.000Z' : nowUtc,
      source: this.providerId,
      license: 'sandbox-fixture-license',
      signatureValid: !invalid,
      quality,
      confidenceBps: quality === 'FRESH' ? 9_000n : 0n,
      expiresAtUtc: expired ? '2026-01-01T01:00:00.000Z' : '2026-08-21T17:00:00.000Z',
      freshnessMs: expired ? 20_000_000n : 1n,
      provenance: Object.freeze({
        source: this.providerId,
        timeUtc: expired ? '2026-01-01T00:00:00.000Z' : nowUtc,
        method: 'SANDBOX_FIXTURE',
        license: 'sandbox-fixture-license',
        verification,
        quality,
        evidenceRef: `oracle-ev:${this.providerId}:${domain}`,
      }),
      mintsMoonRey: false,
      altersEconomicSupply: false,
      inventsProductiveValue: false,
    });
    if (expired) {
      return { ok: false, code: 'ORACLE_EXPIRED', message: 'oracle observation expired' };
    }
    return { ok: true, value: observation };
  }
}

export function createOracleProviderA(): DeterministicOracleAdapter {
  return new DeterministicOracleAdapter('fixture-oracle-a', 12n);
}

export function createOracleProviderB(): DeterministicOracleAdapter {
  return new DeterministicOracleAdapter('fixture-oracle-b', 13n);
}

export function observationCannotMint(observation: ExternalOracleObservation): boolean {
  return (
    observation.mintsMoonRey === false &&
    observation.altersEconomicSupply === false &&
    observation.inventsProductiveValue === false
  );
}

export function rejectUnverifiedProductiveValue(observation: ExternalOracleObservation): boolean {
  return observation.provenance.verification !== 'VERIFIED';
}

export function runOracleContractSuite(
  provider: DeterministicOracleAdapter = createOracleProviderA(),
): {
  readonly outcome: 'CONTRACT_TEST_PASS' | 'CONTRACT_TEST_FAIL';
  readonly cases: readonly string[];
  readonly externalCertification: 'EXTERNAL_CERTIFICATION_REQUIRED';
} {
  const now = '2026-08-21T16:00:00.000Z';
  provider.setScenario('normal');
  const energy = provider.observe('energy', now);
  const compute = provider.observe('compute', now);
  provider.setScenario('expired');
  const expired = provider.observe('energy', now);
  provider.setScenario('invalid_signature');
  const invalid = provider.observe('energy', now);
  provider.setScenario('unavailable');
  const down = provider.observe('energy', now);
  const passed =
    energy.ok &&
    observationCannotMint(energy.value) &&
    energy.value.provenance.verification === 'VERIFIED' &&
    compute.ok &&
    !expired.ok &&
    expired.code === 'ORACLE_EXPIRED' &&
    !invalid.ok &&
    !down.ok;
  return Object.freeze({
    outcome: passed ? 'CONTRACT_TEST_PASS' : 'CONTRACT_TEST_FAIL',
    cases: Object.freeze(['energy', 'compute', 'expired', 'invalid_signature', 'unavailable', 'no_mint']),
    externalCertification: 'EXTERNAL_CERTIFICATION_REQUIRED',
  });
}

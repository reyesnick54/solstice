import { ALGORITHM_IDS, isAlgorithmId, type AlgorithmId } from './algorithm-ids.ts';
import { securityErr, securityOk, type SecurityResult } from './errors.ts';
import { isKeyPurpose, type KeyPurpose } from './purposes.ts';

export const SUITE_LIFECYCLE_STATES = [
  'DRAFT',
  'TEST_ONLY',
  'TESTNET_APPROVED',
  'APPROVED_FOR_SIMULATION',
  'ACTIVATION_SCHEDULED',
  'ACTIVE',
  'DEPRECATED',
  'VERIFY_ONLY',
  'RETIRED',
  'BLOCKED',
] as const;

export type SuiteLifecycleState = (typeof SUITE_LIFECYCLE_STATES)[number];

export const CRYPTO_ENVIRONMENTS = ['simulation', 'test', 'production'] as const;
export type CryptoEnvironment = (typeof CRYPTO_ENVIRONMENTS)[number];

export type CryptoSuiteId = string & { readonly __brand: 'CryptoSuiteId' };

export function cryptoSuiteId(value: string): CryptoSuiteId {
  if (value.length === 0) {
    throw new TypeError('CryptoSuiteId must be non-empty');
  }
  return value as CryptoSuiteId;
}

export function isSuiteLifecycleState(value: unknown): value is SuiteLifecycleState {
  return typeof value === 'string' && (SUITE_LIFECYCLE_STATES as readonly string[]).includes(value);
}

export type VerificationGracePolicy = {
  readonly allowHistoricalVerify: boolean;
  readonly rejectNewSignatures: boolean;
  readonly graceEpoch: number | null;
  readonly graceHeight: number | null;
};

export type CryptoSuite = {
  readonly suiteId: CryptoSuiteId;
  readonly version: number;
  readonly signatureAlgorithm: AlgorithmId | null;
  readonly kemAlgorithm: AlgorithmId | null;
  readonly hashAlgorithm: AlgorithmId;
  readonly symmetricAlgorithm: AlgorithmId | null;
  readonly kdfAlgorithm: AlgorithmId | null;
  readonly parameterProfile: string;
  readonly purposes: readonly KeyPurpose[];
  readonly lifecycleState: SuiteLifecycleState;
  readonly permittedEnvironments: readonly CryptoEnvironment[];
  readonly introducedProtocolVersion: string;
  readonly activationEpoch: number | null;
  readonly activationHeight: number | null;
  readonly deprecationEpoch: number | null;
  readonly deprecationHeight: number | null;
  readonly verificationGracePolicy: VerificationGracePolicy;
  readonly providerId: string;
};

export function freezeCryptoSuite(suite: CryptoSuite): CryptoSuite {
  return Object.freeze({
    ...suite,
    purposes: Object.freeze([...suite.purposes]),
    permittedEnvironments: Object.freeze([...suite.permittedEnvironments]),
    verificationGracePolicy: Object.freeze({ ...suite.verificationGracePolicy }),
  });
}

function assertKnownAlgorithms(suite: CryptoSuite): void {
  const ids = [
    suite.signatureAlgorithm,
    suite.kemAlgorithm,
    suite.hashAlgorithm,
    suite.symmetricAlgorithm,
    suite.kdfAlgorithm,
  ];
  for (const id of ids) {
    if (id !== null && !isAlgorithmId(id)) {
      throw new TypeError(`suite ${suite.suiteId} references unknown algorithm ${String(id)}`);
    }
  }
}

/**
 * Versioned, immutable CryptoSuite registry.
 *
 * Lifecycle state cannot be mutated after construction. A later
 * protocol-upgrade chunk may construct a new registry. AI / models
 * have no API to alter lifecycle.
 */
export class CryptoSuiteRegistry {
  readonly #suites: ReadonlyMap<string, CryptoSuite>;

  constructor(suites: readonly CryptoSuite[]) {
    const map = new Map<string, CryptoSuite>();
    for (const suite of suites) {
      if (map.has(suite.suiteId)) {
        throw new Error(`duplicate CryptoSuite id ${suite.suiteId}`);
      }
      for (const purpose of suite.purposes) {
        if (!isKeyPurpose(purpose)) {
          throw new TypeError(`suite ${suite.suiteId} has unknown purpose ${purpose}`);
        }
      }
      assertKnownAlgorithms(suite);
      map.set(suite.suiteId, freezeCryptoSuite(suite));
    }
    this.#suites = map;
    Object.freeze(this);
  }

  get(suiteId: string): SecurityResult<CryptoSuite> {
    const suite = this.#suites.get(suiteId);
    if (!suite) {
      return securityErr('UNKNOWN_SUITE', `unknown CryptoSuite ${suiteId}`);
    }
    return securityOk(suite);
  }

  require(suiteId: string): CryptoSuite {
    const result = this.get(suiteId);
    if (!result.ok) {
      throw new TypeError(result.error.message);
    }
    return result.value;
  }

  list(): readonly CryptoSuite[] {
    return [...this.#suites.values()];
  }

  has(suiteId: string): boolean {
    return this.#suites.has(suiteId);
  }
}

export const SUITE_SUNREY_APP_HMAC_V1 = cryptoSuiteId('sunrey-app-hmac-v1');
export const SUITE_SUNREY_ED25519_V1 = cryptoSuiteId('sunrey-ed25519-v1');
export const SUITE_SUNREY_HYBRID_SIM_V1 = cryptoSuiteId('sunrey-hybrid-ed25519-mldsa-sim-v1');
export const SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1 = cryptoSuiteId('sunrey-hybrid-ed25519-mldsa-v1');
export const SUITE_SUNREY_MLDSA_65_V1 = cryptoSuiteId('sunrey-mldsa-65-v1');
export const SUITE_SUNREY_MLKEM_768_V1 = cryptoSuiteId('sunrey-mlkem-768-v1');
export const SUITE_SUNREY_SLHDSA_V1 = cryptoSuiteId('sunrey-slhdsa-sha2-128s-v1');
export const SUITE_SUNREY_ED25519_DEPRECATED = cryptoSuiteId('sunrey-ed25519-deprecated-test');
export const SUITE_SUNREY_ED25519_VERIFY_ONLY = cryptoSuiteId('sunrey-ed25519-verify-only-test');

const APPLICATION_PURPOSES = [
  'EXECUTION_AUTHORITY_SIGNING',
  'EVIDENCE_INTEGRITY',
  'SESSION_SIGNING',
  'DATA_ENCRYPTION',
  'BACKUP_ENCRYPTION',
  'SERVICE_AUTHENTICATION',
  'WEBHOOK_SIGNING',
  'DATA_USE_PERMIT_SIGNING',
  'CLEAN_ROOM_JOIN_TOKEN',
  'PYRAMID_CUSTODY_FUTURE',
  'CHAIN_OPERATION_SIGNING',
] as const satisfies readonly KeyPurpose[];

const CHAIN_SIGNING_PURPOSES = [
  'TRANSACTION_SIGNING',
  'VALIDATOR_CONSENSUS_SIGNING',
  'BLOCK_PROPOSAL_SIGNING',
  'P2P_IDENTITY',
  'ORACLE_SIGNING',
  'GOVERNANCE_SIGNING',
  'ATTESTATION_SIGNING',
  'EVIDENCE_SIGNING',
  'WALLET_SIGNING',
  'INTEROPERABILITY_SIGNING',
  'MACHINE_SIGNING',
  'GENESIS_SIGNING',
  'RELEASE_SIGNING',
  'RECOVERY_SIGNING',
] as const satisfies readonly KeyPurpose[];

function grace(allowHistoricalVerify: boolean, rejectNewSignatures: boolean): VerificationGracePolicy {
  return Object.freeze({
    allowHistoricalVerify,
    rejectNewSignatures,
    graceEpoch: null,
    graceHeight: null,
  });
}

export function defaultCryptoSuites(): readonly CryptoSuite[] {
  return [
    freezeCryptoSuite({
      suiteId: SUITE_SUNREY_APP_HMAC_V1,
      version: 1,
      signatureAlgorithm: 'HMAC-SHA256',
      kemAlgorithm: null,
      hashAlgorithm: 'SHA-256',
      symmetricAlgorithm: 'AES-256-GCM',
      kdfAlgorithm: 'HKDF-SHA-256',
      parameterProfile: 'application-hmac-aes',
      purposes: APPLICATION_PURPOSES,
      lifecycleState: 'ACTIVE',
      permittedEnvironments: ['simulation', 'test'],
      introducedProtocolVersion: 'sunrey-protocol-0',
      activationEpoch: 0,
      activationHeight: 0,
      deprecationEpoch: null,
      deprecationHeight: null,
      verificationGracePolicy: grace(true, false),
      providerId: 'simulation',
    }),
    freezeCryptoSuite({
      suiteId: SUITE_SUNREY_ED25519_V1,
      version: 1,
      signatureAlgorithm: 'Ed25519',
      kemAlgorithm: null,
      hashAlgorithm: 'SHA-256',
      symmetricAlgorithm: null,
      kdfAlgorithm: null,
      parameterProfile: 'rfc8032',
      purposes: CHAIN_SIGNING_PURPOSES,
      lifecycleState: 'APPROVED_FOR_SIMULATION',
      permittedEnvironments: ['simulation', 'test'],
      introducedProtocolVersion: 'sunrey-protocol-0',
      activationEpoch: 0,
      activationHeight: 0,
      deprecationEpoch: null,
      deprecationHeight: null,
      verificationGracePolicy: grace(true, false),
      providerId: 'node-crypto-ed25519',
    }),
    freezeCryptoSuite({
      suiteId: SUITE_SUNREY_HYBRID_SIM_V1,
      version: 1,
      signatureAlgorithm: 'Ed25519',
      kemAlgorithm: null,
      hashAlgorithm: 'SHA-256',
      symmetricAlgorithm: null,
      kdfAlgorithm: null,
      parameterProfile: 'classical-and-pq-simulation',
      purposes: CHAIN_SIGNING_PURPOSES,
      lifecycleState: 'TEST_ONLY',
      permittedEnvironments: ['simulation', 'test'],
      introducedProtocolVersion: 'sunrey-protocol-0',
      activationEpoch: null,
      activationHeight: null,
      deprecationEpoch: null,
      deprecationHeight: null,
      verificationGracePolicy: grace(true, false),
      providerId: 'hybrid-ed25519-simulation-pq',
    }),
    freezeCryptoSuite({
      suiteId: SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1,
      version: 1,
      signatureAlgorithm: 'Ed25519',
      kemAlgorithm: null,
      hashAlgorithm: 'SHA-256',
      symmetricAlgorithm: null,
      kdfAlgorithm: null,
      parameterProfile: 'classical-and-pq-mldsa-65-v1',
      purposes: CHAIN_SIGNING_PURPOSES,
      lifecycleState: 'TESTNET_APPROVED',
      permittedEnvironments: ['simulation', 'test'],
      introducedProtocolVersion: 'sunrey-protocol-0',
      activationEpoch: null,
      activationHeight: null,
      deprecationEpoch: null,
      deprecationHeight: null,
      verificationGracePolicy: grace(true, false),
      providerId: 'hybrid-ed25519-noble-mldsa-65-v1',
    }),
    freezeCryptoSuite({
      suiteId: SUITE_SUNREY_MLDSA_65_V1,
      version: 1,
      signatureAlgorithm: 'ML_DSA_65_V1',
      kemAlgorithm: null,
      hashAlgorithm: 'SHA-256',
      symmetricAlgorithm: null,
      kdfAlgorithm: null,
      parameterProfile: 'fips-204-ml-dsa-65-v1',
      purposes: CHAIN_SIGNING_PURPOSES,
      lifecycleState: 'TESTNET_APPROVED',
      permittedEnvironments: ['simulation', 'test'],
      introducedProtocolVersion: 'sunrey-protocol-0',
      activationEpoch: null,
      activationHeight: null,
      deprecationEpoch: null,
      deprecationHeight: null,
      verificationGracePolicy: grace(true, false),
      providerId: 'noble-post-quantum-0.5.4',
    }),
    freezeCryptoSuite({
      suiteId: SUITE_SUNREY_MLKEM_768_V1,
      version: 1,
      signatureAlgorithm: null,
      kemAlgorithm: 'ML_KEM_768_V1',
      hashAlgorithm: 'SHA-256',
      symmetricAlgorithm: 'AES-256-GCM',
      kdfAlgorithm: 'HKDF-SHA-256',
      parameterProfile: 'fips-203-ml-kem-768-v1',
      purposes: ['BACKUP_ENCRYPTION', 'DATA_ENCRYPTION'],
      lifecycleState: 'TESTNET_APPROVED',
      permittedEnvironments: ['simulation', 'test'],
      introducedProtocolVersion: 'sunrey-protocol-0',
      activationEpoch: null,
      activationHeight: null,
      deprecationEpoch: null,
      deprecationHeight: null,
      verificationGracePolicy: grace(true, false),
      providerId: 'noble-post-quantum-0.5.4',
    }),
    freezeCryptoSuite({
      suiteId: SUITE_SUNREY_SLHDSA_V1,
      version: 1,
      signatureAlgorithm: 'SLH_DSA_SHA2_128S_V1',
      kemAlgorithm: null,
      hashAlgorithm: 'SHA-256',
      symmetricAlgorithm: null,
      kdfAlgorithm: null,
      parameterProfile: 'fips-205-slh-dsa-sha2-128s-v1',
      purposes: CHAIN_SIGNING_PURPOSES,
      lifecycleState: 'TESTNET_APPROVED',
      permittedEnvironments: ['simulation', 'test'],
      introducedProtocolVersion: 'sunrey-protocol-0',
      activationEpoch: null,
      activationHeight: null,
      deprecationEpoch: null,
      deprecationHeight: null,
      verificationGracePolicy: grace(true, false),
      providerId: 'noble-post-quantum-0.5.4',
    }),
  ];
}

export function testFixtureCryptoSuites(): readonly CryptoSuite[] {
  return [
    ...defaultCryptoSuites(),
    freezeCryptoSuite({
      suiteId: SUITE_SUNREY_ED25519_DEPRECATED,
      version: 1,
      signatureAlgorithm: 'Ed25519',
      kemAlgorithm: null,
      hashAlgorithm: 'SHA-256',
      symmetricAlgorithm: null,
      kdfAlgorithm: null,
      parameterProfile: 'rfc8032-deprecated-test',
      purposes: CHAIN_SIGNING_PURPOSES,
      lifecycleState: 'DEPRECATED',
      permittedEnvironments: ['simulation', 'test'],
      introducedProtocolVersion: 'sunrey-protocol-0',
      activationEpoch: 0,
      activationHeight: 0,
      deprecationEpoch: 10,
      deprecationHeight: 100,
      verificationGracePolicy: grace(true, true),
      providerId: 'node-crypto-ed25519',
    }),
    freezeCryptoSuite({
      suiteId: SUITE_SUNREY_ED25519_VERIFY_ONLY,
      version: 1,
      signatureAlgorithm: 'Ed25519',
      kemAlgorithm: null,
      hashAlgorithm: 'SHA-256',
      symmetricAlgorithm: null,
      kdfAlgorithm: null,
      parameterProfile: 'rfc8032-verify-only-test',
      purposes: CHAIN_SIGNING_PURPOSES,
      lifecycleState: 'VERIFY_ONLY',
      permittedEnvironments: ['simulation', 'test'],
      introducedProtocolVersion: 'sunrey-protocol-0',
      activationEpoch: 0,
      activationHeight: 0,
      deprecationEpoch: 5,
      deprecationHeight: 50,
      verificationGracePolicy: grace(true, true),
      providerId: 'node-crypto-ed25519',
    }),
  ];
}

export function createDefaultCryptoSuiteRegistry(): CryptoSuiteRegistry {
  return new CryptoSuiteRegistry(defaultCryptoSuites());
}

export function createTestCryptoSuiteRegistry(): CryptoSuiteRegistry {
  return new CryptoSuiteRegistry(testFixtureCryptoSuites());
}

export const REGISTERED_ALGORITHM_COUNT = ALGORITHM_IDS.length;

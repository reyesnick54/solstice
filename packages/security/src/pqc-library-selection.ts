/**
 * Library-selection record for post-quantum algorithms.
 *
 * Chunk 60 selects @noble/post-quantum for development/testnet.
 * This is not a quantum-proof claim and not a production certification.
 */

export const PQC_LIBRARY_SELECTION = Object.freeze({
  status: 'SELECTED_FOR_DEVELOPMENT_AND_TESTNET',
  productionStatus: 'NOT_SELECTED_FOR_PRODUCTION',
  families: Object.freeze(['ML-KEM', 'ML-DSA', 'SLH-DSA'] as const),
  registeredAlgorithmIds: Object.freeze([
    'ML_DSA_65_V1',
    'ML_KEM_768_V1',
    'SLH_DSA_SHA2_128S_V1',
  ] as const),
  aliasAlgorithmIds: Object.freeze(['ML-DSA-65', 'ML-KEM-768', 'SLH-DSA-SHA2-128S'] as const),
  simulationAlgorithmIds: Object.freeze([
    'SIMULATION-ML-DSA-65',
    'SIMULATION-ML-KEM-768',
    'SIMULATION-SLH-DSA-SHA2-128S',
  ] as const),
  selectedProvider: Object.freeze({
    name: '@noble/post-quantum',
    version: '0.5.4',
    providerId: 'noble-post-quantum-0.5.4',
    kind: 'javascript',
    license: 'MIT',
    standards: Object.freeze(['FIPS 203', 'FIPS 204', 'FIPS 205'] as const),
    environments: Object.freeze(['simulation', 'test'] as const),
    mainnetActivation: false,
    certifiedHsm: false,
  }),
  productionProvider: null,
  simulationProviderId: 'simulation-pq-placeholder',
  simulationProviderPath: 'packages/security/src/pq-simulation-provider.ts',
  standardizedProviderPath: 'packages/security/src/pq-provider.ts',
  reason:
    'Node.js 22 has no native FIPS 203/204/205. @noble/post-quantum 0.5.4 is a maintained, auditable, memory-safe TypeScript implementation of the NIST standardized algorithms, portable across this monorepo CI, MIT-licensed, and pinned in package-lock.json. liboqs native bindings are not portable here. Future node:crypto FIPS modules remain preferred if they ship. Production / HSM / counsel approval remains pending.',
  candidates: Object.freeze([
    {
      name: '@noble/post-quantum',
      kind: 'javascript',
      portable: true,
      selected: true,
      version: '0.5.4',
      note: 'Selected for development/testnet. FIPS 203/204/205. Not production-approved.',
    },
    {
      name: 'liboqs / liboqs-js',
      kind: 'native-or-wasm',
      portable: false,
      selected: false,
      note: 'Reference implementations; native bindings are not portable across this monorepo CI.',
    },
    {
      name: 'future node:crypto',
      kind: 'runtime',
      portable: true,
      selected: false,
      note: 'Prefer native node:crypto if a later Node.js release ships FIPS 203/204/205.',
    },
    {
      name: 'RustCrypto ml-dsa / ml-kem / slh-dsa',
      kind: 'rust',
      portable: true,
      selected: false,
      note: 'Evaluated for the Rust node. TypeScript testnet path uses noble so both languages share official KATs without a second TCB in application modules.',
    },
  ] as const),
  batchVerification: Object.freeze({
    evaluated: true,
    adopted: false,
    reason:
      '@noble/post-quantum 0.5.4 does not expose an established batch-verification API. Custom cryptographic batching is forbidden. Sequential verify is used.',
  }),
  zeroization: Object.freeze({
    claimed: false,
    note: 'JS runtimes and noble intermediates are not guaranteed to zeroize. PrivateKeyMaterial can be wiped on dispose. Do not claim guaranteed zeroization.',
  }),
  notQuantumProof: true,
  notCertified: true,
  notMainnet: true,
} as const);

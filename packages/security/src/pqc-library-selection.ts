/**
 * Library-selection record for post-quantum algorithms.
 *
 * This chunk does not select a production PQC library and does not
 * claim quantum-proof or certified cryptography.
 */

export const PQC_LIBRARY_SELECTION = Object.freeze({
  status: 'NOT_SELECTED_FOR_PRODUCTION',
  families: Object.freeze(['ML-KEM', 'ML-DSA', 'SLH-DSA'] as const),
  registeredAlgorithmIds: Object.freeze([
    'ML-DSA-65',
    'ML-KEM-768',
    'SLH-DSA-SHA2-128S',
  ] as const),
  simulationAlgorithmIds: Object.freeze([
    'SIMULATION-ML-DSA-65',
    'SIMULATION-ML-KEM-768',
    'SIMULATION-SLH-DSA-SHA2-128S',
  ] as const),
  productionProvider: null,
  simulationProviderId: 'simulation-pq-placeholder',
  simulationProviderPath: 'packages/security/src/pq-simulation-provider.ts',
  reason:
    'Node.js 22 has no native ML-KEM, ML-DSA, or SLH-DSA. Adding a WASM or native TCB (liboqs, @noble/post-quantum) is a later research decision. This chunk ships provider ports, algorithm IDs, lifecycle controls, and a TEST_ONLY simulation provider that is not production cryptography.',
  candidates: Object.freeze([
    {
      name: '@noble/post-quantum',
      kind: 'javascript',
      portable: true,
      selected: false,
      note: 'Mature maintained TypeScript implementations; not selected as a production TCB in this chunk.',
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
  ] as const),
  notQuantumProof: true,
  notCertified: true,
} as const);

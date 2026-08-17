/**
 * sunrey-ops crypto commands.
 *
 * Surfaces CryptoSuite registry, height-activated policy, inventory,
 * readiness, and a measured benchmark subset. Never prints private keys.
 */

import {
  CRYPTOGRAPHIC_INVENTORY,
  PQC_LIBRARY_SELECTION,
  TESTNET_HYBRID_MIGRATION_SCHEDULE,
  createDefaultCryptoSuiteRegistry,
  createSecurityProviderCatalog,
  migrationStateAtHeight,
  policyAcceptedSuites,
  runCryptoBenchmarks,
} from '../../../security/src/index.ts';
import { containsPrivateMaterial } from '../wallet/keys.ts';

export type CryptoCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

function assertPublic(payload: unknown): void {
  const text = JSON.stringify(payload);
  if (containsPrivateMaterial(text)) {
    throw new Error('crypto CLI refused to emit private key material');
  }
}

export function runCryptoCommand(args: readonly string[]): CryptoCliResult {
  const action = args[0] ?? 'suites';
  if (action === 'suites') {
    const registry = createDefaultCryptoSuiteRegistry();
    const payload = {
      suites: registry.list().map((suite) => ({
        suiteId: suite.suiteId,
        signatureAlgorithm: suite.signatureAlgorithm,
        kemAlgorithm: suite.kemAlgorithm,
        lifecycleState: suite.lifecycleState,
        permittedEnvironments: suite.permittedEnvironments,
        providerId: suite.providerId,
        parameterProfile: suite.parameterProfile,
      })),
      provider: PQC_LIBRARY_SELECTION.selectedProvider,
      mainnetActivation: false,
    };
    assertPublic(payload);
    return { ok: true, command: 'crypto suites', payload };
  }
  if (action === 'policy') {
    const height = Number(args[1] ?? '0');
    const state = migrationStateAtHeight(height);
    const payload = {
      height,
      schedule: TESTNET_HYBRID_MIGRATION_SCHEDULE,
      migrationState: state,
      acceptedSuites: policyAcceptedSuites(state),
      retireClassicalVerification: false,
      mainnetActivation: false,
    };
    assertPublic(payload);
    return { ok: true, command: 'crypto policy', payload };
  }
  if (action === 'inventory') {
    const payload = {
      inventory: CRYPTOGRAPHIC_INVENTORY,
      provider: PQC_LIBRARY_SELECTION.selectedProvider,
      productionStatus: PQC_LIBRARY_SELECTION.productionStatus,
    };
    assertPublic(payload);
    return { ok: true, command: 'crypto inventory', payload };
  }
  if (action === 'readiness') {
    const catalog = createSecurityProviderCatalog();
    const mlDsa = catalog.signature('ML_DSA_65_V1');
    const mlKem = catalog.kem('ML_KEM_768_V1');
    const payload = {
      environment: 'simulation',
      testnetReady: mlDsa.ok && mlKem.ok,
      productionApproved: false,
      mainnetActivation: false,
      pqProvider: PQC_LIBRARY_SELECTION.selectedProvider.providerId,
      failClosed: true,
      historicalClassicalVerify: true,
      notes: 'standardized post-quantum algorithm implementation for development/testnet; hybrid testnet migration only',
    };
    assertPublic(payload);
    return { ok: true, command: 'crypto readiness', payload };
  }
  if (action === 'benchmark') {
    const rows = runCryptoBenchmarks().filter(
      (row) => row.algorithm !== 'SLH_DSA_SHA2_128S_V1' || row.operation !== 'sign',
    );
    const payload = {
      rows,
      interpretation: 'measured host timings; no marketing claim',
      batchVerification: PQC_LIBRARY_SELECTION.batchVerification,
      zeroization: PQC_LIBRARY_SELECTION.zeroization,
    };
    assertPublic(payload);
    return { ok: true, command: 'crypto benchmark', payload };
  }
  return {
    ok: false,
    command: `crypto ${action}`,
    payload: { error: 'unknown crypto command', usage: 'sunrey-ops crypto suites|policy|inventory|readiness|benchmark' },
  };
}

export function cryptoUsage(): string {
  return [
    'sunrey-ops crypto suites',
    'sunrey-ops crypto policy [height]',
    'sunrey-ops crypto inventory',
    'sunrey-ops crypto readiness',
    'sunrey-ops crypto benchmark',
  ].join('\n');
}

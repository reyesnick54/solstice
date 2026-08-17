import { runCryptoBenchmarks } from '../../../security/src/crypto-benchmark.ts';
import {
  CLASSICAL_WALLET_SUITE,
  HYBRID_WALLET_SUITE,
  publicDescriptorFromSeed,
  seedFromLabel,
  signWalletBytes,
  verifyWalletBytes,
} from '../wallet/keys.ts';
import { caseResult } from './result.ts';
import { measureMany, summarizeLatency } from './statistics.ts';
import type { BenchCaseResult } from './types.ts';

/**
 * CryptoSuite costs are labeled separately and must not be mixed into
 * protocol TPS without that label. Chunk 60 real PQC is not available.
 */
export function measureCryptoSuites(): readonly BenchCaseResult[] {
  const rows = runCryptoBenchmarks();
  const cases: BenchCaseResult[] = rows.map((row) =>
    caseResult('crypto', `${row.algorithm}_${row.operation}`, {
      cryptoLabeledSeparately: true,
      extras: {
        providerId: row.providerId,
        iterations: row.iterations,
        elapsedMs: row.elapsedMs,
        note: row.note,
        notProtocolTps: true,
      },
    }),
  );

  const payload = Buffer.from('sunrey.perf.wallet.v1');
  const classicalSeed = seedFromLabel('perf-classical');
  const hybridSeed = seedFromLabel('perf-hybrid');
  const classical = publicDescriptorFromSeed('perf.classical', classicalSeed, CLASSICAL_WALLET_SUITE);
  const hybrid = publicDescriptorFromSeed('perf.hybrid', hybridSeed, HYBRID_WALLET_SUITE);
  const classicalSig = signWalletBytes(classicalSeed, payload);
  const hybridSig = signWalletBytes(hybridSeed, payload);

  cases.push(
    caseResult('crypto', 'classical_development_verify', {
      cryptoLabeledSeparately: true,
      latency: summarizeLatency(
        measureMany(80, () => {
          verifyWalletBytes(classical.publicKeyHex, payload, classicalSig);
        }),
      ),
      extras: { suite: CLASSICAL_WALLET_SUITE, notProtocolTps: true },
    }),
    caseResult('crypto', 'hybrid_simulation_verify', {
      cryptoLabeledSeparately: true,
      latency: summarizeLatency(
        measureMany(80, () => {
          verifyWalletBytes(hybrid.publicKeyHex, payload, hybridSig);
        }),
      ),
      extras: { suite: HYBRID_WALLET_SUITE, notProtocolTps: true },
    }),
    caseResult('crypto', 'chunk_60_real_pqc_unavailable', {
      cryptoLabeledSeparately: true,
      extras: {
        available: false,
        reservedFor: 'CHUNK-60',
        notProtocolTps: true,
      },
    }),
  );
  return cases;
}

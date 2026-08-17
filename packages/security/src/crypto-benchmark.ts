import { createSignedBinding } from './crypto-binding.ts';
import { signHybrid } from './crypto-hybrid.ts';
import {
  SUITE_SUNREY_ED25519_V1,
  SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1,
  SUITE_SUNREY_MLDSA_65_V1,
  SUITE_SUNREY_MLKEM_768_V1,
  SUITE_SUNREY_SLHDSA_V1,
} from './crypto-suite.ts';
import { createEd25519SignatureProvider } from './ed25519-provider.ts';
import { createSimulationPqKemProvider, createSimulationPqSignatureProvider } from './pq-simulation-provider.ts';
import { createMlDsa65Provider, createMlKem768Provider, createSlhDsaSha2128sProvider } from './pq-provider.ts';
import {
  ML_DSA_65_V1_PUBLIC_KEY_BYTES,
  ML_DSA_65_V1_SECRET_KEY_BYTES,
  ML_DSA_65_V1_SIGNATURE_BYTES,
  SLH_DSA_SHA2_128S_V1_PUBLIC_KEY_BYTES,
  SLH_DSA_SHA2_128S_V1_SECRET_KEY_BYTES,
  SLH_DSA_SHA2_128S_V1_SIGNATURE_BYTES,
} from './pq-sizes.ts';

export type BenchmarkRow = {
  readonly algorithm: string;
  readonly providerId: string;
  readonly operation: string;
  readonly iterations: number;
  readonly elapsedMs: number;
  readonly publicKeyBytes?: number;
  readonly signatureBytes?: number;
  readonly ciphertextBytes?: number;
  readonly note: string;
};

function timeMs(iterations: number, fn: () => void): number {
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i += 1) {
    fn();
  }
  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000;
}

export function runCryptoBenchmarks(): readonly BenchmarkRow[] {
  const ed = createEd25519SignatureProvider();
  const pq = createSimulationPqSignatureProvider();
  const kem = createSimulationPqKemProvider();
  const rows: BenchmarkRow[] = [];

  const edKey = ed.generateKey('TRANSACTION_SIGNING', SUITE_SUNREY_ED25519_V1);
  if (!edKey.ok) {
    throw new Error(edKey.error.message);
  }
  const binding = createSignedBinding({
    networkId: 'sunrey-sim',
    chainId: 'sunrey-sim-0',
    protocolVersion: 'sunrey-protocol-0',
    algorithmId: 'Ed25519',
    suiteId: SUITE_SUNREY_ED25519_V1,
    keyPurpose: 'TRANSACTION_SIGNING',
    messageDomain: 'tx.v1',
    payload: 'benchmark-payload',
  });
  const signed = ed.sign(edKey.value.privateKey, edKey.value.publicKey, binding);
  if (!signed.ok) {
    throw new Error(signed.error.message);
  }

  rows.push({
    algorithm: 'Ed25519',
    providerId: ed.providerId,
    operation: 'keygen',
    iterations: 50,
    elapsedMs: timeMs(50, () => {
      ed.generateKey('TRANSACTION_SIGNING', SUITE_SUNREY_ED25519_V1);
    }),
    publicKeyBytes: Buffer.from(edKey.value.publicKey.publicKeyHex, 'hex').length,
    note: 'node:crypto Ed25519; measured on this host',
  });
  rows.push({
    algorithm: 'Ed25519',
    providerId: ed.providerId,
    operation: 'sign',
    iterations: 200,
    elapsedMs: timeMs(200, () => {
      ed.sign(edKey.value.privateKey, edKey.value.publicKey, binding);
    }),
    signatureBytes: Buffer.from(signed.value.signatureHex, 'hex').length,
    note: 'includes SignedBinding encode',
  });
  rows.push({
    algorithm: 'Ed25519',
    providerId: ed.providerId,
    operation: 'verify',
    iterations: 200,
    elapsedMs: timeMs(200, () => {
      ed.verify(edKey.value.publicKey, binding, signed.value);
    }),
    note: 'includes SignedBinding encode',
  });

  const pqKey = pq.generateKey('TRANSACTION_SIGNING', SUITE_SUNREY_ED25519_V1);
  if (!pqKey.ok) {
    throw new Error(pqKey.error.message);
  }
  const pqBinding = createSignedBinding({
    networkId: 'sunrey-sim',
    chainId: 'sunrey-sim-0',
    protocolVersion: 'sunrey-protocol-0',
    algorithmId: 'SIMULATION-ML-DSA-65',
    suiteId: SUITE_SUNREY_ED25519_V1,
    keyPurpose: 'TRANSACTION_SIGNING',
    messageDomain: 'tx.v1',
    payload: 'benchmark-payload',
  });
  const pqSigned = pq.sign(pqKey.value.privateKey, pqKey.value.publicKey, pqBinding);
  if (!pqSigned.ok) {
    throw new Error(pqSigned.error.message);
  }
  rows.push({
    algorithm: 'SIMULATION-ML-DSA-65',
    providerId: pq.providerId,
    operation: 'sign',
    iterations: 200,
    elapsedMs: timeMs(200, () => {
      pq.sign(pqKey.value.privateKey, pqKey.value.publicKey, pqBinding);
    }),
    publicKeyBytes: Buffer.from(pqKey.value.publicKey.publicKeyHex, 'hex').length,
    signatureBytes: Buffer.from(pqSigned.value.signatureHex, 'hex').length,
    note: 'TEST_ONLY simulation provider; NOT ML-DSA performance',
  });

  const kemKey = kem.generateKey('DATA_ENCRYPTION', SUITE_SUNREY_MLKEM_768_V1);
  if (!kemKey.ok) {
    throw new Error(kemKey.error.message);
  }
  const enc = kem.encapsulate(kemKey.value.publicKey, SUITE_SUNREY_MLKEM_768_V1);
  if (!enc.ok) {
    throw new Error(enc.error.message);
  }
  rows.push({
    algorithm: 'SIMULATION-ML-KEM-768',
    providerId: kem.providerId,
    operation: 'encapsulate',
    iterations: 200,
    elapsedMs: timeMs(200, () => {
      kem.encapsulate(kemKey.value.publicKey, SUITE_SUNREY_MLKEM_768_V1);
    }),
    ciphertextBytes: Buffer.from(enc.value.kem.ciphertextHex, 'hex').length,
    note: 'TEST_ONLY simulation KEM; NOT ML-KEM performance',
  });
  rows.push({
    algorithm: 'SIMULATION-ML-KEM-768',
    providerId: kem.providerId,
    operation: 'decapsulate',
    iterations: 200,
    elapsedMs: timeMs(200, () => {
      kem.decapsulate(kemKey.value.privateKey, kemKey.value.publicKey, enc.value.kem);
    }),
    note: 'TEST_ONLY simulation KEM; NOT ML-KEM performance',
  });

  const txImpact = Buffer.from(signed.value.signatureHex, 'hex').length +
    Buffer.from(edKey.value.publicKey.publicKeyHex, 'hex').length;
  rows.push({
    algorithm: 'Ed25519',
    providerId: ed.providerId,
    operation: 'transaction-size-impact',
    iterations: 1,
    elapsedMs: 0,
    publicKeyBytes: Buffer.from(edKey.value.publicKey.publicKeyHex, 'hex').length,
    signatureBytes: Buffer.from(signed.value.signatureHex, 'hex').length,
    note: `public key + signature = ${txImpact} bytes on this host`,
  });

  const mlDsa = createMlDsa65Provider();
  const mlDsaKey = mlDsa.generateKey('TRANSACTION_SIGNING', SUITE_SUNREY_MLDSA_65_V1);
  if (!mlDsaKey.ok) {
    throw new Error(mlDsaKey.error.message);
  }
  const mlDsaBinding = createSignedBinding({
    networkId: 'sunrey-sim',
    chainId: 'sunrey-sim-0',
    protocolVersion: 'sunrey-protocol-0',
    algorithmId: 'ML_DSA_65_V1',
    suiteId: SUITE_SUNREY_MLDSA_65_V1,
    keyPurpose: 'TRANSACTION_SIGNING',
    messageDomain: 'tx.v1',
    payload: 'benchmark-payload',
  });
  const mlDsaSigned = mlDsa.sign(mlDsaKey.value.privateKey, mlDsaKey.value.publicKey, mlDsaBinding);
  if (!mlDsaSigned.ok) {
    throw new Error(mlDsaSigned.error.message);
  }
  rows.push({
    algorithm: 'ML_DSA_65_V1',
    providerId: mlDsa.providerId,
    operation: 'sign',
    iterations: 20,
    elapsedMs: timeMs(20, () => {
      mlDsa.sign(mlDsaKey.value.privateKey, mlDsaKey.value.publicKey, mlDsaBinding);
    }),
    publicKeyBytes: ML_DSA_65_V1_PUBLIC_KEY_BYTES,
    signatureBytes: ML_DSA_65_V1_SIGNATURE_BYTES,
    note: `standardized FIPS 204; private key ${ML_DSA_65_V1_SECRET_KEY_BYTES} bytes if safely measurable`,
  });
  rows.push({
    algorithm: 'ML_DSA_65_V1',
    providerId: mlDsa.providerId,
    operation: 'verify',
    iterations: 20,
    elapsedMs: timeMs(20, () => {
      mlDsa.verify(mlDsaKey.value.publicKey, mlDsaBinding, mlDsaSigned.value);
    }),
    note: 'standardized FIPS 204 verify; no marketing interpretation',
  });

  const slh = createSlhDsaSha2128sProvider();
  const slhKey = slh.generateKey('TRANSACTION_SIGNING', SUITE_SUNREY_SLHDSA_V1);
  if (!slhKey.ok) {
    throw new Error(slhKey.error.message);
  }
  const slhBinding = createSignedBinding({
    networkId: 'sunrey-sim',
    chainId: 'sunrey-sim-0',
    protocolVersion: 'sunrey-protocol-0',
    algorithmId: 'SLH_DSA_SHA2_128S_V1',
    suiteId: SUITE_SUNREY_SLHDSA_V1,
    keyPurpose: 'TRANSACTION_SIGNING',
    messageDomain: 'tx.v1',
    payload: 'benchmark-payload',
  });
  const slhSigned = slh.sign(slhKey.value.privateKey, slhKey.value.publicKey, slhBinding);
  if (!slhSigned.ok) {
    throw new Error(slhSigned.error.message);
  }
  rows.push({
    algorithm: 'SLH_DSA_SHA2_128S_V1',
    providerId: slh.providerId,
    operation: 'sign',
    iterations: 2,
    elapsedMs: timeMs(2, () => {
      slh.sign(slhKey.value.privateKey, slhKey.value.publicKey, slhBinding);
    }),
    publicKeyBytes: SLH_DSA_SHA2_128S_V1_PUBLIC_KEY_BYTES,
    signatureBytes: SLH_DSA_SHA2_128S_V1_SIGNATURE_BYTES,
    note: `diversification option; private key ${SLH_DSA_SHA2_128S_V1_SECRET_KEY_BYTES} bytes; not the default validator algorithm`,
  });

  const realKem = createMlKem768Provider();
  const realKemKey = realKem.generateKey('DATA_ENCRYPTION', SUITE_SUNREY_MLKEM_768_V1);
  if (!realKemKey.ok) {
    throw new Error(realKemKey.error.message);
  }
  const realEnc = realKem.encapsulate(realKemKey.value.publicKey, SUITE_SUNREY_MLKEM_768_V1);
  if (!realEnc.ok) {
    throw new Error(realEnc.error.message);
  }
  rows.push({
    algorithm: 'ML_KEM_768_V1',
    providerId: realKem.providerId,
    operation: 'encapsulate',
    iterations: 20,
    elapsedMs: timeMs(20, () => {
      realKem.encapsulate(realKemKey.value.publicKey, SUITE_SUNREY_MLKEM_768_V1);
    }),
    ciphertextBytes: Buffer.from(realEnc.value.kem.ciphertextHex, 'hex').length,
    note: 'standardized FIPS 203; KEM is not a signature primitive',
  });

  const hybridEd = ed.generateKey('TRANSACTION_SIGNING', SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1);
  if (!hybridEd.ok) {
    throw new Error(hybridEd.error.message);
  }
  const pqKey = mlDsa.generateKey('TRANSACTION_SIGNING', SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1);
  if (!pqKey.ok) {
    throw new Error(pqKey.error.message);
  }
  const hybrid = signHybrid({
    suiteId: SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1,
    protocolVersion: 'sunrey-protocol-0',
    domain: 'consensus.v1',
    networkId: 'sunrey-sim',
    chainId: 'sunrey-sim-0',
    payload: 'benchmark-vote',
    verificationPolicy: 'REQUIRE_ALL',
    classical: {
      provider: ed,
      publicKey: hybridEd.value.publicKey,
      privateKey: hybridEd.value.privateKey,
    },
    postQuantum: {
      provider: mlDsa,
      publicKey: pqKey.value.publicKey,
      privateKey: pqKey.value.privateKey,
    },
  });
  if (!hybrid.ok) {
    throw new Error(hybrid.error.message);
  }
  const hybridBytes =
    Buffer.from(hybrid.value.classicalSignature.signatureHex, 'hex').length +
    Buffer.from(hybrid.value.postQuantumSignature.signatureHex, 'hex').length;
  rows.push({
    algorithm: 'CLASSICAL_AND_PQ',
    providerId: 'hybrid-ed25519-noble-mldsa-65-v1',
    operation: 'hybrid-envelope-size',
    iterations: 1,
    elapsedMs: 0,
    signatureBytes: hybridBytes,
    note: `hybrid envelope signature components = ${hybridBytes} bytes; vote/commit/block grow by this amount; finality latency is not hidden`,
  });

  return Object.freeze(rows);
}

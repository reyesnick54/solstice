import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { createSignedBinding } from './crypto-binding.ts';
import { signHybrid, verifyHybrid } from './crypto-hybrid.ts';
import { migrationStateAtHeight, TESTNET_HYBRID_MIGRATION_SCHEDULE } from './crypto-height-policy.ts';
import { evaluateCryptoPolicy } from './crypto-policy.ts';
import {
  SUITE_SUNREY_ED25519_V1,
  SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1,
  SUITE_SUNREY_MLDSA_65_V1,
  SUITE_SUNREY_MLKEM_768_V1,
  SUITE_SUNREY_SLHDSA_V1,
  createDefaultCryptoSuiteRegistry,
} from './crypto-suite.ts';
import { createEd25519SignatureProvider } from './ed25519-provider.ts';
import { createLocalTestPqSigningProvider } from './local-test-pq-signer.ts';
import { PQC_LIBRARY_SELECTION } from './pqc-library-selection.ts';
import { decodeHybridComponent, encodeHybridComponent } from './pq-encoding.ts';
import {
  createMlDsa65Provider,
  createMlKem768Provider,
  createSlhDsaSha2128sProvider,
} from './pq-provider.ts';
import {
  MAX_P2P_PQ_MESSAGE_BYTES,
  ML_DSA_65_V1_PUBLIC_KEY_BYTES,
  ML_DSA_65_V1_SIGNATURE_BYTES,
} from './pq-sizes.ts';
import { createFailClosedPqCatalog, createSecurityProviderCatalog } from './provider-catalog.ts';
import { INITIAL_CRYPTO_MIGRATION_STATE } from './crypto-migration.ts';
import { assertNoPrivateKeyMaterial } from './crypto-leakage.ts';

const VECTORS = JSON.parse(
  readFileSync(join(import.meta.dirname, 'pq-official-vectors.json'), 'utf8'),
) as {
  readonly source: string;
  readonly messageUtf8: string;
  readonly mlDsa65: { readonly seedHex: string; readonly publicKeyHex: string; readonly signatureHex: string };
  readonly mlKem768: {
    readonly seedHex: string;
    readonly publicKeyHex: string;
    readonly encapsulateMsgHex: string;
    readonly ciphertextHex: string;
    readonly sharedSecretHex: string;
  };
  readonly slhDsaSha2_128s: { readonly seedHex: string; readonly publicKeyHex: string; readonly signatureHex: string };
};

function policyBase() {
  return {
    protocolVersion: 'sunrey-protocol-0',
    networkId: 'sunrey-sim',
    epoch: 1,
    height: 1,
    actorType: 'USER' as const,
    keyPurpose: 'TRANSACTION_SIGNING' as const,
    environment: 'test' as const,
    migrationState: INITIAL_CRYPTO_MIGRATION_STATE,
  };
}

describe('Chunk 60 standardized PQ providers', () => {
  it('passes official/provider ML-DSA-65 known-answer vectors', () => {
    const provider = createMlDsa65Provider();
    const derived = provider.fromSeed(
      VECTORS.mlDsa65.seedHex,
      'TRANSACTION_SIGNING',
      SUITE_SUNREY_MLDSA_65_V1,
      'kat-mldsa',
    );
    assert.equal(derived.ok, true);
    if (!derived.ok) return;
    assert.equal(derived.value.publicKey.publicKeyHex, VECTORS.mlDsa65.publicKeyHex);
    const message = Buffer.from(VECTORS.messageUtf8, 'utf8');
    const signed = provider.signRaw(
      derived.value.privateKey.reveal().toString('hex'),
      derived.value.publicKey.publicKeyHex,
      message,
    );
    assert.equal(signed.ok, true);
    if (!signed.ok) return;
    assert.equal(signed.value.toString('hex'), VECTORS.mlDsa65.signatureHex);
    const verified = provider.verifyRaw(VECTORS.mlDsa65.publicKeyHex, message, VECTORS.mlDsa65.signatureHex);
    assert.equal(verified.ok, true);
    assert.match(VECTORS.source, /FIPS 204/);
  });

  it('rejects malformed ML-DSA signatures and public keys', () => {
    const provider = createMlDsa65Provider();
    const key = provider.generateKey('TRANSACTION_SIGNING', SUITE_SUNREY_MLDSA_65_V1);
    assert.equal(key.ok, true);
    if (!key.ok) return;
    const message = Buffer.from('payload');
    const signed = provider.signRaw(
      key.value.privateKey.reveal().toString('hex'),
      key.value.publicKey.publicKeyHex,
      message,
    );
    assert.equal(signed.ok, true);
    if (!signed.ok) return;
    const flipped = Buffer.from(signed.value);
    flipped[0] = flipped[0] ^ 0xff;
    const badSig = provider.verifyRaw(key.value.publicKey.publicKeyHex, message, flipped.toString('hex'));
    assert.equal(badSig.ok, false);
    const shortSig = provider.verifyRaw(key.value.publicKey.publicKeyHex, message, '00'.repeat(32));
    assert.equal(shortSig.ok, false);
    const shortKey = provider.verifyRaw('00'.repeat(16), message, signed.value.toString('hex'));
    assert.equal(shortKey.ok, false);
    assert.equal(Buffer.from(key.value.publicKey.publicKeyHex, 'hex').length, ML_DSA_65_V1_PUBLIC_KEY_BYTES);
    assert.equal(signed.value.length, ML_DSA_65_V1_SIGNATURE_BYTES);
  });

  it('passes official/provider ML-KEM-768 encapsulate/decapsulate vectors', () => {
    const provider = createMlKem768Provider();
    const derived = provider.fromSeed(
      VECTORS.mlKem768.seedHex,
      'DATA_ENCRYPTION',
      SUITE_SUNREY_MLKEM_768_V1,
      'kat-mlkem',
    );
    assert.equal(derived.ok, true);
    if (!derived.ok) return;
    assert.equal(derived.value.publicKey.publicKeyHex, VECTORS.mlKem768.publicKeyHex);
    const enc = provider.encapsulate(derived.value.publicKey, SUITE_SUNREY_MLKEM_768_V1);
    assert.equal(enc.ok, true);
    if (!enc.ok) return;
    const dec = provider.decapsulate(derived.value.privateKey, derived.value.publicKey, enc.value.kem);
    assert.equal(dec.ok, true);
    if (!dec.ok) return;
    assert.equal(dec.value.sharedSecretHex, enc.value.sharedSecret.sharedSecretHex);
    const official = provider.decapsulate(derived.value.privateKey, derived.value.publicKey, {
      algorithmId: 'ML_KEM_768_V1',
      suiteId: SUITE_SUNREY_MLKEM_768_V1,
      ciphertextHex: VECTORS.mlKem768.ciphertextHex,
      providerId: provider.providerId,
    });
    assert.equal(official.ok, true);
    if (!official.ok) return;
    assert.equal(official.value.sharedSecretHex, VECTORS.mlKem768.sharedSecretHex);
  });

  it('passes official/provider SLH-DSA-SHA2-128s vectors as a diversification option', () => {
    const provider = createSlhDsaSha2128sProvider();
    const derived = provider.fromSeed(
      VECTORS.slhDsaSha2_128s.seedHex,
      'TRANSACTION_SIGNING',
      SUITE_SUNREY_SLHDSA_V1,
      'kat-slh',
    );
    assert.equal(derived.ok, true);
    if (!derived.ok) return;
    assert.equal(derived.value.publicKey.publicKeyHex, VECTORS.slhDsaSha2_128s.publicKeyHex);
    const message = Buffer.from(VECTORS.messageUtf8, 'utf8');
    const signed = provider.signRaw(
      derived.value.privateKey.reveal().toString('hex'),
      derived.value.publicKey.publicKeyHex,
      message,
    );
    assert.equal(signed.ok, true);
    if (!signed.ok) return;
    assert.equal(signed.value.toString('hex'), VECTORS.slhDsaSha2_128s.signatureHex);
    assert.equal(PQC_LIBRARY_SELECTION.selectedProvider.mainnetActivation, false);
  });

  it('REQUIRE_ALL hybrid rejects missing or invalid components and downgrades', () => {
    const classical = createEd25519SignatureProvider();
    const pq = createMlDsa65Provider();
    const cKey = classical.generateKey('TRANSACTION_SIGNING', SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1);
    const pKey = pq.generateKey('TRANSACTION_SIGNING', SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1);
    assert.equal(cKey.ok && pKey.ok, true);
    if (!cKey.ok || !pKey.ok) return;
    const common = {
      suiteId: SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1,
      protocolVersion: 'sunrey-protocol-0',
      domain: 'tx.v1',
      networkId: 'sunrey-sim',
      chainId: 'sunrey-sim-0',
      payload: 'hybrid-body',
      verificationPolicy: 'REQUIRE_ALL' as const,
    };
    const envelope = signHybrid({
      ...common,
      classical: { provider: classical, publicKey: cKey.value.publicKey, privateKey: cKey.value.privateKey },
      postQuantum: { provider: pq, publicKey: pKey.value.publicKey, privateKey: pKey.value.privateKey },
    });
    assert.equal(envelope.ok, true);
    if (!envelope.ok) return;
    assert.equal(
      verifyHybrid({
        ...common,
        envelope: envelope.value,
        classicalProvider: classical,
        postQuantumProvider: pq,
      }).ok,
      true,
    );

    const missingPq = { ...envelope.value, postQuantumSignature: { ...envelope.value.postQuantumSignature, signatureHex: '' } };
    assert.equal(
      verifyHybrid({ ...common, envelope: missingPq, classicalProvider: classical, postQuantumProvider: pq }).ok,
      false,
    );
    const missingClassical = {
      ...envelope.value,
      classicalSignature: { ...envelope.value.classicalSignature, signatureHex: '' },
    };
    assert.equal(
      verifyHybrid({
        ...common,
        envelope: missingClassical,
        classicalProvider: classical,
        postQuantumProvider: pq,
      }).ok,
      false,
    );
    const wrongAlg = {
      ...envelope.value,
      postQuantumAlgorithmId: 'Ed25519' as const,
      postQuantumSignature: { ...envelope.value.postQuantumSignature, algorithmId: 'Ed25519' as const },
    };
    assert.equal(
      verifyHybrid({ ...common, envelope: wrongAlg, classicalProvider: classical, postQuantumProvider: pq }).ok,
      false,
    );
    const wrongSuite = {
      ...envelope.value,
      suiteId: SUITE_SUNREY_ED25519_V1,
    };
    assert.equal(
      verifyHybrid({
        ...common,
        envelope: wrongSuite,
        classicalProvider: classical,
        postQuantumProvider: pq,
      }).ok,
      false,
    );
  });

  it('height-activated policy is deterministic and never retires all classical verify', () => {
    const schedule = TESTNET_HYBRID_MIGRATION_SCHEDULE;
    assert.equal(migrationStateAtHeight(0, schedule), 'CLASSICAL_ONLY');
    assert.equal(migrationStateAtHeight(schedule.h1HybridAvailable, schedule), 'HYBRID_AVAILABLE');
    assert.equal(migrationStateAtHeight(schedule.h2HybridRequiredSelectedRoles, schedule), 'HYBRID_REQUIRED_SELECTED_ROLES');
    assert.equal(migrationStateAtHeight(schedule.h3PqPrimarySelectedRole, schedule), 'PQ_PRIMARY');
    assert.equal(schedule.retireClassicalVerification, false);
    const registry = createDefaultCryptoSuiteRegistry();
    const hybridRequired = evaluateCryptoPolicy(registry, {
      ...policyBase(),
      actorType: 'VALIDATOR',
      keyPurpose: 'VALIDATOR_CONSENSUS_SIGNING',
      suiteId: SUITE_SUNREY_ED25519_V1,
      migrationState: 'HYBRID_REQUIRED_SELECTED_ROLES',
      operation: 'SIGN',
    });
    assert.equal(hybridRequired.outcome, 'REQUIRE_HYBRID');
    const historical = evaluateCryptoPolicy(registry, {
      ...policyBase(),
      actorType: 'VALIDATOR',
      keyPurpose: 'VALIDATOR_CONSENSUS_SIGNING',
      suiteId: SUITE_SUNREY_ED25519_V1,
      migrationState: 'HYBRID_REQUIRED_SELECTED_ROLES',
      operation: 'VERIFY',
    });
    assert.equal(historical.outcome, 'VERIFY_ONLY');
  });

  it('provider failure is fail-closed and never silently uses classical-only', () => {
    const catalog = createFailClosedPqCatalog();
    const provider = catalog.signature('ML_DSA_65_V1');
    assert.equal(provider.ok, true);
    if (!provider.ok) return;
    const generated = provider.value.generateKey('TRANSACTION_SIGNING', SUITE_SUNREY_MLDSA_65_V1);
    assert.equal(generated.ok, false);
    if (!generated.ok) {
      assert.equal(generated.error.code, 'PROVIDER_UNAVAILABLE');
    }
  });

  it('local/test signer advertises REAL_PQ_SUPPORTED without claiming external HSM', () => {
    const signer = createLocalTestPqSigningProvider();
    const caps = signer.capabilities();
    assert.equal(caps.realPqSupported, true);
    assert.equal(caps.externalHsmPqSupported, false);
    const generated = signer.generateKey({ purpose: 'WALLET_SIGNING', suiteId: SUITE_SUNREY_MLDSA_65_V1 });
    assert.equal(generated.ok, true);
    if (!generated.ok) return;
    const pub = signer.getPublicDescriptor(generated.value);
    assert.equal(pub.ok, true);
    if (!pub.ok) return;
    assert.equal(pub.value.algorithmId, 'ML_DSA_65_V1');
    assert.equal(assertNoPrivateKeyMaterial({ handle: generated.value, publicKey: pub.value }, 'events').ok, true);
  });

  it('oversized P2P PQ messages are rejected by the bound', () => {
    const oversized = 'aa'.repeat(MAX_P2P_PQ_MESSAGE_BYTES + 1);
    assert.equal(oversized.length / 2 > MAX_P2P_PQ_MESSAGE_BYTES, true);
    const decoded = decodeHybridComponent(`srhyb1:${'ab'.repeat(20_000)}:${'cd'.repeat(20_000)}`);
    assert.equal(decoded.ok, false);
    const encoded = encodeHybridComponent('aa'.repeat(32), 'bb'.repeat(32));
    const ok = decodeHybridComponent(encoded);
    assert.equal(ok.ok, true);
  });

  it('application catalog still hides the noble library behind SignatureProvider/KemProvider', () => {
    const catalog = createSecurityProviderCatalog();
    const signature = catalog.signature('ML_DSA_65_V1');
    const kem = catalog.kem('ML_KEM_768_V1');
    assert.equal(signature.ok && kem.ok, true);
    assert.equal('keygen' in (signature.ok ? signature.value : {}), false);
  });

  it('lockfile pins the standardized PQ dependency for SBOM/provenance', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
    const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8')) as {
      readonly packages?: Readonly<Record<string, { readonly version?: string }>>;
    };
    const entry = lock.packages?.['node_modules/@noble/post-quantum'];
    assert.equal(entry?.version, '0.5.4');
    assert.equal(PQC_LIBRARY_SELECTION.selectedProvider.version, '0.5.4');
  });
});

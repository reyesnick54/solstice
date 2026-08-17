import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { inspect } from 'node:util';
import { describe, it } from 'node:test';

import { SECP256K1_NOT_AN_ALIAS } from './algorithm-ids.ts';
import { createSignedBinding } from './crypto-binding.ts';
import { signHybrid, verifyHybrid } from './crypto-hybrid.ts';
import {
  assertNoPrivateKeyMaterial,
  findPrivateKeyLeakage,
  rejectErrorWithSecret,
  safePublicLog,
} from './crypto-leakage.ts';
import { CRYPTO_MIGRATION_STATES, INITIAL_CRYPTO_MIGRATION_STATE } from './crypto-migration.ts';
import {
  CRYPTO_POLICY_MUTATION_API,
  evaluateCryptoPolicy,
} from './crypto-policy.ts';
import {
  SUITE_SUNREY_ED25519_DEPRECATED,
  SUITE_SUNREY_ED25519_V1,
  SUITE_SUNREY_ED25519_VERIFY_ONLY,
  SUITE_SUNREY_HYBRID_SIM_V1,
  SUITE_SUNREY_MLDSA_65_V1,
  createDefaultCryptoSuiteRegistry,
  createTestCryptoSuiteRegistry,
} from './crypto-suite.ts';
import { Ed25519SignatureProvider, createEd25519SignatureProvider } from './ed25519-provider.ts';
import { RFC8032_ED25519_VECTORS } from './ed25519-vectors.ts';
import { PQC_LIBRARY_SELECTION } from './pqc-library-selection.ts';
import { createSimulationPqSignatureProvider } from './pq-simulation-provider.ts';
import { createSecurityProviderCatalog } from './provider-catalog.ts';
import { PrivateKeyMaterial } from './redaction.ts';
import { createSimulationKeyProvider } from './simulation.ts';
import { signWithSuite, verifyWithSuite } from './suite-signer.ts';
import { runCryptoBenchmarks } from './crypto-benchmark.ts';
import { CRYPTOGRAPHIC_INVENTORY } from './crypto-inventory.ts';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) {
    return out;
  }
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

function policyBase() {
  return {
    protocolVersion: 'sunrey-protocol-0',
    networkId: 'sunrey-sim',
    epoch: 1,
    height: 1,
    actorType: 'USER' as const,
    keyPurpose: 'TRANSACTION_SIGNING' as const,
    environment: 'simulation' as const,
    migrationState: INITIAL_CRYPTO_MIGRATION_STATE,
  };
}

describe('CryptoSuite registry', () => {
  it('registered suite succeeds and unknown suite fails closed', () => {
    const registry = createDefaultCryptoSuiteRegistry();
    const known = registry.get(SUITE_SUNREY_ED25519_V1);
    assert.equal(known.ok, true);
    if (known.ok) {
      assert.equal(known.value.signatureAlgorithm, 'Ed25519');
      assert.equal(known.value.providerId, 'node-crypto-ed25519');
    }
    const unknown = registry.get('sunrey-unknown-suite');
    assert.equal(unknown.ok, false);
    if (!unknown.ok) {
      assert.equal(unknown.error.code, 'UNKNOWN_SUITE');
    }
  });

  it('does not treat Ed25519 and secp256k1 as interchangeable', () => {
    assert.match(SECP256K1_NOT_AN_ALIAS, /not interchangeable/);
    const catalog = createSecurityProviderCatalog();
    const secp = catalog.signature('Ed25519');
    assert.equal(secp.ok, true);
    const unknown = catalog.signature('ML-DSA-65');
    assert.equal(unknown.ok, true);
    if (unknown.ok) {
      assert.equal(unknown.value.providerId, 'noble-post-quantum-0.5.4');
    }
  });

  it('has no lifecycle mutation API for AI or models', () => {
    const registry = createDefaultCryptoSuiteRegistry();
    assert.equal('setLifecycle' in registry, false);
    assert.equal('updateSuite' in registry, false);
    assert.equal(CRYPTO_POLICY_MUTATION_API, null);
    assert.throws(() => {
      (registry as unknown as { suiteId?: string }).suiteId = 'mutated';
    });
  });
});

describe('suite signing and policy', () => {
  it('signs and verifies a registered Ed25519 suite', () => {
    const registry = createTestCryptoSuiteRegistry();
    const catalog = createSecurityProviderCatalog();
    const provider = createEd25519SignatureProvider();
    const key = provider.generateKey('TRANSACTION_SIGNING', SUITE_SUNREY_ED25519_V1);
    assert.equal(key.ok, true);
    if (!key.ok) return;
    const request = {
      registry,
      catalog,
      suiteId: SUITE_SUNREY_ED25519_V1,
      policy: policyBase(),
      publicKey: key.value.publicKey,
      privateKey: key.value.privateKey,
      payload: 'transfer-1',
      networkId: 'sunrey-sim',
      chainId: 'sunrey-sim-0',
      protocolVersion: 'sunrey-protocol-0',
      messageDomain: 'tx.v1',
    };
    const signed = signWithSuite(request);
    assert.equal(signed.ok, true);
    if (!signed.ok) return;
    const verified = verifyWithSuite({ ...request, signature: signed.value });
    assert.equal(verified.ok, true);
  });

  it('wrong key purpose fails', () => {
    const registry = createTestCryptoSuiteRegistry();
    const catalog = createSecurityProviderCatalog();
    const provider = createEd25519SignatureProvider();
    const key = provider.generateKey('WALLET_SIGNING', SUITE_SUNREY_ED25519_V1);
    assert.equal(key.ok, true);
    if (!key.ok) return;
    const signed = signWithSuite({
      registry,
      catalog,
      suiteId: SUITE_SUNREY_ED25519_V1,
      policy: policyBase(),
      publicKey: key.value.publicKey,
      privateKey: key.value.privateKey,
      payload: 'x',
      networkId: 'sunrey-sim',
      chainId: 'sunrey-sim-0',
      protocolVersion: 'sunrey-protocol-0',
      messageDomain: 'tx.v1',
    });
    assert.equal(signed.ok, false);
    if (!signed.ok) {
      assert.equal(signed.error.code, 'PURPOSE_MISMATCH');
    }
  });

  it('wrong domain fails', () => {
    const registry = createTestCryptoSuiteRegistry();
    const catalog = createSecurityProviderCatalog();
    const provider = createEd25519SignatureProvider();
    const key = provider.generateKey('TRANSACTION_SIGNING', SUITE_SUNREY_ED25519_V1);
    assert.equal(key.ok, true);
    if (!key.ok) return;
    const request = {
      registry,
      catalog,
      suiteId: SUITE_SUNREY_ED25519_V1,
      policy: policyBase(),
      publicKey: key.value.publicKey,
      privateKey: key.value.privateKey,
      payload: 'x',
      networkId: 'sunrey-sim',
      chainId: 'sunrey-sim-0',
      protocolVersion: 'sunrey-protocol-0',
      messageDomain: 'tx.v1',
    };
    const signed = signWithSuite(request);
    assert.equal(signed.ok, true);
    if (!signed.ok) return;
    const verified = verifyWithSuite({
      ...request,
      messageDomain: 'block.v1',
      signature: signed.value,
    });
    assert.equal(verified.ok, false);
    if (!verified.ok) {
      assert.equal(verified.error.code, 'BINDING_MISMATCH');
    }
  });

  it('wrong network fails', () => {
    const registry = createTestCryptoSuiteRegistry();
    const catalog = createSecurityProviderCatalog();
    const provider = createEd25519SignatureProvider();
    const key = provider.generateKey('TRANSACTION_SIGNING', SUITE_SUNREY_ED25519_V1);
    assert.equal(key.ok, true);
    if (!key.ok) return;
    const request = {
      registry,
      catalog,
      suiteId: SUITE_SUNREY_ED25519_V1,
      policy: policyBase(),
      publicKey: key.value.publicKey,
      privateKey: key.value.privateKey,
      payload: 'x',
      networkId: 'sunrey-sim',
      chainId: 'sunrey-sim-0',
      protocolVersion: 'sunrey-protocol-0',
      messageDomain: 'tx.v1',
    };
    const signed = signWithSuite(request);
    assert.equal(signed.ok, true);
    if (!signed.ok) return;
    const verified = verifyWithSuite({
      ...request,
      networkId: 'other-net',
      signature: signed.value,
    });
    assert.equal(verified.ok, false);
    if (!verified.ok) {
      assert.equal(verified.error.code, 'SIGNATURE_INVALID');
    }
  });

  it('downgrade attempt fails when hybrid is required', () => {
    const registry = createTestCryptoSuiteRegistry();
    const decision = evaluateCryptoPolicy(registry, {
      ...policyBase(),
      actorType: 'VALIDATOR',
      keyPurpose: 'VALIDATOR_CONSENSUS_SIGNING',
      suiteId: SUITE_SUNREY_ED25519_V1,
      migrationState: 'HYBRID_REQUIRED_SELECTED_ROLES',
      operation: 'SIGN',
    });
    assert.equal(decision.outcome, 'REQUIRE_HYBRID');
    const catalog = createSecurityProviderCatalog();
    const provider = createEd25519SignatureProvider();
    const key = provider.generateKey('VALIDATOR_CONSENSUS_SIGNING', SUITE_SUNREY_ED25519_V1);
    assert.equal(key.ok, true);
    if (!key.ok) return;
    const signed = signWithSuite({
      registry,
      catalog,
      suiteId: SUITE_SUNREY_ED25519_V1,
      policy: {
        ...policyBase(),
        actorType: 'VALIDATOR',
        keyPurpose: 'VALIDATOR_CONSENSUS_SIGNING',
        migrationState: 'HYBRID_REQUIRED_SELECTED_ROLES',
      },
      publicKey: key.value.publicKey,
      privateKey: key.value.privateKey,
      payload: 'vote',
      networkId: 'sunrey-sim',
      chainId: 'sunrey-sim-0',
      protocolVersion: 'sunrey-protocol-0',
      messageDomain: 'consensus.v1',
    });
    assert.equal(signed.ok, false);
    if (!signed.ok) {
      assert.equal(signed.error.code, 'DOWNGRADE_REJECTED');
    }
  });

  it('deprecated suite cannot create new signatures after policy cutoff', () => {
    const registry = createTestCryptoSuiteRegistry();
    const catalog = createSecurityProviderCatalog();
    const provider = createEd25519SignatureProvider();
    const key = provider.generateKey('TRANSACTION_SIGNING', SUITE_SUNREY_ED25519_DEPRECATED);
    assert.equal(key.ok, true);
    if (!key.ok) return;
    const signed = signWithSuite({
      registry,
      catalog,
      suiteId: SUITE_SUNREY_ED25519_DEPRECATED,
      policy: { ...policyBase(), height: 100 },
      publicKey: key.value.publicKey,
      privateKey: key.value.privateKey,
      payload: 'late',
      networkId: 'sunrey-sim',
      chainId: 'sunrey-sim-0',
      protocolVersion: 'sunrey-protocol-0',
      messageDomain: 'tx.v1',
    });
    assert.equal(signed.ok, false);
    if (!signed.ok) {
      assert.ok(signed.error.code === 'POLICY_REJECTED' || signed.error.code === 'SUITE_VERIFY_ONLY');
    }
  });

  it('verify-only suite verifies historical material but cannot originate', () => {
    const registry = createTestCryptoSuiteRegistry();
    const catalog = createSecurityProviderCatalog();
    const provider = createEd25519SignatureProvider();
    const key = provider.generateKey('TRANSACTION_SIGNING', SUITE_SUNREY_ED25519_VERIFY_ONLY);
    assert.equal(key.ok, true);
    if (!key.ok) return;
    const binding = createSignedBinding({
      networkId: 'sunrey-sim',
      chainId: 'sunrey-sim-0',
      protocolVersion: 'sunrey-protocol-0',
      algorithmId: 'Ed25519',
      suiteId: SUITE_SUNREY_ED25519_VERIFY_ONLY,
      keyPurpose: 'TRANSACTION_SIGNING',
      messageDomain: 'tx.v1',
      payload: 'historical',
    });
    const historical = provider.sign(key.value.privateKey, key.value.publicKey, binding);
    assert.equal(historical.ok, true);
    if (!historical.ok) return;
    const originate = signWithSuite({
      registry,
      catalog,
      suiteId: SUITE_SUNREY_ED25519_VERIFY_ONLY,
      policy: policyBase(),
      publicKey: key.value.publicKey,
      privateKey: key.value.privateKey,
      payload: 'historical',
      networkId: 'sunrey-sim',
      chainId: 'sunrey-sim-0',
      protocolVersion: 'sunrey-protocol-0',
      messageDomain: 'tx.v1',
    });
    assert.equal(originate.ok, false);
    if (!originate.ok) {
      assert.equal(originate.error.code, 'SUITE_VERIFY_ONLY');
    }
    const verified = verifyWithSuite({
      registry,
      catalog,
      suiteId: SUITE_SUNREY_ED25519_VERIFY_ONLY,
      policy: policyBase(),
      publicKey: key.value.publicKey,
      payload: 'historical',
      networkId: 'sunrey-sim',
      chainId: 'sunrey-sim-0',
      protocolVersion: 'sunrey-protocol-0',
      messageDomain: 'tx.v1',
      signature: historical.value,
    });
    assert.equal(verified.ok, true);
  });

  it('HMAC KeyProvider cannot sign validator purposes', () => {
    const keys = createSimulationKeyProvider();
    const result = keys.sign('VALIDATOR_CONSENSUS_SIGNING', 'vote');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'PURPOSE_MISMATCH');
    }
  });
});

describe('downgrade-resistant binding', () => {
  it('changing any bound field invalidates the signature', () => {
    const provider = createEd25519SignatureProvider();
    const key = provider.generateKey('TRANSACTION_SIGNING', SUITE_SUNREY_ED25519_V1);
    assert.equal(key.ok, true);
    if (!key.ok) return;
    const base = {
      networkId: 'sunrey-sim',
      chainId: 'sunrey-sim-0',
      protocolVersion: 'sunrey-protocol-0',
      algorithmId: 'Ed25519' as const,
      suiteId: SUITE_SUNREY_ED25519_V1,
      keyPurpose: 'TRANSACTION_SIGNING' as const,
      messageDomain: 'tx.v1',
      payload: 'canonical-body',
    };
    const binding = createSignedBinding(base);
    const signed = provider.sign(key.value.privateKey, key.value.publicKey, binding);
    assert.equal(signed.ok, true);
    if (!signed.ok) return;
    const mutations = [
      { networkId: 'other' },
      { chainId: 'other-chain' },
      { protocolVersion: 'sunrey-protocol-1' },
      { schemaVersion: 'other-schema' },
      { messageDomain: 'oracle.v1' },
      { payload: 'tampered-body' },
      { keyPurpose: 'ORACLE_SIGNING' as const },
      { suiteId: SUITE_SUNREY_HYBRID_SIM_V1 },
    ];
    for (const mutation of mutations) {
      const altered = createSignedBinding({ ...base, ...mutation });
      const verified = provider.verify(key.value.publicKey, altered, signed.value);
      assert.equal(verified.ok, false, `expected invalid after ${JSON.stringify(mutation)}`);
    }
  });
});

describe('hybrid CLASSICAL_AND_PQ', () => {
  it('REQUIRE_ALL fails if either signature fails', () => {
    const classical = createEd25519SignatureProvider();
    const pq = createSimulationPqSignatureProvider();
    const cKey = classical.generateKey('TRANSACTION_SIGNING', SUITE_SUNREY_HYBRID_SIM_V1);
    const pKey = pq.generateKey('TRANSACTION_SIGNING', SUITE_SUNREY_HYBRID_SIM_V1);
    assert.equal(cKey.ok && pKey.ok, true);
    if (!cKey.ok || !pKey.ok) return;
    const common = {
      suiteId: SUITE_SUNREY_HYBRID_SIM_V1,
      protocolVersion: 'sunrey-protocol-0',
      domain: 'tx.v1',
      networkId: 'sunrey-sim',
      chainId: 'sunrey-sim-0',
      payload: 'hybrid-body',
      verificationPolicy: 'REQUIRE_ALL' as const,
    };
    const envelope = signHybrid({
      ...common,
      classical: {
        provider: classical,
        publicKey: cKey.value.publicKey,
        privateKey: cKey.value.privateKey,
      },
      postQuantum: {
        provider: pq,
        publicKey: pKey.value.publicKey,
        privateKey: pKey.value.privateKey,
      },
    });
    assert.equal(envelope.ok, true);
    if (!envelope.ok) return;
    const ok = verifyHybrid({
      ...common,
      envelope: envelope.value,
      classicalProvider: classical,
      postQuantumProvider: pq,
    });
    assert.equal(ok.ok, true);

    const brokenClassical = {
      ...envelope.value,
      classicalSignature: { ...envelope.value.classicalSignature, signatureHex: '00'.repeat(64) },
    };
    const failClassical = verifyHybrid({
      ...common,
      envelope: brokenClassical,
      classicalProvider: classical,
      postQuantumProvider: pq,
    });
    assert.equal(failClassical.ok, false);
    if (!failClassical.ok) {
      assert.equal(failClassical.error.code, 'HYBRID_COMPONENT_INVALID');
    }

    const brokenPq = {
      ...envelope.value,
      postQuantumSignature: { ...envelope.value.postQuantumSignature, signatureHex: '11'.repeat(32) },
    };
    const failPq = verifyHybrid({
      ...common,
      envelope: brokenPq,
      classicalProvider: classical,
      postQuantumProvider: pq,
    });
    assert.equal(failPq.ok, false);
    if (!failPq.ok) {
      assert.equal(failPq.error.code, 'HYBRID_COMPONENT_INVALID');
    }
  });
});

describe('RFC 8032 Ed25519 test vectors', () => {
  it('verifies known RFC 8032 vectors through the Ed25519 provider', () => {
    const provider = createEd25519SignatureProvider();
    for (const vector of RFC8032_ED25519_VECTORS) {
      const message = Buffer.from(vector.messageHex, 'hex');
      const verified = provider.verifyRaw(vector.publicKeyHex, message, vector.signatureHex);
      assert.equal(verified.ok, true, vector.name);
    }
    const empty = RFC8032_ED25519_VECTORS[0];
    assert.ok(empty);
    const produced = provider.signRaw(
      empty.secretKeyHex,
      empty.publicKeyHex,
      Buffer.from(empty.messageHex, 'hex'),
    );
    assert.equal(produced.ok, true);
    if (!produced.ok) return;
    assert.equal(produced.value.toString('hex'), empty.signatureHex);
  });
});

describe('private key isolation', () => {
  it('private keys never serialize into evidence, events, or logs', () => {
    const provider = createEd25519SignatureProvider();
    const key = provider.generateKey('TRANSACTION_SIGNING', SUITE_SUNREY_ED25519_V1);
    assert.equal(key.ok, true);
    if (!key.ok) return;
    assert.equal(String(key.value.privateKey), '[REDACTED]');
    assert.equal(JSON.stringify(key.value.privateKey), '"[REDACTED]"');
    assert.equal(inspect(key.value.privateKey), '[REDACTED]');

    const event = {
      kind: 'security.key.created',
      publicKey: key.value.publicKey,
      privateKey: key.value.privateKey,
    };
    const leak = assertNoPrivateKeyMaterial(event, 'events');
    assert.equal(leak.ok, false);
    if (!leak.ok) {
      assert.equal(leak.error.code, 'PRIVATE_KEY_LEAKAGE');
    }

    const evidence = { kind: 'EVIDENCE', publicKey: key.value.publicKey };
    assert.equal(assertNoPrivateKeyMaterial(evidence, 'evidence').ok, true);
    assert.match(safePublicLog(evidence), /publicKeyHex/);

    const secret = key.value.privateKey.reveal().toString('hex');
    assert.equal(rejectErrorWithSecret(`boom ${secret}`, secret).includes(secret), false);
    assert.equal(findPrivateKeyLeakage({ sk: 'abc' }).length > 0, true);
  });
});

describe('provider and PQ ports', () => {
  it('standardized PQ algorithm IDs are registered for development/testnet only', () => {
    const catalog = createSecurityProviderCatalog();
    const present = catalog.signature('ML_DSA_65_V1');
    assert.equal(present.ok, true);
    assert.equal(PQC_LIBRARY_SELECTION.status, 'SELECTED_FOR_DEVELOPMENT_AND_TESTNET');
    assert.equal(PQC_LIBRARY_SELECTION.productionStatus, 'NOT_SELECTED_FOR_PRODUCTION');
    assert.equal(PQC_LIBRARY_SELECTION.notQuantumProof, true);
    assert.equal(PQC_LIBRARY_SELECTION.notCertified, true);
    assert.equal(PQC_LIBRARY_SELECTION.notMainnet, true);
    const testnet = evaluateCryptoPolicy(createDefaultCryptoSuiteRegistry(), {
      ...policyBase(),
      suiteId: SUITE_SUNREY_MLDSA_65_V1,
      environment: 'test',
      operation: 'SIGN',
    });
    assert.equal(testnet.outcome, 'ALLOW');
    const production = evaluateCryptoPolicy(createDefaultCryptoSuiteRegistry(), {
      ...policyBase(),
      suiteId: SUITE_SUNREY_MLDSA_65_V1,
      environment: 'production',
      operation: 'SIGN',
    });
    assert.equal(production.outcome, 'REJECT');
  });

  it('direct algorithm instantiation outside providers is guarded', () => {
    assert.throws(() => new Ed25519SignatureProvider(Symbol('not-the-permit')));
    const files = walk(join(REPO_ROOT, 'packages'));
    const forbidden = files.filter((file) => {
      if (file.includes('/security/src/ed25519-provider.ts')) return false;
      if (file.includes('/security/src/pq-simulation-provider.ts')) return false;
      if (file.includes('/security/src/pq-provider.ts')) return false;
      if (file.includes('.test.ts')) return false;
      const source = readFileSync(file, 'utf8');
      return /generateKeyPairSync\(\s*['"]ed25519['"]/.test(source);
    });
    assert.deepEqual(forbidden, []);
  });

  it('AI cannot change crypto policy', () => {
    const registry = createDefaultCryptoSuiteRegistry();
    const first = evaluateCryptoPolicy(registry, {
      ...policyBase(),
      suiteId: SUITE_SUNREY_ED25519_V1,
      operation: 'SIGN',
    });
    assert.equal(first.outcome, 'ALLOW');
    assert.equal(CRYPTO_POLICY_MUTATION_API, null);
    assert.ok(CRYPTO_MIGRATION_STATES.includes('CLASSICAL_ONLY'));
    const second = evaluateCryptoPolicy(registry, {
      ...policyBase(),
      suiteId: SUITE_SUNREY_ED25519_V1,
      operation: 'SIGN',
    });
    assert.deepEqual(second, first);
  });
});

describe('benchmarks record measurements only', () => {
  it('runs the harness and records sizes from this host', () => {
    const rows = runCryptoBenchmarks();
    const edSign = rows.find((row) => row.algorithm === 'Ed25519' && row.operation === 'sign');
    assert.ok(edSign);
    assert.equal(edSign?.signatureBytes, 64);
    assert.equal(edSign?.elapsedMs !== undefined, true);
    const sim = rows.find((row) => row.algorithm === 'SIMULATION-ML-DSA-65');
    assert.match(sim?.note ?? '', /NOT ML-DSA/);
    const real = rows.find((row) => row.algorithm === 'ML_DSA_65_V1' && row.operation === 'sign');
    assert.equal(real?.signatureBytes, 3309);
    assert.match(real?.note ?? '', /FIPS 204/);
    assert.ok(CRYPTOGRAPHIC_INVENTORY.some((row) => row.id === 'execution-authority'));
    assert.equal(existsSync(join(REPO_ROOT, 'docs/security/cryptographic-inventory.md')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/security/cryptographic-inventory.json')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'docs/security/sunrey-blockchain-threat-model.md')), true);
  });
});

describe('competing cryptographic roots remain forbidden', () => {
  it('does not create parallel crypto packages', () => {
    assert.equal(existsSync(join(REPO_ROOT, 'packages/security')), true);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/quantum-security')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/crypto-v2')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/pqc-core')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/crypto-agility')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/post-quantum')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/blockchain-crypto')), false);
    assert.equal(existsSync(join(REPO_ROOT, 'packages/security-v2')), false);
  });
});

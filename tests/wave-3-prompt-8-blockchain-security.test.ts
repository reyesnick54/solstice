// @ts-nocheck
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  SIGNATURE_DOMAINS,
  createBlockchainKeyProvider,
  createEd25519SignatureProvider,
  createMlDsa65Provider,
  createSecurityProviderCatalog,
  decodeHybridComponent,
  encodeHybridComponent,
  encodeSignatureDomainCommit,
  runCryptoBenchmarks,
  SUITE_SUNREY_ED25519_V1,
  SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1,
} from '../packages/security/src/index.ts';
import {
  assertReplayProtection,
  CANONICAL_VALIDATOR_SUITE_ID,
  createDevelopmentValidatorSigner,
  developmentKeyLabel,
  developmentSeedFromLabel,
  DurableSignerSafety,
  HYBRID_VALIDATOR_SUITE_ID,
  nodeIdentitySeparationReport,
  PRODUCTION_VALIDATOR_CRYPTO_DEFAULTS,
  replayProtectionFields,
  safetyPath,
  serializeValidatorSignedEnvelope,
  deserializeValidatorSignedEnvelope,
  ValidatorKeyLifecycleManager,
  ValidatorSigningService,
  validatorKeyMetadata,
  verifyConsensusBytes,
  type ConsensusSignRequest,
} from '../packages/sunrey-chain/src/validators/index.ts';
const ROOT = join(import.meta.dirname, '..');
const NOW = '2026-08-31T15:00:00.000Z';

function consensusRequest(overrides: Partial<ConsensusSignRequest> = {}): ConsensusSignRequest {
  return {
    validatorId: 'val_dev_a',
    networkId: 'net_sunrey_local_dev',
    chainId: 'chn_sunrey_local_dev',
    protocolVersion: '1',
    messageType: 'PREVOTE',
    height: 10n,
    round: 1n,
    blockId: 'block_abc',
    validatorSetVersion: 1n,
    cryptoSuiteId: CANONICAL_VALIDATOR_SUITE_ID,
    ...overrides,
  };
}

function buildLifecycle(seedHex: string, keyIdValue: string) {
  const provider = createEd25519SignatureProvider();
  const derived = provider.fromSeed(
    seedHex,
    'VALIDATOR_CONSENSUS_SIGNING',
    SUITE_SUNREY_ED25519_V1,
    keyIdValue,
  );
  assert.equal(derived.ok, true);
  if (!derived.ok) return null;
  const lifecycle = new ValidatorKeyLifecycleManager();
  lifecycle.register({
    metadata: validatorKeyMetadata({
      keyId: keyIdValue,
      purpose: 'VALIDATOR_CONSENSUS_SIGNING',
      algorithm: 'Ed25519',
      version: 1,
      status: 'ACTIVE',
      provider: 'test',
      publicKeyHex: derived.value.publicKey.publicKeyHex,
      atUtc: NOW,
    }),
    publicKey: derived.value.publicKey,
  });
  return { lifecycle, publicKey: derived.value.publicKey };
}

describe('Wave 3 Prompt 8 — blockchain security', () => {
  it('1. documents validator signing architecture', () => {
    assert.equal(existsSync(join(ROOT, 'docs/security/sunrey-blockchain-cryptography.md')), true);
    assert.equal(existsSync(join(ROOT, 'packages/security/src/signature-domains.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/security/src/blockchain-key-provider.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain/src/validators/signing-service.ts')), true);
  });

  it('2. domain separation uses deterministic encoding', () => {
    const payload = Buffer.from('consensus-vote', 'utf8');
    const a = encodeSignatureDomainCommit(SIGNATURE_DOMAINS.CONSENSUS_PREVOTE, payload);
    const b = encodeSignatureDomainCommit(SIGNATURE_DOMAINS.CONSENSUS_PREVOTE, payload);
    assert.deepEqual(a, b);
    const c = encodeSignatureDomainCommit(SIGNATURE_DOMAINS.CONSENSUS_PRECOMMIT, payload);
    assert.notDeepEqual(a, c);
  });

  it('3. valid validator signature produces envelope', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sunrey-p8-'));
    try {
      const seed = developmentSeedFromLabel(developmentKeyLabel('A', 'consensus')).toString('hex');
      const built = buildLifecycle(seed, 'val-dev-a-consensus');
      assert.ok(built);
      const safety = new DurableSignerSafety(safetyPath(dir, 'val_dev_a', 'chn_sunrey_local_dev'));
      const service = new ValidatorSigningService({
        validatorId: 'val_dev_a',
        keyId: 'val-dev-a-consensus',
        seedHex: seed,
        suiteId: CANONICAL_VALIDATOR_SUITE_ID,
        signerSafety: safety,
        keyLifecycle: built.lifecycle,
        controllerKind: 'HUMAN',
        nowUtc: NOW,
      });
      const signed = service.sign(consensusRequest());
      assert.equal(signed.ok, true);
      if (!signed.ok) return;
      assert.equal(signed.value.signerId, 'val_dev_a');
      assert.equal(signed.value.domain, SIGNATURE_DOMAINS.CONSENSUS_PREVOTE);
      assert.equal(signed.value.keyId, 'val-dev-a-consensus');
      assert.equal(signed.value.signatureHex.length > 0, true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('4. invalid signature fails verification', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sunrey-p8-'));
    try {
      const seed = developmentSeedFromLabel(developmentKeyLabel('A', 'consensus')).toString('hex');
      const built = buildLifecycle(seed, 'val-dev-a-consensus');
      assert.ok(built);
      const safety = new DurableSignerSafety(safetyPath(dir, 'val_dev_a', 'chn_sunrey_local_dev'));
      const service = new ValidatorSigningService({
        validatorId: 'val_dev_a',
        keyId: 'val-dev-a-consensus',
        seedHex: seed,
        suiteId: CANONICAL_VALIDATOR_SUITE_ID,
        signerSafety: safety,
        keyLifecycle: built.lifecycle,
        controllerKind: 'HUMAN',
        nowUtc: NOW,
      });
      const signed = service.sign(consensusRequest());
      assert.equal(signed.ok, true);
      if (!signed.ok) return;
      const tampered = { ...signed.value, signatureHex: `${signed.value.signatureHex.slice(0, -2)}00` };
      const verified = service.verify({
        envelope: tampered,
        publicKeyHex: built.publicKey.publicKeyHex,
      });
      assert.equal(verified.ok, false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('5. wrong signer public key fails verification', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sunrey-p8-'));
    try {
      const seedA = developmentSeedFromLabel(developmentKeyLabel('A', 'consensus')).toString('hex');
      const seedB = developmentSeedFromLabel(developmentKeyLabel('B', 'consensus')).toString('hex');
      const builtA = buildLifecycle(seedA, 'val-dev-a-consensus');
      const builtB = buildLifecycle(seedB, 'val-dev-b-consensus');
      assert.ok(builtA && builtB);
      const safety = new DurableSignerSafety(safetyPath(dir, 'val_dev_a', 'chn_sunrey_local_dev'));
      const service = new ValidatorSigningService({
        validatorId: 'val_dev_a',
        keyId: 'val-dev-a-consensus',
        seedHex: seedA,
        suiteId: CANONICAL_VALIDATOR_SUITE_ID,
        signerSafety: safety,
        keyLifecycle: builtA.lifecycle,
        controllerKind: 'HUMAN',
        nowUtc: NOW,
      });
      const signed = service.sign(consensusRequest());
      assert.equal(signed.ok, true);
      if (!signed.ok) return;
      const verified = service.verify({
        envelope: signed.value,
        publicKeyHex: builtB.publicKey.publicKeyHex,
      });
      assert.equal(verified.ok, false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('6. wrong domain in replay check fails', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sunrey-p8-'));
    try {
      const seed = developmentSeedFromLabel(developmentKeyLabel('A', 'consensus')).toString('hex');
      const built = buildLifecycle(seed, 'val-dev-a-consensus');
      assert.ok(built);
      const safety = new DurableSignerSafety(safetyPath(dir, 'val_dev_a', 'chn_sunrey_local_dev'));
      const service = new ValidatorSigningService({
        validatorId: 'val_dev_a',
        keyId: 'val-dev-a-consensus',
        seedHex: seed,
        suiteId: CANONICAL_VALIDATOR_SUITE_ID,
        signerSafety: safety,
        keyLifecycle: built.lifecycle,
        controllerKind: 'HUMAN',
        nowUtc: NOW,
      });
      const signed = service.sign(consensusRequest());
      assert.equal(signed.ok, true);
      if (!signed.ok) return;
      const observed = replayProtectionFields(signed.value);
      const replay = assertReplayProtection(observed, {
        ...observed,
        domain: SIGNATURE_DOMAINS.CONSENSUS_PRECOMMIT,
      });
      assert.equal(replay.ok, false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('7. wrong chain fails replay protection', () => {
    const observed = {
      networkId: 'net_sunrey_local_dev',
      chainId: 'chn_sunrey_local_dev',
      height: 10n,
      round: 1n,
      validatorSetVersion: 1n,
      domain: SIGNATURE_DOMAINS.CONSENSUS_PREVOTE,
      signerId: 'val_dev_a',
    };
    const replay = assertReplayProtection(observed, { ...observed, chainId: 'chn_other' });
    assert.equal(replay.ok, false);
  });

  it('8. replayed message at different height fails', () => {
    const observed = {
      networkId: 'net_sunrey_local_dev',
      chainId: 'chn_sunrey_local_dev',
      height: 10n,
      round: 1n,
      validatorSetVersion: 1n,
      domain: SIGNATURE_DOMAINS.CONSENSUS_PREVOTE,
      signerId: 'val_dev_a',
    };
    const replay = assertReplayProtection(observed, { ...observed, height: 11n });
    assert.equal(replay.ok, false);
  });

  it('9. revoked key cannot sign', () => {
    const seed = developmentSeedFromLabel(developmentKeyLabel('A', 'consensus')).toString('hex');
    const built = buildLifecycle(seed, 'val-dev-a-consensus');
    assert.ok(built);
    const revoked = built.lifecycle.revoke({
      keyId: 'val-dev-a-consensus',
      version: 1,
      atUtc: NOW,
      reason: 'compromise drill',
    });
    assert.equal(revoked.ok, true);
    const attempt = built.lifecycle.assertCanSign('val-dev-a-consensus');
    assert.equal(attempt.ok, false);
  });

  it('10. pending key cannot sign', () => {
    const seed = developmentSeedFromLabel(developmentKeyLabel('A', 'consensus')).toString('hex');
    const provider = createEd25519SignatureProvider();
    const derived = provider.fromSeed(seed, 'VALIDATOR_CONSENSUS_SIGNING', SUITE_SUNREY_ED25519_V1, 'pending');
    assert.equal(derived.ok, true);
    if (!derived.ok) return;
    const lifecycle = new ValidatorKeyLifecycleManager();
    lifecycle.register({
      metadata: validatorKeyMetadata({
        keyId: 'pending-key',
        purpose: 'VALIDATOR_CONSENSUS_SIGNING',
        algorithm: 'Ed25519',
        version: 2,
        status: 'PENDING',
        provider: 'test',
        publicKeyHex: derived.value.publicKey.publicKeyHex,
        atUtc: NOW,
      }),
      publicKey: derived.value.publicKey,
    });
    const attempt = lifecycle.assertCanSign('pending-key');
    assert.equal(attempt.ok, false);
  });

  it('11. rotated key: deprecated still verifies, active signs', () => {
    const seed = developmentSeedFromLabel(developmentKeyLabel('A', 'consensus')).toString('hex');
    const provider = createEd25519SignatureProvider();
    const v1 = provider.fromSeed(seed, 'VALIDATOR_CONSENSUS_SIGNING', SUITE_SUNREY_ED25519_V1, 'rotate-v1');
    const v2Seed = developmentSeedFromLabel(developmentKeyLabel('B', 'consensus')).toString('hex');
    const v2 = provider.fromSeed(v2Seed, 'VALIDATOR_CONSENSUS_SIGNING', SUITE_SUNREY_ED25519_V1, 'rotate-v2');
    assert.equal(v1.ok && v2.ok, true);
    if (!v1.ok || !v2.ok) return;
    const lifecycle = new ValidatorKeyLifecycleManager();
    lifecycle.register({
      metadata: validatorKeyMetadata({
        keyId: 'rotate-key',
        purpose: 'VALIDATOR_CONSENSUS_SIGNING',
        algorithm: 'Ed25519',
        version: 1,
        status: 'ACTIVE',
        provider: 'test',
        publicKeyHex: v1.value.publicKey.publicKeyHex,
        atUtc: NOW,
      }),
      publicKey: v1.value.publicKey,
    });
    const rotation = lifecycle.beginRotation({
      keyId: 'rotate-key',
      successor: {
        metadata: validatorKeyMetadata({
          keyId: 'rotate-key',
          purpose: 'VALIDATOR_CONSENSUS_SIGNING',
          algorithm: 'Ed25519',
          version: 2,
          status: 'PENDING',
          provider: 'test',
          publicKeyHex: v2.value.publicKey.publicKeyHex,
          atUtc: NOW,
        }),
        publicKey: v2.value.publicKey,
      },
      atUtc: NOW,
      reason: 'scheduled rotation',
    });
    assert.equal(rotation.ok, true);
    const oldVerify = lifecycle.assertCanVerify('rotate-key', 1);
    assert.equal(oldVerify.ok, true);
    const newSign = lifecycle.assertCanSign('rotate-key');
    assert.equal(newSign.ok, false);
    const activated = lifecycle.activate({ keyId: 'rotate-key', version: 2, atUtc: NOW });
    assert.equal(activated.ok, true);
    const newSignAfter = lifecycle.assertCanSign('rotate-key');
    assert.equal(newSignAfter.ok, true);
  });

  it('12. unsupported algorithm / suite fails closed', () => {
    const catalog = createSecurityProviderCatalog();
    const seed = developmentSeedFromLabel(developmentKeyLabel('A', 'consensus')).toString('hex');
    const signer = createDevelopmentValidatorSigner({
      seedHex: seed,
      suiteId: CANONICAL_VALIDATOR_SUITE_ID,
      catalog,
    });
    const request = consensusRequest({ cryptoSuiteId: 'unknown-suite-v99' });
    const result = signer.sign(request);
    assert.equal(result.ok, false);
  });

  it('13. malformed hybrid signature fails verification', () => {
    const catalog = createSecurityProviderCatalog();
    const seed = developmentSeedFromLabel(developmentKeyLabel('A', 'consensus')).toString('hex');
    const bytes = Buffer.from('vote-bytes');
    const ok = verifyConsensusBytes(catalog, HYBRID_VALIDATOR_SUITE_ID, 'deadbeef', bytes, 'not-hybrid');
    assert.equal(ok, false);
  });

  it('14. one valid + one invalid hybrid component fails', () => {
    const catalog = createSecurityProviderCatalog();
    const seed = developmentSeedFromLabel(developmentKeyLabel('A', 'consensus')).toString('hex');
    const ed = createEd25519SignatureProvider();
    const pq = createMlDsa65Provider();
    const classical = ed.fromSeed(seed, 'VALIDATOR_CONSENSUS_SIGNING', SUITE_SUNREY_ED25519_V1, 'hyb');
  const pqKey = pq.fromSeed(`${seed}pq`, 'VALIDATOR_CONSENSUS_SIGNING', SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1, 'hyb-pq');
    assert.equal(classical.ok && pqKey.ok, true);
    if (!classical.ok || !pqKey.ok) return;
    const bytes = Buffer.from('hybrid-vote');
    const cSig = ed.signRaw(classical.value.privateKey.reveal().toString('hex'), classical.value.publicKey.publicKeyHex, bytes);
    assert.equal(cSig.ok, true);
    if (!cSig.ok) return;
    const badHybrid = encodeHybridComponent(cSig.value.toString('hex'), '00'.repeat(64));
    const pub = encodeHybridComponent(classical.value.publicKey.publicKeyHex, pqKey.value.publicKey.publicKeyHex);
    const verified = verifyConsensusBytes(catalog, HYBRID_VALIDATOR_SUITE_ID, pub, bytes, badHybrid);
    assert.equal(verified, false);
  });

  it('15. unknown KeyId fails lifecycle lookup', () => {
    const lifecycle = new ValidatorKeyLifecycleManager();
    const attempt = lifecycle.assertCanSign('does-not-exist');
    assert.equal(attempt.ok, false);
  });

  it('16. deterministic envelope serialization round-trip', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sunrey-p8-'));
    try {
      const seed = developmentSeedFromLabel(developmentKeyLabel('A', 'consensus')).toString('hex');
      const built = buildLifecycle(seed, 'val-dev-a-consensus');
      assert.ok(built);
      const safety = new DurableSignerSafety(safetyPath(dir, 'val_dev_a', 'chn_sunrey_local_dev'));
      const service = new ValidatorSigningService({
        validatorId: 'val_dev_a',
        keyId: 'val-dev-a-consensus',
        seedHex: seed,
        suiteId: CANONICAL_VALIDATOR_SUITE_ID,
        signerSafety: safety,
        keyLifecycle: built.lifecycle,
        controllerKind: 'HUMAN',
        nowUtc: NOW,
      });
      const signed = service.sign(consensusRequest());
      assert.equal(signed.ok, true);
      if (!signed.ok) return;
      const serialized = serializeValidatorSignedEnvelope(signed.value);
      const parsed = deserializeValidatorSignedEnvelope(serialized);
      assert.equal(parsed.ok, true);
      if (!parsed.ok) return;
      assert.equal(parsed.value.signBytesHash, signed.value.signBytesHash);
      assert.equal(parsed.value.signatureHex, signed.value.signatureHex);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('17. secure-store failure: production rejects development backend', () => {
    const provider = createBlockchainKeyProvider({
      environment: 'production',
      configuredBackend: 'DEVELOPMENT_SOFTWARE',
    });
    const sign = provider.sign({
      purpose: 'VALIDATOR_CONSENSUS_SIGNING',
      keyId: 'any',
      domain: SIGNATURE_DOMAINS.CONSENSUS_PREVOTE,
      payload: Buffer.from('x'),
      networkId: 'n',
      chainId: 'c',
      protocolVersion: '1',
    });
    assert.equal(sign.ok, false);
    if (sign.ok) return;
    assert.match(sign.error.message, /forbidden in production/i);
  });

  it('18. no insecure production fallback for KMS_HSM port', () => {
    const provider = createBlockchainKeyProvider({
      environment: 'production',
      configuredBackend: 'KMS_HSM',
    });
    assert.equal(provider.productionCapable, true);
    const sign = provider.sign({
      purpose: 'VALIDATOR_CONSENSUS_SIGNING',
      keyId: 'any',
      domain: SIGNATURE_DOMAINS.CONSENSUS_PREVOTE,
      payload: Buffer.from('x'),
      networkId: 'n',
      chainId: 'c',
      protocolVersion: '1',
    });
    assert.equal(sign.ok, false);
  });

  it('19. production defaults remain CLASSICAL_ONLY', () => {
    assert.equal(PRODUCTION_VALIDATOR_CRYPTO_DEFAULTS.migrationState, 'CLASSICAL_ONLY');
    assert.equal(PRODUCTION_VALIDATOR_CRYPTO_DEFAULTS.hybridEnabled, false);
    assert.equal(PRODUCTION_VALIDATOR_CRYPTO_DEFAULTS.developmentSoftwareBackendAllowed, false);
  });

  it('20. node identity is separated from validator consensus key', () => {
    const report = nodeIdentitySeparationReport();
    assert.equal(report.conflated, false);
    assert.equal(report.consensusKeyPurpose, 'VALIDATOR_CONSENSUS_SIGNING');
    assert.equal(report.nodeIdentityPurpose, 'P2P_IDENTITY');
  });

  it('21. hybrid encoding rejects delimiter injection', () => {
    assert.throws(() => encodeHybridComponent('aa:bb', 'cc'));
    const decoded = decodeHybridComponent('srhyb1:aa:cc');
    assert.equal(decoded.ok, true);
  });

  it('22. crypto benchmarks produce rows for implemented algorithms', () => {
    const rows = runCryptoBenchmarks();
    assert.ok(rows.length >= 5);
    const algorithms = new Set(rows.map((row) => row.algorithm));
    assert.ok(algorithms.has('Ed25519'));
    assert.ok(algorithms.has('ML_DSA_65_V1') || algorithms.has('CLASSICAL_AND_PQ'));
  });

  it('23. secret hygiene: no committed PEM private keys in production paths', () => {
    const forbiddenPatterns = [/BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/];
    const scanDirs = [
      join(ROOT, 'packages/sunrey-chain/src'),
      join(ROOT, 'packages/security/src'),
      join(ROOT, 'services'),
    ];
    for (const dir of scanDirs) {
      for (const file of walkTsFiles(dir)) {
        if (file.includes('.test.') || file.includes('/test/')) {
          continue;
        }
        const content = readFileSync(file, 'utf8');
        for (const pattern of forbiddenPatterns) {
          assert.equal(pattern.test(content), false, `possible private key material in ${file}`);
        }
      }
    }
  });
});

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      out.push(...walkTsFiles(path));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      out.push(path);
    }
  }
  return out;
}

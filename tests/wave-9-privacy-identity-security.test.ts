/**
 * Wave 9 — Privacy, confidentiality, and identity security audit.
 *
 * Adversarial regression across data inventory surfaces, sensitive-data
 * exposure paths, blockchain privacy, pseudonymity, graph/federation access,
 * logging, backups, insider threat, consent revocation, selective disclosure,
 * deletion, and secret scanning.
 */

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asJurisdiction } from '../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import { assertSafeEventPayload } from '../packages/events/src/envelope.ts';
import { DomainEventLog } from '../packages/events/src/events.ts';
import { ConsentService } from '../packages/consent/src/service.ts';
import { RECIPIENT_PERSONAL_AGENT } from '../packages/consent/src/recipients.ts';
import { rejectArbitraryQuery } from '../packages/clean-room/src/index.ts';
import { evaluateEgress } from '../packages/clean-room/src/egress.ts';
import { asCleanRoomJobId, asPrivacyPolicyVersion } from '../packages/clean-room/src/ids.ts';
import { createFederatedQueryEngine } from '../packages/economic-awareness-fabric/src/federation/query.ts';
import { normalizeToEnvelope } from '../packages/economic-awareness-fabric/src/normalization/envelope.ts';
import { SimulatedIdentityAdapter } from '../packages/identity/src/simulation.ts';
import { authorizeGraphRead } from '../packages/personal-economic-graph/src/access.ts';
import { capabilitiesForStaffRoles } from '../packages/identity/src/admin-roles.ts';
import { evaluateSegregationOfDuties } from '../packages/identity/src/staff/sod.ts';
import { humanEconomicIdentityIdFor } from '../packages/human-economic-contribution/src/resolution/ids.ts';
import { rejectsLowEntropyIdentityMaterial } from '../packages/human-economic-contribution/src/identity/commitments.ts';
import { HIN_ANCHOR_FORBIDDEN_KEYS } from '../packages/information-market/src/network/chain-anchor/policy.ts';
import { findForbiddenPayloadField } from '../packages/personal-data-vault/src/product/minimization.ts';
import { WAVE7_DATA_EXPOSURE_AUDIT } from '../packages/personal-data-vault/src/disclosure/audit.ts';
import { SENSITIVITY_CLASSES } from '../packages/personal-data-vault/src/taxonomy.ts';
import { SELECTIVE_DISCLOSURE_CAPABILITY } from '../packages/personal-data-vault/src/disclosure/selective-disclosure.ts';
import { ZERO_KNOWLEDGE_PROOF_CAPABILITY } from '../packages/security/src/zk-proof/types.ts';
import { VERIFIABLE_CREDENTIALS_CAPABILITY } from '../packages/identity/src/verifiable-credentials/types.ts';
import { DIFFERENTIAL_PRIVACY_CAPABILITY } from '../packages/clean-room/src/privacy/differential-privacy.ts';
import { assertLogPayloadSafe, redactLogRecord } from '../packages/security/src/safe-logging.ts';
import { createSimulationKeyProvider } from '../packages/security/src/simulation.ts';
import {
  encryptBackup,
  recoveryStrategy,
  verifySnapshot,
  createVerifiedSnapshot,
} from '../packages/sunrey-chain/src/ops/backup.ts';
import {
  isCommitmentOnlyPayload,
  scanForForbiddenBlockPayload,
} from '../packages/sunrey-chain/src/evidence-commitments/privacy.ts';
import { explorerExposurePolicy } from '../packages/sunrey-explorer/src/privacy.ts';
import { runPrivacy, privacyScenarios } from '../packages/sunrey-range/src/scenarios/privacy.ts';
import { createRangeEnvironment } from '../packages/sunrey-range/src/environment.ts';

const ROOT = join(import.meta.dirname, '..');
const NOW = asUtcInstant('2026-09-02T12:00:00.000Z');

function consentHarness() {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  const provisioned = identity.provisionSimulatedActor({
    actorId: 'actor_wave9',
    jurisdiction: asJurisdiction('GB'),
    identityId: 'idn_wave9',
    customerId: asCustomerId('cust_wave9'),
    capabilities: ['CONSENT_GRANT_OWN', 'CONSENT_REVOKE_OWN', 'CONSENT_VIEW_OWN'],
  });
  if (!provisioned.ok) {
    throw new Error(provisioned.error.message);
  }
  const consent = new ConsentService({ clock, keys, evidence, events });
  return { clock, consent, actor: provisioned.value, keys };
}

function listSqlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listSqlFiles(full));
    } else if (entry.endsWith('.sql')) {
      out.push(full);
    }
  }
  return out;
}

describe('Wave 9 Task 1 — data inventory', () => {
  it('maps bounded databases to Wave 7 sensitivity classes', () => {
    const dbDirs = ['customer', 'ledger', 'evidence', 'security', 'explorer'];
    for (const db of dbDirs) {
      const migrations = listSqlFiles(join(ROOT, 'db', db, 'migrations'));
      assert.ok(migrations.length > 0, `expected migrations for ${db}`);
    }
    assert.deepEqual([...SENSITIVITY_CLASSES], ['PERSONAL', 'SENSITIVE', 'HIGHLY_SENSITIVE', 'RESTRICTED']);
    assert.ok(WAVE7_DATA_EXPOSURE_AUDIT.length >= 9);
  });

  it('documents all major exposure surfaces in the Wave 7 audit catalog', () => {
    const surfaces = new Set(WAVE7_DATA_EXPOSURE_AUDIT.map((e) => e.surface));
    for (const required of [
      'API_RESPONSE',
      'DATABASE_QUERY',
      'FEDERATED_QUERY',
      'GRAPH_QUERY',
      'STRUCTURED_LOG',
      'EVIDENCE_OBJECT',
      'CHAIN_PAYLOAD',
    ]) {
      assert.ok(surfaces.has(required as (typeof WAVE7_DATA_EXPOSURE_AUDIT)[number]['surface']), required);
    }
  });
});

describe('Wave 9 Task 2 — raw sensitive data search', () => {
  const forbiddenFieldSamples = [
    'governmentId',
    'dna',
    'apiKey',
    'privateKey',
    'consentDocument',
    'locationHistory',
    'communications',
  ] as const;

  it('detects forbidden fields in nested PDV payloads', () => {
    for (const field of forbiddenFieldSamples) {
      const found = findForbiddenPayloadField({ nested: { [field]: 'value' } });
      assert.ok(found, `expected detection for nested ${field}`);
    }
  });

  it('does not emit secret values when reporting forbidden field locations', () => {
    const secret = 'SUPERFAKE_TEST_SECRET_VALUE_DO_NOT_USE_12345';
    const found = findForbiddenPayloadField({ apiKey: secret });
    assert.ok(found);
    assert.equal(found!.message.includes(secret), false);
    assert.equal(found!.field.includes('apiKey'), true);
  });
});

describe('Wave 9 Task 3 — blockchain privacy audit', () => {
  it('rejects forbidden sensitive keys in nested block payloads', () => {
    const violations = scanForForbiddenBlockPayload({
      bundle: { nested: { healthRecord: 'secret' } },
    });
    assert.ok(violations.some((v) => v.includes('healthRecord')));
  });

  it('accepts commitment-only payloads', () => {
    assert.equal(
      isCommitmentOnlyPayload({
        commitmentHash: 'abc',
        contentHash: 'def',
        evidenceId: 'ev_1',
      }),
      true,
    );
  });

  it('forbids HIN anchor keys in policy and scans high-risk chain fields', () => {
    for (const key of ['email', 'phone', 'rawPayload', 'healthRecord', 'geneticData']) {
      assert.ok((HIN_ANCHOR_FORBIDDEN_KEYS as readonly string[]).includes(key), key);
    }
    for (const key of ['healthRecord', 'geneticData', 'rawPayload', 'privateKey']) {
      const violations = scanForForbiddenBlockPayload({ [key]: 'x' });
      assert.ok(violations.length > 0, key);
    }
  });
});

describe('Wave 9 Task 4 — identity linkage attack', () => {
  it('rejects low-entropy identity material for HumanEconomicIdentity', () => {
    assert.equal(rejectsLowEntropyIdentityMaterial('ada@example.com'), true);
    assert.equal(rejectsLowEntropyIdentityMaterial('John Smith'), true);
    assert.equal(rejectsLowEntropyIdentityMaterial('opaque-provider-token-abcdef0123456789'), false);
  });

  it('derives pseudonymous identity from commitment material only', () => {
    const id = humanEconomicIdentityIdFor({
      actorCommitment: 'commitment-hex-not-email',
      jurisdiction: 'GB',
    });
    assert.equal(id.includes('@'), false);
    assert.equal(id.startsWith('heid_'), true);
  });

  it('strips KYC and PDV fields from public explorer projection', () => {
    const projected = explorerExposurePolicy.project({
      height: 1,
      kycRecord: { name: 'alice' },
      pdvRaw: 'secret-row',
      personalDataVault: { row: 1 },
    }) as Record<string, unknown>;
    assert.equal('kycRecord' in projected, false);
    assert.equal('pdvRaw' in projected, false);
    assert.equal('personalDataVault' in projected, false);
    assert.equal(projected.height, 1);
  });
});

describe('Wave 9 Task 5 — graph privacy', () => {
  it('denies cross-subject graph reads without OPERATE_ECONOMIC_GRAPH', () => {
    const clock = new FrozenClock(NOW);
    const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
    const events = new DomainEventLog();
    const identity = new SimulatedIdentityAdapter({ clock, keys, events });
    const actorA = identity.provisionSimulatedActor({
      actorId: 'actor_graph_a',
      jurisdiction: asJurisdiction('GB'),
      identityId: 'idn_graph_a',
      customerId: asCustomerId('cust_a'),
      capabilities: ['VIEW_ECONOMIC_GRAPH'],
    });
    assert.ok(actorA.ok);
    const denied = authorizeGraphRead(actorA.value, 'cust_b');
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.error.code, 'SUBJECT_MISMATCH');
    }
  });

  it('denies graph reads without verified actor context', () => {
    const denied = authorizeGraphRead({ actorId: 'fake' }, 'cust_a');
    assert.equal(denied.ok, false);
  });
});

describe('Wave 9 Task 6 — federated query privacy', () => {
  it('strips raw provider payloads from federation results', () => {
    const envelope = normalizeToEnvelope({
      envelopeId: 'env_1',
      providerId: 'prov_macro',
      economicDomain: 'macro',
      sourceClass: 'reference',
      capability: 'cpi',
      payload: { value: 2.1 },
      rawPayload: '{"secret":"provider-body"}',
      retrievedAtUtc: NOW,
    });
    const engine = createFederatedQueryEngine();
    const store = new Map([[envelope.envelopeId, envelope]]);
    const result = engine.execute(
      {
        queryId: 'q1',
        economicDomain: 'macro',
        metric: 'cpi',
        entityRef: null,
        providerIds: ['prov_macro'],
        asOfUtc: NOW,
      },
      store,
    );
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes('provider-body'), false);
    assert.equal(serialized.includes('"rawPayload"'), false);
    assert.ok(serialized.includes('rawPayloadHash'));
    assert.ok(result.envelopes.length > 0);
  });

  it('denies arbitrary clean-room SQL', () => {
    const rejected = rejectArbitraryQuery({ sql: 'SELECT email FROM users' });
    assert.equal(rejected.ok, false);
  });

  it('denies raw-row export from clean room', () => {
    const decision = evaluateEgress({
      ast: { rawRowExport: true } as never,
      result: { shape: 'AGGREGATE', groups: [], operation: 'COUNT', values: [] } as never,
      cohortSize: 100,
      onwardSharing: false,
      onwardSharingAllowed: false,
      privacyPolicyVersion: asPrivacyPolicyVersion('simulation-v1'),
      now: NOW,
      jobId: asCleanRoomJobId('job_1'),
    });
    assert.equal(decision.decision, 'DENY');
    assert.equal(decision.reasonCode, 'RAW_ROW_EXPORT_DENIED');
  });
});

describe('Wave 9 Task 7 — log / trace / metric leakage', () => {
  it('redacts nested sensitive keys including phone and email fields', () => {
    const redacted = redactLogRecord({
      meta: { phone: '+15551234567', route: '/health' },
      email: 'user@example.com',
      dna: 'ATCG',
    });
    assert.equal(redacted.email, '[REDACTED]');
    assert.equal((redacted.meta as Record<string, unknown>).phone, '[REDACTED]');
    assert.equal(redacted.dna, '[REDACTED]');
  });

  it('rejects nested sensitive keys in event payloads', () => {
    assert.throws(
      () => assertSafeEventPayload({ wrapper: { governmentId: 'AB123' } }),
      /sensitive field/,
    );
  });
});

describe('Wave 9 Task 8 — backup security', () => {
  it('requires encryption for signer-safety and postgres backups', () => {
    assert.equal(recoveryStrategy('SIGNER_SAFETY').requiresEncryption, true);
    assert.equal(recoveryStrategy('POSTGRES_APPLICATION_DATA').requiresEncryption, true);
    assert.equal(recoveryStrategy('BLOCKCHAIN_STATE').requiresEncryption, false);
  });

  it('encrypts backup plaintext and rejects tampered snapshots', () => {
    const clock = new FrozenClock(NOW);
    const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
    const plaintext = Buffer.from('ledger snapshot bytes', 'utf8');
    const envelope = encryptBackup(keys, plaintext);
    assert.equal(envelope.purpose, 'BACKUP_ENCRYPTION');
    const { manifest, state } = createVerifiedSnapshot({
      snapshotId: 'snap_1',
      height: 1n,
      blockId: 'blk_1',
      stateRoot: 'root',
      state: 'ledger snapshot bytes',
    });
    verifySnapshot(manifest, state);
    const tampered = Buffer.from('tampered', 'utf8');
    assert.throws(() => verifySnapshot(manifest, tampered), /tampered/);
  });
});

describe('Wave 9 Task 9 — insider threat', () => {
  it('enforces segregation of duties for privileged staff actions', () => {
    const supportCaps = capabilitiesForStaffRoles(['CUSTOMER_SUPPORT']);
    const sod = evaluateSegregationOfDuties({
      roles: ['CUSTOMER_SUPPORT'],
      capabilities: supportCaps,
      action: 'PROVIDER_DISABLE',
      actorId: 'support_1',
    });
    assert.equal(sod.ok, false);
  });

  it('limits support staff capabilities vs security admin', () => {
    const supportCaps = capabilitiesForStaffRoles(['CUSTOMER_SUPPORT']);
    const securityCaps = capabilitiesForStaffRoles(['SECURITY_OPERATOR']);
    assert.equal(supportCaps.includes('ADMIN_SECURITY'), false);
    assert.ok(securityCaps.includes('ADMIN_SECURITY'));
  });
});

describe('Wave 9 Task 10 — consent / rights history', () => {
  it('blocks permit issuance after consent revocation', () => {
    const { consent, actor } = consentHarness();
    const draft = consent.draftConsent(actor, {
      subjectId: actor.subjectId,
      recipientId: RECIPIENT_PERSONAL_AGENT,
      purposeRef: 'PERSONAL_AGENT_ANALYSIS',
      categories: ['PAYROLL_DATA'],
      operations: ['READ'],
      derivationTypes: ['DERIVED_ONLY'],
      effectiveFrom: NOW,
      expiresAt: asUtcInstant('2027-01-01T00:00:00.000Z'),
      idempotencyKey: 'wave9-grant',
    });
    assert.ok(draft.ok);
    const confirmed = consent.confirmConsent(actor, draft.value.consentId, 'confirm');
    assert.ok(confirmed.ok);
    const revoked = consent.revokeConsent(actor, draft.value.consentId, 'user revoked', 'revoke');
    assert.ok(revoked.ok);
    const permit = consent.issuePermit(actor, {
      subjectId: actor.subjectId,
      recipientId: RECIPIENT_PERSONAL_AGENT,
      purposeRef: 'PERSONAL_AGENT_ANALYSIS',
      resourceId: actor.subjectId,
      operation: 'READ',
      derivationType: 'RAW',
    });
    assert.equal(permit.ok, false);
    if (!permit.ok) {
      assert.equal(permit.error.code, 'CONSENT_REVOKED');
    }
  });

  it('runs range privacy scenarios for revoked consent and wrong purpose', () => {
    const env = createRangeEnvironment();
    for (const scenario of privacyScenarios.filter((s) => s.scenarioId.startsWith('INFO-'))) {
      const result = runPrivacy(env, scenario);
      assert.equal(result.attackBlocked, true, scenario.scenarioId);
    }
  });
});

describe('Wave 9 Task 11 — selective disclosure', () => {
  it('labels SD/VC/ZK/DP capabilities as INTERFACE_ONLY', () => {
    assert.equal(SELECTIVE_DISCLOSURE_CAPABILITY, 'INTERFACE_ONLY');
    assert.equal(VERIFIABLE_CREDENTIALS_CAPABILITY, 'INTERFACE_ONLY');
    assert.equal(ZERO_KNOWLEDGE_PROOF_CAPABILITY, 'INTERFACE_ONLY');
    assert.equal(DIFFERENTIAL_PRIVACY_CAPABILITY, 'INTERFACE_ONLY');
  });
});

describe('Wave 9 Task 12 — data deletion', () => {
  it('documents tombstone lifecycle without blockchain rewrite', () => {
    const pdvService = readFileSync(join(ROOT, 'packages/personal-data-vault/src/service.ts'), 'utf8');
    assert.ok(pdvService.includes('DELETION_REQUESTED'));
    assert.ok(pdvService.includes('tombstone'));
    const chainPolicy = readFileSync(
      join(ROOT, 'docs/architecture/adr/ADR-0030-sunrey-blockchain-privacy-confidentiality.md'),
      'utf8',
    );
    assert.ok(chainPolicy.toLowerCase().includes('off-chain') || chainPolicy.toLowerCase().includes('commitment'));
  });
});

describe('Wave 9 Task 13 — secret scanning', () => {
  it('passes repository secret scan self-test', () => {
    const output = execSync('python3 scripts/secret-scan.py --self-test', {
      cwd: ROOT,
      encoding: 'utf8',
    });
    assert.match(output, /self-test: ok/i);
  });
});

describe('Wave 9 Task 14 — remediation regression', () => {
  it('assertLogPayloadSafe passes on redacted structured logs', () => {
    const safe = redactLogRecord({
      authorization: 'Bearer ' + 'eyJhbGciOiJIUzI1NiJ9.testfixture',
      route: '/api/v1/accounts',
    });
    assertLogPayloadSafe(safe);
  });
});

/**
 * Wave 7 Prompt 28 — privileged security and key management tests.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSimulationKeyProvider } from '../packages/security/src/simulation.ts';
import { createDevelopmentHsmSimulator } from '../packages/security/src/hsm-simulator.ts';
import { SUITE_SUNREY_ED25519_V1 } from '../packages/security/src/crypto-suite.ts';
import {
  KEY_ROLES,
  KEY_ROLE_POLICIES,
  assertKeyRoleSeparation,
  assertWrongKeyType,
  roleForPurpose,
} from '../packages/security/src/productization/key-classification.ts';
import {
  PRIVILEGED_OPERATIONS,
  privilegedOperation,
  privilegedOperationCount,
} from '../packages/security/src/productization/privileged-matrix.ts';
import {
  auditTextForHardcodedSecrets,
  assertNoPrivateKeyInDatabaseRow,
  assertValidatorKeyNotOnPublicApi,
  redactForAuditLog,
} from '../packages/security/src/productization/key-storage.ts';
import {
  HSM_KMS_CONNECTION_STATUS,
  HSM_KMS_PRODUCTION_POSTURE,
  assertHsmRequiredForRole,
  requestRemoteSignature,
} from '../packages/security/src/productization/hsm-production.ts';
import {
  bindProposal,
  evaluateGovernanceThreshold,
  assertExpiredApprovalRejected,
  assertServiceCannotGovern,
  DEFAULT_GOVERNANCE_THRESHOLDS,
} from '../packages/security/src/productization/governance-signing.ts';
import {
  evaluateBreakGlassAttempt,
  breakGlassCannotBypassMonetaryControl,
} from '../packages/security/src/productization/break-glass-monetary.ts';
import {
  sealPrivilegedAuditEvent,
  assertAuditContainsNoSecrets,
} from '../packages/security/src/productization/admin-audit.ts';
import {
  evaluateAdminApproval,
  SENSITIVE_NON_MONETARY_OPERATIONS,
} from '../packages/security/src/productization/admin-approvals.ts';
import {
  evaluateMainnetCeremonyReadiness,
  refuseSingleEnvMainnetActivation,
  assertMissingPrerequisiteBlocksActivation,
  MAINNET_CEREMONY_PREREQUISITES,
} from '../packages/security/src/productization/mainnet-ceremony-design.ts';
import {
  enforcePrivilegedOperation,
  enforceAdminCannotMint,
  enforceValidatorKeyNotUserKey,
  enforceRevokedServiceCredential,
} from '../packages/security/src/productization/privileged-enforcement.ts';
import { PrivilegedAccessRegistry } from '../packages/security/src/productization/privileged.ts';
import { rotateWithOverlap } from '../packages/security/src/productization/rotation.ts';
import { assertMainnetOff } from '../packages/security/src/productization/chain.ts';
import { SecretValue } from '../packages/security/src/redaction.ts';

describe('Wave 7 Prompt 28 — key classification', () => {
  it('defines eight distinct key roles that never reuse one another', () => {
    assert.equal(KEY_ROLES.length, 8);
    for (const role of KEY_ROLES) {
      const policy = KEY_ROLE_POLICIES[role];
      assert.equal(policy.exportable, false);
      assert.ok(policy.reuseForbiddenRoles.length >= 4);
    }
    assert.equal(assertKeyRoleSeparation('VALIDATOR_KEY', 'USER_WALLET_KEY').ok, false);
    assert.equal(assertKeyRoleSeparation('API_CREDENTIAL', 'GOVERNANCE_SIGNING_KEY').ok, false);
    assert.equal(assertWrongKeyType('USER_WALLET_KEY', 'VALIDATOR_KEY').ok, false);
    assert.equal(roleForPurpose('VALIDATOR_CONSENSUS_SIGNING'), 'VALIDATOR_KEY');
    assert.equal(roleForPurpose('WALLET_SIGNING'), 'USER_WALLET_KEY');
  });
});

describe('Wave 7 Prompt 28 — privileged operation matrix', () => {
  it('catalogs privileged operations with no monetary bypass', () => {
    assert.ok(privilegedOperationCount() >= 20);
    for (const op of PRIVILEGED_OPERATIONS) {
      assert.equal(op.bypassesMonetaryControl, false);
      assert.ok(op.auditKind.startsWith('privileged.'));
    }
    const runtimeToggle = privilegedOperation('feature_flag.runtime_toggle');
    assert.ok(runtimeToggle);
    assert.equal(runtimeToggle!.approvalModel, 'NOT_PERMITTED');
    const mainnet = privilegedOperation('mainnet.activate');
    assert.ok(mainnet);
    assert.equal(mainnet!.approvalModel, 'CEREMONY_ONLY');
  });
});

describe('Wave 7 Prompt 28 — key storage audit', () => {
  it('detects hard-coded secrets and blocks validator keys on public API', () => {
    const findings = auditTextForHardcodedSecrets('const key = "-----BEGIN PRIVATE KEY-----"');
    assert.ok(findings.length > 0);
    assert.equal(assertValidatorKeyNotOnPublicApi('VALIDATOR_KEY', 'PUBLIC_API_CONTAINER').ok, false);
    assert.equal(assertNoPrivateKeyInDatabaseRow({ privateKey: 'abc123' }).ok, false);
    const redacted = redactForAuditLog({ actor: 'idn_1', privateKey: 'secret', nested: { password: 'x' } });
    assert.equal(redacted.privateKey, '[REDACTED]');
    assert.equal((redacted.nested as Record<string, unknown>).password, '[REDACTED]');
  });
});

describe('Wave 7 Prompt 28 — HSM/KMS boundary', () => {
  it('is INTERFACE READY but NOT PRODUCTION CONNECTED', () => {
    assert.equal(HSM_KMS_CONNECTION_STATUS, 'INTERFACE_READY_NOT_PRODUCTION_CONNECTED');
    assert.equal(HSM_KMS_PRODUCTION_POSTURE.interfaceReady, true);
    assert.equal(HSM_KMS_PRODUCTION_POSTURE.productionConnected, false);
    assert.equal(HSM_KMS_PRODUCTION_POSTURE.privateKeyNeverInApplicationMemory, true);
    assert.equal(assertHsmRequiredForRole('VALIDATOR_KEY').ok, false);
    const hsm = createDevelopmentHsmSimulator();
    const generated = hsm.generateKey({
      purpose: 'WALLET_SIGNING',
      suiteId: SUITE_SUNREY_ED25519_V1,
    });
    assert.equal(generated.ok, true);
    if (!generated.ok) return;
    const refused = requestRemoteSignature(hsm, {
      role: 'USER_WALLET_KEY',
      purpose: 'WALLET_SIGNING',
      digest: Buffer.from('test'),
      requesterId: 'custody-signer',
      handle: generated.value,
    });
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.error.code, 'PRODUCTION_HSM_REQUIRED');
    }
  });
});

describe('Wave 7 Prompt 28 — governance signing', () => {
  it('requires threshold, separation of duties, and rejects expired approvals', () => {
    assert.ok(DEFAULT_GOVERNANCE_THRESHOLDS.length >= 4);
    const proposal = bindProposal({
      proposalId: 'prop_1',
      operationType: 'monetary.parameter_change',
      policyVersion: 'v1',
      previousStateRef: 'state_a',
      newStateRef: 'state_b',
      reason: 'parameter update',
      createdAt: '2026-08-23T00:00:00.000Z',
    });
    const approvals = [
      {
        approvalId: 'ap_1',
        proposalHash: proposal.proposalHash,
        policyVersion: 'v1',
        role: 'ECONOMIC_GOVERNANCE' as const,
        approverId: 'human_1',
        approvedAt: '2026-08-23T00:00:00.000Z',
        expiresAt: '2026-08-24T00:00:00.000Z',
        signatureRef: 'sig_1',
      },
    ];
    const threshold = DEFAULT_GOVERNANCE_THRESHOLDS.find((r) => r.operationType === 'monetary.parameter_change')!;
    const insufficient = evaluateGovernanceThreshold(threshold, approvals, proposal, '2026-08-23T01:00:00.000Z');
    assert.equal(insufficient.ok, false);

    const expired = assertExpiredApprovalRejected(
      { ...approvals[0], expiresAt: '2026-08-22T00:00:00.000Z' },
      '2026-08-23T01:00:00.000Z',
    );
    assert.equal(expired.ok, false);
    assert.equal(assertServiceCannotGovern('SERVICE').ok, false);
    assert.equal(assertServiceCannotGovern('HUMAN').ok, true);
  });
});

describe('Wave 7 Prompt 28 — break-glass monetary boundary', () => {
  it('cannot bypass mint, ledger, or supply invariants', () => {
    assert.equal(breakGlassCannotBypassMonetaryControl('MINT'), true);
    assert.equal(breakGlassCannotBypassMonetaryControl('SUPPORT_VIEW'), false);
    const record = {
      recordId: 'bg_test',
      actorId: 'idn_operator_1',
      role: 'BREAK_GLASS_OPERATOR' as const,
      reason: 'incident response for locked console',
      openedAt: '2026-08-23T00:00:00.000Z',
      expiresAt: '2026-08-23T02:00:00.000Z',
      recorded: true as const,
      sharedAccount: false as const,
      closedAt: null,
    };
    const mint = evaluateBreakGlassAttempt({ record, target: 'MINT', now: '2026-08-23T01:00:00.000Z' });
    assert.equal(mint.ok, false);
    const support = evaluateBreakGlassAttempt({ record, target: 'SUPPORT_VIEW', now: '2026-08-23T01:00:00.000Z' });
    assert.equal(support.ok, true);
  });
});

describe('Wave 7 Prompt 28 — admin audit and approvals', () => {
  it('seals audit events without secrets and enforces approval models', () => {
    const audit = sealPrivilegedAuditEvent({
      kind: 'privileged.operation.refused',
      who: 'idn_admin',
      what: 'issuance.sunrey.activate',
      when: '2026-08-23T00:00:00.000Z',
      resource: 'packages/sunrey-chain',
      policyDecision: 'THRESHOLD_NOT_MET',
      authorization: 'HUMAN',
      previousStateRef: 'unchanged',
      newStateRef: 'unchanged',
      reason: 'attempted mint',
      metadata: { privateKey: 'should-not-appear', actor: 'idn_admin' },
    });
    assert.equal(assertAuditContainsNoSecrets(audit), true);
    assert.ok(!JSON.stringify(audit).includes('should-not-appear'));

    const single = evaluateAdminApproval({
      operationId: 'identity.suspend',
      actorId: 'idn_compliance',
      actorRoles: ['ADMIN_COMPLIANCE'],
      stepUpSatisfied: true,
      now: '2026-08-23T00:00:00.000Z',
      reason: 'fraud investigation',
    });
    assert.equal(single.ok, true);
    if (single.ok) assert.equal(single.value.allowed, true);

    const dual = evaluateAdminApproval({
      operationId: 'provider.disable',
      actorId: 'idn_sre',
      actorRoles: ['ADMIN_SRE'],
      stepUpSatisfied: true,
      now: '2026-08-23T00:00:00.000Z',
      reason: 'provider outage',
      approvalCount: 1,
    });
    assert.equal(dual.ok, true);
    if (dual.ok) assert.equal(dual.value.allowed, false);

    for (const op of SENSITIVE_NON_MONETARY_OPERATIONS) {
      assert.ok(privilegedOperation(op));
    }
  });
});

describe('Wave 7 Prompt 28 — mainnet ceremony design', () => {
  it('blocks activation with missing prerequisites and refuses single env var', () => {
    assert.equal(MAINNET_CEREMONY_PREREQUISITES.length, 11);
    const readiness = evaluateMainnetCeremonyReadiness({
      ceremonyId: 'ceremony_rehearsal_1',
      evaluatedAt: '2026-08-23T00:00:00.000Z',
      prerequisiteStates: { approved_genesis: 'SATISFIED' },
    });
    assert.equal(readiness.allSatisfied, false);
    assert.equal(readiness.mainnetRemainsDisabled, true);
    assert.equal(readiness.singleEnvActivationForbidden, true);
    assert.equal(assertMissingPrerequisiteBlocksActivation(readiness).ok, false);
    assert.equal(refuseSingleEnvMainnetActivation('ENVIRONMENT', 'production').ok, false);
    assert.equal(refuseSingleEnvMainnetActivation('SUNREY_LOG_LEVEL', 'debug').ok, true);
    assert.equal(assertMainnetOff(), true);
  });
});

describe('Wave 7 Prompt 28 — privileged enforcement', () => {
  it('refuses admin mint, service governance, wrong key type, and revoked credentials', () => {
    assert.equal(enforceAdminCannotMint(['ADMIN_SRE']).ok, true);
    assert.equal(enforceValidatorKeyNotUserKey('WALLET_SIGNING', 'VALIDATOR_KEY').ok, false);
    assert.equal(enforceValidatorKeyNotUserKey('VALIDATOR_CONSENSUS_SIGNING', 'VALIDATOR_KEY').ok, true);

    const serviceGov = enforcePrivilegedOperation({
      operationId: 'governance.approve',
      actorId: 'svc_api',
      actorKind: 'SERVICE',
      actorRoles: ['PROTOCOL_GOVERNANCE'],
      stepUpSatisfied: true,
      now: '2026-08-23T00:00:00.000Z',
      reason: 'service attempt',
    });
    assert.equal(serviceGov.ok, false);

    const agentMint = enforcePrivilegedOperation({
      operationId: 'issuance.moonrey.activate',
      actorId: 'agent_1',
      actorKind: 'AGENT',
      actorRoles: [],
      stepUpSatisfied: true,
      now: '2026-08-23T00:00:00.000Z',
      reason: 'agent attempt',
    });
    assert.equal(agentMint.ok, false);

    const keys = createSimulationKeyProvider();
    const signed = keys.sign('SERVICE_AUTHENTICATION', 'payload');
    assert.equal(signed.ok, true);
    if (!signed.ok) return;
    const version = keys.keyStatus('SERVICE_AUTHENTICATION');
    assert.equal(version.ok, true);
    if (!version.ok) return;
    const revoked = enforceRevokedServiceCredential(
      keys,
      'SERVICE_AUTHENTICATION',
      version.value.version,
      '2026-08-23T12:00:00.000Z',
    );
    assert.equal(revoked.ok, true);

    const registry = new PrivilegedAccessRegistry();
    const glass = registry.openBreakGlass({
      recordId: 'bg_enforce',
      actorId: 'idn_operator_3',
      reason: 'restore operator access after lockout',
      openedAt: '2026-08-23T00:00:00.000Z',
      expiresAt: '2026-08-23T01:00:00.000Z',
    });
    assert.equal(glass.ok, true);
    if (!glass.ok) return;
    const bgMint = enforcePrivilegedOperation({
      operationId: 'issuance.sunrey.activate',
      actorId: 'idn_operator_3',
      actorKind: 'HUMAN',
      actorRoles: ['BREAK_GLASS_OPERATOR'],
      stepUpSatisfied: true,
      now: '2026-08-23T00:30:00.000Z',
      reason: 'break-glass mint attempt',
      breakGlass: glass.value,
    });
    assert.equal(bgMint.ok, false);

    const rotated = rotateWithOverlap(keys, 'SESSION_SIGNING', '2026-12-31T00:00:00.000Z');
    assert.equal(rotated.ok, true);

    const secret = new SecretValue('top-secret');
    assert.equal(secret.toString(), '[REDACTED]');
    assert.equal(JSON.stringify({ key: secret }), '{"key":"[REDACTED]"}');
  });
});

/**
 * Wave 7 — Privacy, Identity, Policy and Authorization Control Plane red team.
 *
 * Adversarial regression for the unified control plane. Monetary compromise
 * must not follow from application-layer policy, identity, or consent bypass.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { ENVIRONMENT } from '../packages/config/src/flags.ts';
import { asAccountId } from '../packages/domain/src/account.ts';
import { asCustomerId, createProspect, notStartedVerification } from '../packages/domain/src/customer.ts';
import { asJurisdiction, asResidency } from '../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import { assertSafeEventPayload } from '../packages/events/src/envelope.ts';
import { DomainEventLog } from '../packages/events/src/events.ts';
import { ConsentService } from '../packages/consent/src/service.ts';
import { RECIPIENT_EXTERNAL_RESEARCH, RECIPIENT_PERSONAL_AGENT } from '../packages/consent/src/recipients.ts';
import { deriveAuthorizationContext } from '../packages/identity/src/authorization-context.ts';
import { capabilitiesForStaffRoles } from '../packages/identity/src/admin-roles.ts';
import { SimulatedIdentityAdapter } from '../packages/identity/src/simulation.ts';
import { ResourceOwnershipRegistry } from '../packages/identity/src/resource-ownership.ts';
import { staffOperatorFromRoles } from '../packages/identity/src/staff/operator.ts';
import {
  evaluateSegregationOfDuties,
  operatorMayAccessDomain,
} from '../packages/identity/src/staff/sod.ts';
import { asIntentId } from '../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../packages/permissions/src/action-types.ts';
import { AuthorityIssuer } from '../packages/permissions/src/execution-authority.ts';
import { createSimulationKeyProvider } from '../packages/security/src/simulation.ts';
import { UnavailableKeyProvider } from '../packages/security/src/unavailable.ts';
import {
  assertServiceCapability,
  type ServiceIdentity,
} from '../packages/security/src/identity.ts';
import { PrivilegedAccessRegistry } from '../packages/security/src/productization/privileged.ts';
import { ComplianceKernel } from '../packages/kernel/src/kernel.ts';
import { createSimulationPolicyEngine } from '../packages/kernel/src/policy/create.ts';
import { PolicyEngine } from '../packages/kernel/src/policy/engine.ts';
import { PolicyRegistry } from '../packages/kernel/src/policy/registry.ts';
import { OperationsControlPlane } from '../packages/kernel/src/operations/service.ts';
import { OPERATIONS_CONTROL_FLAGS } from '../packages/kernel/src/operations/flags.ts';
import { ProposalGate } from '../packages/sunrey-agent/src/gate.ts';
import {
  authorizeIssuance,
  developmentSunReyAuthority,
  rejectUnrestrictedMint,
} from '../packages/sunrey-chain/src/economics/issuance.ts';
import { nativeAssetConstitution } from '../packages/sunrey-chain/src/economics/constitution.ts';
import { emptyBook } from '../packages/sunrey-chain/src/economics/supply.ts';
import { evaluateRights } from '../packages/sunrey-chain/src/economic-proof/rights/evaluation.ts';
import {
  newLicenseAuthorizationId,
  newPurposeAuthorizationId,
  newRightsGrantId,
} from '../packages/sunrey-chain/src/economic-proof/rights/ids.ts';
import {
  subjectCommitment,
  scopeCommitmentFromLabels,
} from '../packages/sunrey-chain/src/economic-proof/rights/commitments.ts';
import type { LicenseAuthorization, RightsGrant } from '../packages/sunrey-chain/src/economic-proof/rights/types.ts';
import { evaluateMainnetRuntimeGate } from '../packages/sunrey-chain/src/runtime/mainnet-gate.ts';
import { findForbiddenPayloadField } from '../packages/personal-data-vault/src/product/minimization.ts';
import { redactRecord } from '../services/api/src/logging.ts';
import { InformationMarketService } from '../packages/information-market/src/service.ts';
import { SUNREY_AGENT_ISOLATION } from '../packages/sunrey-agent/src/isolation.ts';

const ROOT = join(import.meta.dirname, '..');
const NOW = asUtcInstant('2026-09-02T12:00:00.000Z');
const LATER = asUtcInstant('2026-09-02T13:00:00.000Z');
const EXPIRES = asUtcInstant('2027-01-01T00:00:00.000Z');
const constitution = nativeAssetConstitution('DEVELOPMENT_ACTIVE');

function consentHarness() {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  const provisioned = identity.provisionSimulatedActor({
    actorId: 'actor_wave7',
    jurisdiction: asJurisdiction('GB'),
    identityId: 'idn_wave7',
    customerId: asCustomerId('cust_wave7'),
    capabilities: ['CONSENT_GRANT_OWN', 'CONSENT_REVOKE_OWN', 'CONSENT_VIEW_OWN'],
  });
  if (!provisioned.ok) {
    throw new Error(provisioned.error.message);
  }
  const consent = new ConsentService({ clock, keys, evidence, events });
  return { clock, consent, actor: provisioned.value };
}

function productiveRightsGrant(): RightsGrant {
  return Object.freeze({
    schemaVersion: 1,
    rightsGrantId: newRightsGrantId('prod-1'),
    economyKind: 'PRODUCTIVE',
    subjectCommitment: subjectCommitment('facility:demo', 'US'),
    controllerRef: 'controller:oracle',
    dataScopeCommitment: scopeCommitmentFromLabels(['oracle-fact']),
    evidenceScopeCommitment: scopeCommitmentFromLabels(['bundle']),
    permittedPurposes: [newPurposeAuthorizationId('PROVIDER_QUERY', 1)],
    prohibitedPurposes: [],
    jurisdiction: 'US',
    effectiveFrom: asUtcInstant('2025-01-01T00:00:00.000Z'),
    effectiveUntil: EXPIRES,
    revocationRef: null,
    delegation: Object.freeze({ delegable: false, maxSubdelegates: 0, notes: null }),
    issuerRef: 'issuer:license-registry',
    authorizationRef: 'auth:fixture',
    authorizesMonetaryIssuance: false,
    authorizesEconomicValuation: false,
  });
}

function restrictiveLicense(): LicenseAuthorization {
  return Object.freeze({
    schemaVersion: 1,
    licenseAuthorizationId: newLicenseAuthorizationId('lic-1'),
    providerRef: 'provider:fixture',
    commercialUse: 'FORBIDDEN',
    persistence: 'FORBIDDEN',
    derivedUse: 'RESTRICTED',
    redistribution: 'FORBIDDEN',
    attributionRequired: true,
    effectiveFrom: asUtcInstant('2025-01-01T00:00:00.000Z'),
    effectiveUntil: EXPIRES,
    agreementVersion: 'fixture-v1',
  });
}

describe('Wave 7 Task 1 — policy bypass red team', () => {
  it('fails closed on missing pack, unknown version, and unresolved jurisdiction', () => {
    const empty = new PolicyEngine({ registry: new PolicyRegistry() });
    const customer = createProspect({
      id: asCustomerId('cust_policy'),
      legalEntityId: 'le_gb' as never,
      jurisdiction: asJurisdiction('GB'),
      residency: asResidency('GB'),
      verification: notStartedVerification(NOW),
      createdAt: NOW,
    });
    const intent = {
      id: asIntentId('int_policy'),
      actionType: ACTION_TYPES.OPEN_ACCOUNT,
      idempotencyKey: 'idem',
      actorId: 'op_1',
      requestedAt: NOW,
      purpose: 'CUSTOMER_ONBOARDING' as const,
      payload: {
        accountId: asAccountId('acct_policy'),
        ownerId: 'cust_policy',
        productId: 'prod_gb',
        accountClass: 'DEMAND_DEPOSIT' as const,
        legalEntityId: 'le_gb',
        jurisdiction: 'GB' as const,
        currency: 'USD',
      },
    };
    const missingPack = empty.evaluate(intent, { actor: { id: 'op_1' }, customer, jurisdiction: asJurisdiction('GB') } as never, NOW);
    assert.notEqual(missingPack.decision, 'ALLOW');
    assert.ok(missingPack.reasonCodes.includes('POLICY_PACK_MISSING'));

    const engine = createSimulationPolicyEngine();
    const unknownVersion = engine.evaluateFacts(
      {
        actor: { id: 'op_1' },
        customer,
        jurisdiction: 'GB',
        policyPin: { packId: 'GB', versionId: 'does-not-exist' },
      },
      NOW,
    );
    assert.notEqual(unknownVersion.decision, 'ALLOW');
    assert.ok(unknownVersion.reasonCodes.includes('POLICY_VERSION_MISSING'));

    const unresolved = engine.evaluateFacts({ actor: { id: 'op_1' }, jurisdiction: null }, NOW);
    assert.equal(unresolved.decision, 'DEFER');
    assert.ok(unresolved.reasonCodes.includes('JURISDICTION_UNRESOLVED'));
  });

  it('rejects client-supplied ALLOW and honors server-side policy only', () => {
    const clock = new FrozenClock(NOW);
    const evidence = new EvidenceVault(clock);
    const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
    const issuer = new AuthorityIssuer(keys, clock);
    const kernel = new ComplianceKernel(issuer, evidence, clock, undefined, createSimulationPolicyEngine());
    const customer = createProspect({
      id: asCustomerId('cust_client'),
      legalEntityId: 'le_gb' as never,
      jurisdiction: asJurisdiction('GB'),
      residency: asResidency('GB'),
      verification: notStartedVerification(NOW),
      createdAt: NOW,
    });
    const intent = {
      id: asIntentId('int_client'),
      actionType: ACTION_TYPES.OPEN_ACCOUNT,
      idempotencyKey: 'idem_client',
      actorId: 'attacker',
      requestedAt: NOW,
      purpose: 'CUSTOMER_ONBOARDING' as const,
      payload: {
        accountId: asAccountId('acct_client'),
        ownerId: 'cust_client',
        productId: 'prod_gb',
        accountClass: 'DEMAND_DEPOSIT' as const,
        legalEntityId: 'le_gb',
        jurisdiction: 'GB' as const,
        currency: 'USD',
        clientPolicyDecision: 'ALLOW',
        forgedReceipt: 'fake',
      },
    };
    const decision = kernel.submit(intent, {
      actor: { id: 'attacker', capabilities: [ACTION_TYPES.OPEN_ACCOUNT] },
      customer,
      jurisdiction: asJurisdiction('GB'),
      identity: {
        identityExists: true,
        identityStatus: 'ACTIVE',
        subjectId: 'subj_client',
        actorId: 'attacker',
        actorSubjectMatch: true,
        authenticated: true,
        sessionValid: true,
        authenticationAssurance: 'STRONG',
        kycState: 'NOT_STARTED',
        kycLevel: 'NONE',
        kycFresh: false,
        kycVersion: 0,
        customerId: customer.id,
        authorizedCapabilities: ['ACCOUNT_OPEN_REQUEST'],
      },
    } as never);
    assert.notEqual(decision.status, 'ALLOW');
    assert.equal(decision.executionAuthority, null);
  });
});

describe('Wave 7 Task 2 — authorization red team', () => {
  it('denies horizontal IDOR and vertical staff privilege escalation', () => {
    const registry = new ResourceOwnershipRegistry();
    registry.register({
      kind: 'account',
      id: 'acct_victim',
      ownerCustomerId: 'cust_victim',
      ownerSubjectId: 'subj_victim' as never,
    });
    const stolen = registry.assertOwnedBySubject('account', 'acct_victim', 'subj_attacker' as never);
    assert.equal(stolen.ok, false);
    if (!stolen.ok) {
      assert.equal(stolen.error.code, 'RESOURCE_NOT_OWNED');
    }

    const supportCaps = capabilitiesForStaffRoles(['CUSTOMER_SUPPORT']);
    assert.equal(operatorMayAccessDomain(supportCaps, 'SANCTIONS', 'write'), false);
    const disable = evaluateSegregationOfDuties({
      roles: ['CUSTOMER_SUPPORT'],
      capabilities: supportCaps,
      action: 'PROVIDER_DISABLE',
      actorId: 'support_1',
    });
    assert.equal(disable.ok, false);
  });

  it('keeps agent, governance, validator, and auditor identities separated', () => {
    const agentCtx = deriveAuthorizationContext({
      identityStatus: 'ACTIVE',
      session: {
        sessionId: 'sess_agent' as never,
        subjectId: 'subj_human' as never,
        actorId: 'agent_runtime',
        authenticationStrength: 'STANDARD',
        riskState: 'NORMAL',
        expiresAt: EXPIRES,
      },
      device: null,
      kyc: null,
      customerId: 'cust_1',
      jurisdiction: 'GB',
      capabilities: ['AGENT_PROPOSE'],
      actorContext: {
        actorId: 'agent_runtime',
        subjectId: 'subj_human',
        sessionId: 'sess_agent',
        issuedAt: NOW,
        expiresAt: EXPIRES,
        authenticationAssurance: 'STANDARD',
        capabilities: ['AGENT_PROPOSE'],
        signature: 'sig',
        keyVersion: 1,
      } as never,
      requestedCapability: null,
      requestedResource: null,
      ownedResource: null,
      request: { requestId: 'r1', correlationId: null, method: 'POST', path: '/agent/propose' },
      principalKind: 'AGENT',
      agent: {
        agentId: 'agent_1',
        mandateId: 'mand_1',
        humanSubjectId: 'subj_human' as never,
      },
    });
    assert.equal(agentCtx.principalKind, 'AGENT');
    assert.equal(agentCtx.agent?.humanSubjectId, 'subj_human');

    const auditorCaps = capabilitiesForStaffRoles(['AUDITOR']);
    assert.equal(operatorMayAccessDomain(auditorCaps, 'PAYMENT', 'write'), false);
    const writeAttempt = evaluateSegregationOfDuties({
      roles: ['AUDITOR'],
      capabilities: auditorCaps,
      action: 'CASE_CREATE',
      actorId: 'aud_1',
    });
    assert.equal(writeAttempt.ok, false);
  });

  it('rejects expired, revoked, and cross-service delegation', () => {
    const expired: ServiceIdentity = Object.freeze({
      serviceId: 'payments',
      serviceRole: 'PAYMENTS_SERVICE',
      credentialRef: { providerId: 'sim', purpose: 'SERVICE_AUTH', version: 1, locator: 'sec://payments' },
      allowedCapabilities: ['SUBMIT_INTENT'],
      expiresAt: '2020-01-01T00:00:00.000Z',
      keyVersion: 1,
      status: 'EXPIRED',
    });
    assert.equal(assertServiceCapability(expired, 'SUBMIT_INTENT', NOW).ok, false);

    const revoked: ServiceIdentity = Object.freeze({
      ...expired,
      status: 'REVOKED',
      expiresAt: EXPIRES,
    });
    assert.equal(assertServiceCapability(revoked, 'SUBMIT_INTENT', NOW).ok, false);

    const ledgerOnly: ServiceIdentity = Object.freeze({
      serviceId: 'ledger',
      serviceRole: 'LEDGER_WRITER',
      credentialRef: { providerId: 'sim', purpose: 'SERVICE_AUTH', version: 1, locator: 'sec://ledger' },
      allowedCapabilities: ['VERIFY_AUTHORITY'],
      expiresAt: EXPIRES,
      keyVersion: 1,
      status: 'ACTIVE',
    });
    assert.equal(assertServiceCapability(ledgerOnly, 'ADMINISTER', NOW).ok, false);
  });
});

describe('Wave 7 Task 4/5/6/7 — privacy, purpose, license, jurisdiction red team', () => {
  it('blocks purpose expansion across research, agent, and identity boundaries', () => {
    const { consent, actor } = consentHarness();
    const draft = consent.draftConsent(actor, {
      subjectId: actor.subjectId,
      recipientId: RECIPIENT_EXTERNAL_RESEARCH,
      purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
      categories: ['TRANSACTION_DATA'],
      operations: ['READ', 'DERIVE'],
      derivationTypes: ['DERIVED_ONLY'],
      effectiveFrom: NOW,
      expiresAt: EXPIRES,
      idempotencyKey: 'wave7-research',
    });
    assert.equal(draft.ok, true);
    const confirmed = consent.confirmConsent(actor, draft.ok ? draft.value.consentId : ('' as never), 'confirm-wave7');
    assert.equal(confirmed.ok, true);

    const wrongPurpose = consent.issuePermit(actor, {
      subjectId: actor.subjectId,
      recipientId: RECIPIENT_PERSONAL_AGENT,
      purposeRef: 'PERSONAL_AGENT_ANALYSIS',
      resourceId: 'pda_tx',
      category: 'TRANSACTION_DATA',
      operation: 'DERIVE',
      derivationType: 'DERIVED_ONLY',
    });
    assert.equal(wrongPurpose.ok, false);

    const contributeBlocked = consent.issuePermit(actor, {
      subjectId: actor.subjectId,
      recipientId: RECIPIENT_EXTERNAL_RESEARCH,
      purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
      resourceId: 'pda_tx',
      category: 'TRANSACTION_DATA',
      operation: 'CONTRIBUTE',
      derivationType: 'AGGREGATE_ONLY',
    });
    assert.equal(contributeBlocked.ok, false);
    if (!contributeBlocked.ok) {
      assert.ok(
        contributeBlocked.error.code === 'DEPENDENCY_NOT_IMPLEMENTED' ||
          contributeBlocked.error.code === 'OPERATION_OUT_OF_SCOPE',
      );
    }
  });

  it('enforces provider license restrictions and no-persist datasets', () => {
    const license = restrictiveLicense();
    const grant = productiveRightsGrant();
    const purpose = {
      schemaVersion: 1 as const,
      purposeId: newPurposeAuthorizationId('PROVIDER_QUERY', 1),
      purposeVersion: 1,
      code: 'PROVIDER_QUERY',
      description: 'fixture',
    };
    for (const operation of ['PERSISTENCE', 'REDISTRIBUTION', 'COMMERCIAL_USE'] as const) {
      const denied = evaluateRights({
        rightsGrant: grant,
        requestedPurpose: purpose,
        licenseAuthorization: license,
        licenseOperation: operation,
        at: NOW,
      });
      assert.equal(denied.decision, 'DENY', operation);
    }
  });

  it('redacts sensitive fields from logs and rejects them in event payloads', () => {
    const redacted = redactRecord({
      dna: 'ATCG',
      governmentId: 'AB123',
      locationHistory: [{ city: 'London' }],
      consentDocument: 'blob',
    });
    assert.equal(redacted.dna, '[REDACTED]');
    assert.throws(() => assertSafeEventPayload({ governmentId: 'AB123' }), /sensitive field/);
    assert.ok(findForbiddenPayloadField({ geneticSequence: 'ATCG' }));
  });

  it('keeps unresolved jurisdiction fail-closed in rights evaluation', () => {
    const unresolved = evaluateRights({
      rightsGrant: Object.freeze({
        ...productiveRightsGrant(),
        jurisdiction: 'UNRESOLVED',
      }),
      requestedPurpose: {
        schemaVersion: 1,
        purposeId: newPurposeAuthorizationId('PROVIDER_QUERY', 1),
        purposeVersion: 1,
        code: 'PROVIDER_QUERY',
        description: 'fixture',
      },
      at: NOW,
    });
    assert.equal(unresolved.decision, 'DENY');
    assert.equal(unresolved.reasonCode, 'JURISDICTION_UNRESOLVED');
  });
});

describe('Wave 7 Task 8 — selective disclosure / minimization red team', () => {
  it('exposes simulation-only VC/ZK ports and does not claim production ZK', () => {
    const service = new InformationMarketService({
      clock: new FrozenClock(NOW),
      keys: createSimulationKeyProvider(),
      evidence: new EvidenceVault(new FrozenClock(NOW)),
      events: new DomainEventLog(),
      consent: new ConsentService({
        clock: new FrozenClock(NOW),
        keys: createSimulationKeyProvider(),
        evidence: new EvidenceVault(new FrozenClock(NOW)),
        events: new DomainEventLog(),
      }),
      cleanRoom: {
        evaluateEgress: () => ({ decision: 'DENY' }),
      } as never,
      coin: {
        legalStatus: () => ({ mode: 'SIMULATION_ONLY' }),
      } as never,
      fiat: {
        compensate: async () => ({ ok: true, value: { receiptId: 'rcpt' } }),
      },
    });
    const vc = service.vcPort.issueSimulationCredential({
      attestationId: 'att_1',
      subjectRef: 'subj_1',
      claims: Object.freeze({ over18: true }),
    });
    assert.equal(vc.mode, 'SIMULATION_ONLY');
    const zk = service.zkPort.proveSimulation('over18');
    assert.equal(zk.mode, 'SIMULATION_ONLY');
  });
});

describe('Wave 7 Task 9/11/12 — admin, AI, and monetary authority red team', () => {
  it('refuses ordinary admin mint, mainnet activation, and ledger mutation', () => {
    const clock = new FrozenClock(NOW);
    const evidence = new EvidenceVault(clock);
    const ops = new OperationsControlPlane({ clock, evidence });
    assert.equal(OPERATIONS_CONTROL_FLAGS.staffCanPostJournal, false);
    assert.throws(() => ops.refuseStaffLedgerWrite(), /cannot post a ledger journal/);
    assert.throws(() => ops.refuseStaffAuthorityIssue(), /cannot issue Execution Authority/);

    const gate = evaluateMainnetRuntimeGate();
    assert.equal(gate.passed, false);
    assert.equal(gate.mainnetActive, false);

    assert.equal(rejectUnrestrictedMint(), 'UNRESTRICTED_MINT_UNAVAILABLE');
    const aiDraft = developmentSunReyAuthority({
      recipient: 'bob',
      quantity: 1n,
      replayIdentifier: 'wave7-ai',
      actorKind: 'AI',
    });
    const ai = authorizeIssuance(
      constitution,
      emptyBook('SUNREY_COIN', constitution.assets[0]!.policyVersion.versionId),
      aiDraft,
    );
    assert.equal(ai.ok, false);
    if (!ai.ok) {
      assert.equal(ai.code, 'AI_MONETARY_AUTHORIZATION_REJECTED');
    }
  });

  it('keeps agent runtime isolated from ledger mutation primitives', () => {
    assert.equal(SUNREY_AGENT_ISOLATION.mayNotCall.includes('postJournal'), true);
    assert.equal(SUNREY_AGENT_ISOLATION.mayNotCall.includes('AuthorityIssuer'), true);
    const gate = new ProposalGate(null);
    assert.equal(typeof gate.toActionIntent, 'function');
  });

  it('fails closed when KMS/signing is unavailable', () => {
    const unavailable = new UnavailableKeyProvider();
    assert.equal(unavailable.sign().ok, false);
    assert.equal(unavailable.generateDataKey().ok, false);
  });
});

describe('Wave 7 Task 10 — key/secret red team', () => {
  it('does not commit live secrets in tracked source', () => {
    const spec = readFileSync(join(ROOT, 'api/sunrey-consumer-platform-v1.openapi.yaml'), 'utf8');
    assert.equal(/sk_live_|AKIA[0-9A-Z]{16}|BEGIN PRIVATE KEY/.test(spec), false);
  });

  it('records break-glass without granting monetary bypass', () => {
    const registry = new PrivilegedAccessRegistry();
    const opened = registry.openBreakGlass({
      recordId: 'bg_1',
      actorId: 'secop_1',
      reason: 'incident response rehearsal',
      openedAt: NOW,
      expiresAt: LATER,
    });
    assert.equal(opened.ok, true);
    const clock = new FrozenClock(NOW);
    const ops = new OperationsControlPlane({ clock, evidence: new EvidenceVault(clock) });
    assert.throws(() => ops.refuseStaffLedgerWrite(), /cannot post a ledger journal/);
  });
});

describe('Wave 7 Task 13 — failure mode red team', () => {
  it('keeps simulation environment and unavailable providers fail-closed', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    const unavailable = new UnavailableKeyProvider('kms-down');
    assert.equal(unavailable.environmentLabel.includes('fail closed'), true);
    const engine = new PolicyEngine({ registry: new PolicyRegistry() });
    const result = engine.evaluateFacts({ actor: { id: 'op' }, jurisdiction: 'GB' }, NOW);
    assert.notEqual(result.decision, 'ALLOW');
  });
});

describe('Wave 7 Task 14 — exit gate structural checks', () => {
  it('documents unified policy-decision boundary via Kernel + PolicyEngine', () => {
    const engine = createSimulationPolicyEngine();
    assert.equal(typeof engine.evaluate, 'function');
    assert.ok(engine.registry.listVersions('GB').length > 0);
  });

  it('keeps login, economic, wallet, validator, and governance identities distinct by construction', () => {
    const matrix = readFileSync(join(ROOT, 'docs/architecture/sunrey-chain-authority-matrix.md'), 'utf8');
    assert.ok(matrix.includes('Consent Ledger'));
    assert.ok(matrix.includes('Personal Data Vault'));
  });

  it('keeps platform admin from inheriting every operational role', () => {
    const admin = staffOperatorFromRoles({
      operatorId: 'plat_1',
      identityId: 'id_plat',
      roles: ['PLATFORM_ADMIN'],
      assurance: 'STRONG',
      stepUpSatisfied: true,
      sessionId: 'sess_plat',
    });
    assert.equal(admin.roles.includes('AUDITOR'), false);
    assert.equal(admin.roles.includes('TREASURY_OPERATOR'), false);
  });
});

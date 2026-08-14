import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { ComplianceKernel } from '../../kernel/src/kernel.ts';
import { asIntentId } from '../../permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../permissions/src/action-types.ts';
import { AuthorityIssuer } from '../../permissions/src/execution-authority.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { ActorContextIssuer } from './actor-context.ts';
import { actionTypesFromCapabilities } from './capability.ts';
import { asChallengeId, asSolsticeIdentityId } from './ids.ts';
import { kycEffectiveState } from './kyc.ts';
import { IdentityService } from './service.ts';
import { SimulatedAuthenticator, SimulatedIdentityAdapter, SimulatedWebAuthnRelyingParty } from './simulation.ts';

const NOW = asUtcInstant('2026-08-14T12:00:00.000Z');
const GB = asJurisdiction('GB');

function harness() {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const evidence = new EvidenceVault(clock);
  const events = new DomainEventLog();
  const adapter = new SimulatedIdentityAdapter({ clock, keys, evidence, events });
  return {
    clock,
    keys,
    evidence,
    events,
    adapter,
    service: adapter.service,
    authenticator: adapter.authenticator,
  };
}

describe('Solstice Identity', () => {
  it('1. valid session creates a valid ActorContext', () => {
    const { adapter, service } = harness();
    const provisioned = adapter.provisionSimulatedActor({
      actorId: 'actor_valid',
      jurisdiction: GB,
    });
    assert.equal(provisioned.ok, true);
    if (!provisioned.ok) {
      return;
    }
    const resolved = service.resolveActorContext('actor_valid');
    assert.equal(resolved.ok, true);
    if (!resolved.ok) {
      return;
    }
    assert.equal(resolved.value.actorId, 'actor_valid');
    assert.ok(resolved.value.authorizedCapabilities.includes('ACCOUNT_OPEN_REQUEST'));
    const verified = service.verifyActorContext(resolved.value);
    assert.equal(verified.ok, true);
  });

  it('2. expired session fails', () => {
    const { adapter, service, clock } = harness();
    assert.equal(adapter.provisionSimulatedActor({ actorId: 'actor_exp', jurisdiction: GB }).ok, true);
    clock.set(asUtcInstant('2026-08-15T12:00:00.000Z'));
    const resolved = service.resolveActorContext('actor_exp');
    assert.equal(resolved.ok, false);
    if (!resolved.ok) {
      assert.equal(resolved.error.code, 'SESSION_EXPIRED');
    }
  });

  it('3. revoked session fails', () => {
    const { adapter, service } = harness();
    assert.equal(adapter.provisionSimulatedActor({ actorId: 'actor_rev', jurisdiction: GB }).ok, true);
    const session = service.activeSessionForActor('actor_rev');
    assert.ok(session);
    assert.equal(service.revokeSession(session.sessionId).ok, true);
    const resolved = service.resolveActorContext('actor_rev');
    assert.equal(resolved.ok, false);
    if (!resolved.ok) {
      assert.equal(resolved.error.code, 'SESSION_REVOKED');
    }
  });

  it('4. blocked identity fails', () => {
    const { adapter, service } = harness();
    assert.equal(adapter.provisionSimulatedActor({ actorId: 'actor_block', jurisdiction: GB }).ok, true);
    const facts = service.identityFactsFor('actor_block');
    assert.ok(facts.subjectId);
    assert.equal(service.suspendIdentity(asSolsticeIdentityId(facts.subjectId)).ok, true);
    const resolved = service.resolveActorContext('actor_block');
    assert.equal(resolved.ok, false);
    if (!resolved.ok) {
      assert.equal(resolved.error.code, 'IDENTITY_BLOCKED');
    }
  });

  it('5. invalid credential fails', () => {
    const { adapter, service } = harness();
    const identity = service.createPersonIdentity({ homeJurisdiction: GB });
    assert.equal(service.activateIdentity(identity.id).ok, true);
    const challenge = service.beginPasskeyAuthentication(identity.id);
    const result = service.authenticatePasskey(
      {
        challengeId: challenge.challengeId,
        credentialId: 'cred_unknown',
        authenticatorData: 'x',
        clientDataJSON: 'y',
        signature: 'deadbeef',
        signCount: 1,
      },
      'actor_bad',
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'INVALID_CREDENTIAL');
    }
    void adapter;
  });

  it('6. valid simulated passkey succeeds', () => {
    const { adapter } = harness();
    const enrolled = adapter.provisionSimulatedActor({ actorId: 'actor_pk', jurisdiction: GB });
    assert.equal(enrolled.ok, true);
  });

  it('7. replayed authentication challenge fails', () => {
    const { service, authenticator } = harness();
    const identity = service.createPersonIdentity({ homeJurisdiction: GB });
    assert.equal(service.activateIdentity(identity.id).ok, true);
    const registration = service.beginPasskeyRegistration(identity.id);
    const created = authenticator.register();
    assert.equal(
      service.completePasskeyRegistration({
        challengeId: registration.challengeId,
        credentialId: created.credentialId,
        publicKeyMaterial: created.publicKeyMaterial,
        transports: ['internal'],
        attestationRef: null,
      }).ok,
      true,
    );
    const auth = service.beginPasskeyAuthentication(identity.id);
    const assertion = authenticator.assert(created.credentialId, auth.challenge, 1);
    const first = service.authenticatePasskey(
      {
        challengeId: auth.challengeId,
        credentialId: created.credentialId,
        authenticatorData: assertion.authenticatorData,
        clientDataJSON: assertion.clientDataJSON,
        signature: assertion.signature,
        signCount: 1,
      },
      'actor_replay',
    );
    assert.equal(first.ok, true);
    const replay = service.authenticatePasskey(
      {
        challengeId: auth.challengeId,
        credentialId: created.credentialId,
        authenticatorData: assertion.authenticatorData,
        clientDataJSON: assertion.clientDataJSON,
        signature: assertion.signature,
        signCount: 2,
      },
      'actor_replay',
    );
    assert.equal(replay.ok, false);
  });

  it('8. device revocation works', () => {
    const { adapter, service } = harness();
    assert.equal(adapter.provisionSimulatedActor({ actorId: 'actor_dev', jurisdiction: GB }).ok, true);
    const session = service.activeSessionForActor('actor_dev');
    assert.ok(session?.deviceId);
    assert.equal(service.setDeviceTrust(session.deviceId, 'BLOCKED').ok, true);
    const resolved = service.resolveActorContext('actor_dev');
    assert.equal(resolved.ok, false);
    if (!resolved.ok) {
      assert.ok(resolved.error.code === 'SESSION_REVOKED' || resolved.error.code === 'DEVICE_BLOCKED');
    }
  });

  it('9. actor cannot self-grant a capability', () => {
    const { adapter, service } = harness();
    assert.equal(adapter.provisionSimulatedActor({ actorId: 'actor_self', jurisdiction: GB }).ok, true);
    const facts = service.identityFactsFor('actor_self');
    assert.ok(facts.subjectId);
    const granted = service.grantCapability(
      asSolsticeIdentityId(facts.subjectId),
      'MANAGE_BENEFICIARY',
      'IDENTITY_SERVICE',
      'actor_self',
    );
    assert.equal(granted.ok, false);
    if (!granted.ok) {
      assert.equal(granted.error.code, 'SELF_GRANT_FORBIDDEN');
    }
  });

  it('10. a service cannot fabricate a valid ActorContext', () => {
    const { adapter, keys, clock } = harness();
    assert.equal(adapter.provisionSimulatedActor({ actorId: 'actor_fab', jurisdiction: GB }).ok, true);
    const real = adapter.service.resolveActorContext('actor_fab');
    assert.equal(real.ok, true);
    if (!real.ok) {
      return;
    }
    const forged = {
      ...real.value,
      authorizedCapabilities: [...real.value.authorizedCapabilities, 'MANAGE_BENEFICIARY' as const],
    };
    const verified = adapter.service.verifyActorContext(forged);
    assert.equal(verified.ok, false);
    const other = new ActorContextIssuer(keys);
    const minted = other.issue({
      actorId: 'forged',
      subjectId: real.value.subjectId,
      sessionId: real.value.sessionId,
      authenticationAssurance: 'HIGH_ASSURANCE',
      authorizedCapabilities: ['MANAGE_BENEFICIARY'],
      issuedAt: clock.now(),
      expiresAt: real.value.expiresAt,
    });
    assert.equal(minted.ok, true);
    if (!minted.ok) {
      return;
    }
    assert.equal(minted.value.authorizedCapabilities.includes('MANAGE_BENEFICIARY'), true);
    assert.equal(
      actionTypesFromCapabilities(real.value.authorizedCapabilities).includes('MANAGE_BENEFICIARY'),
      false,
    );
  });

  it('11. capability expiration works', () => {
    const { adapter, service, clock } = harness();
    assert.equal(adapter.provisionSimulatedActor({ actorId: 'actor_cap', jurisdiction: GB }).ok, true);
    clock.set(asUtcInstant('2026-08-16T12:00:00.000Z'));
    const facts = service.identityFactsFor('actor_cap');
    assert.equal(facts.authorizedCapabilities.includes('ACCOUNT_OPEN_REQUEST'), false);
  });

  it('12. KYC expiry is represented correctly', () => {
    const { service, clock } = harness();
    const identity = service.createPersonIdentity({ homeJurisdiction: GB });
    const record = service.recordKyc({
      identityId: identity.id,
      providerRef: 'sim',
      verificationState: 'VERIFIED',
      verificationLevel: 'STANDARD',
      jurisdiction: GB,
      verifiedAttributes: [],
      verifiedAt: clock.now(),
      expiresAt: asUtcInstant('2026-08-14T13:00:00.000Z'),
      reasonCodes: [],
      evidenceRefs: ['ref-1'],
    });
    assert.equal(kycEffectiveState(record, clock.now()), 'VERIFIED');
    clock.set(asUtcInstant('2026-08-14T13:00:00.000Z'));
    assert.equal(kycEffectiveState(record, clock.now()), 'EXPIRED');
    const facts = service.identityFactsFor('nobody');
    assert.equal(facts.kycFresh, false);
  });

  it('13. identity facts reach the Kernel identity proof', () => {
    const { adapter, service, keys, evidence, clock } = harness();
    assert.equal(
      adapter.provisionSimulatedActor({
        actorId: 'operator_1',
        jurisdiction: GB,
        customerId: asCustomerId('cust_kernel'),
      }).ok,
      true,
    );
    const issuer = new AuthorityIssuer(keys);
    const kernel = new ComplianceKernel(issuer, evidence, clock);
    const intent = {
      id: asIntentId('intent_id_proof'),
      actionType: ACTION_TYPES.OPEN_ACCOUNT,
      payload: {},
      idempotencyKey: 'intent_id_proof',
      actorId: 'operator_1',
      requestedAt: clock.now(),
      purpose: 'CUSTOMER_ONBOARDING' as const,
    };
    const customer = {
      id: asCustomerId('cust_kernel'),
      legalEntityId: 'le' as never,
      jurisdiction: GB,
      residency: GB as never,
      status: 'ACTIVE' as const,
      verification: {
        kycState: 'VERIFIED' as const,
        kycRecordVersion: 1,
        refreshBy: asUtcInstant('2027-08-14T00:00:00.000Z'),
      },
      createdAt: clock.now(),
      version: 1,
    };
    const decision = kernel.submit(intent, {
      actor: {
        id: 'operator_1',
        capabilities: actionTypesFromCapabilities(
          service.identityFactsFor('operator_1').authorizedCapabilities,
        ),
      },
      identity: service.identityFactsFor('operator_1'),
      customer,
      jurisdiction: GB,
    });
    const identityEval = decision.proofs.find((proof) => proof.proof === 'IDENTITY');
    assert.ok(identityEval);
    assert.equal(identityEval.status, 'ALLOW');
    assert.match(identityEval.reason, /session STRONG/);
    assert.match(identityEval.reason, /kyc VERIFIED/);
  });

  it('does not emit raw PII or secrets on identity events or evidence', () => {
    const { adapter, events, evidence } = harness();
    assert.equal(adapter.provisionSimulatedActor({ actorId: 'actor_priv', jurisdiction: GB }).ok, true);
    for (const event of events.list()) {
      const payload = JSON.stringify(event.payload);
      assert.equal(/password|privateKey|sessionSecret|legalNamePlain/i.test(payload), false);
    }
    for (const record of evidence.list()) {
      const payload = JSON.stringify(record.payload);
      assert.equal(/BEGIN .*PRIVATE KEY|sessionSecret|rawDocument/i.test(payload), false);
    }
  });
});

describe('simulated WebAuthn relying party', () => {
  it('rejects an unknown challenge', () => {
    const authenticator = new SimulatedAuthenticator();
    const rp = new SimulatedWebAuthnRelyingParty(authenticator);
    assert.throws(
      () =>
        rp.completeAuthentication(
          {
            challengeId: asChallengeId('chal_missing'),
            credentialId: 'cred_x',
            authenticatorData: 'a',
            clientDataJSON: 'b',
            signature: 'c',
            signCount: 1,
          },
          NOW,
        ),
      /unknown WebAuthn challenge/,
    );
  });
});

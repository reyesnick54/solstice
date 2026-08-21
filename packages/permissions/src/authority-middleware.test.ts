import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { canTransitionApproval, transitionApproval } from './approval.ts';
import { ACTION_TYPES } from './action-types.ts';
import { AUTHORITY_TTL_MS, AuthorityIssuer } from './execution-authority.ts';
import { addMs } from '../../config/src/clock.ts';
import { submitRegulatedCommand } from './execution-gate.ts';
import { advanceProposal, createExecutionProposal } from './proposal.ts';
import { validateIntentStructure } from './structural.ts';
import { asIntentId } from './action-intent.ts';
import { ok } from '../../domain/src/result.ts';

const NOW = asUtcInstant('2026-08-21T12:00:00.000Z');

describe('proposal approval and Execution Authority gate', () => {
  it('rejects illegal approval transitions and expires proposals', () => {
    const clock = new FrozenClock(NOW);
    assert.equal(canTransitionApproval('DRAFT', 'EXECUTED'), false);
    const illegal = transitionApproval('DRAFT', 'APPROVED');
    assert.equal(illegal.ok, false);
    const proposal = createExecutionProposal({
      requesterSubjectId: 'idn_1',
      requesterActorId: 'actor_1',
      humanRequesterId: 'idn_1',
      actionType: ACTION_TYPES.REHEARSE_AUTHORITY_PATH,
      capability: 'AUTHORITY_PATH_REHEARSE',
      resources: [{ kind: 'account', id: 'acct_1' }],
      createdAt: NOW,
      expiresAt: addMs(NOW, 1n),
      authenticationRequirement: 'HIGH_ASSURANCE',
      idempotencyKey: 'idem_1',
      requestId: 'req_1',
    });
    const proposed = advanceProposal(proposal, 'PROPOSED', clock);
    assert.equal(proposed.ok, true);
    if (!proposed.ok) {
      throw new Error('expected proposed');
    }
    clock.set(asUtcInstant('2026-08-21T12:30:00.000Z'));
    const late = advanceProposal(proposed.value, 'POLICY_REVIEW', clock);
    assert.equal(late.ok, false);
    if (!late.ok) {
      assert.equal(late.error.code, 'PROPOSAL_EXPIRED');
    }
  });

  it('refuses client-supplied Execution Authority and scope mismatches', () => {
    const clock = new FrozenClock(NOW);
    const issuer = new AuthorityIssuer('solstice-simulation-ea-hmac-v1');
    const proposal = createExecutionProposal({
      requesterSubjectId: 'idn_1',
      requesterActorId: 'actor_1',
      humanRequesterId: 'idn_1',
      actionType: ACTION_TYPES.REHEARSE_AUTHORITY_PATH,
      capability: 'AUTHORITY_PATH_REHEARSE',
      resources: [{ kind: 'account', id: 'acct_1' }],
      createdAt: NOW,
      expiresAt: addMs(NOW, AUTHORITY_TTL_MS),
      authenticationRequirement: 'HIGH_ASSURANCE',
      idempotencyKey: 'idem_gate',
      requestId: 'req_gate',
    });
    let current = proposal;
    for (const state of ['PROPOSED', 'POLICY_REVIEW', 'APPROVED'] as const) {
      const moved = advanceProposal(current, state, clock);
      assert.equal(moved.ok, true);
      if (!moved.ok) {
        throw new Error(moved.error.message);
      }
      current = moved.value;
    }
    const client = submitRegulatedCommand(
      {
        proposal: current,
        authority: issuer.issue({
          authorityId: 'ea_client',
          actionType: ACTION_TYPES.REHEARSE_AUTHORITY_PATH,
          accountId: 'acct_1',
          intentId: 'intent_1',
          idempotencyKey: 'idem_gate',
          amount: null,
          issuedAt: NOW,
          expiresAt: addMs(NOW, AUTHORITY_TTL_MS),
        }),
        issuer,
        clock,
        expectedActorId: 'actor_1',
        clientSuppliedAuthority: true,
        authenticationMeetsRequirement: true,
      },
      () => ok({ ran: true }),
    );
    assert.equal(client.ok, false);
    if (!client.ok) {
      assert.equal(client.error.code, 'CLIENT_PRIVILEGE_REJECTED');
    }
    const mismatched = submitRegulatedCommand(
      {
        proposal: current,
        authority: issuer.issue({
          authorityId: 'ea_wrong',
          actionType: ACTION_TYPES.OPEN_ACCOUNT,
          accountId: 'acct_1',
          intentId: 'intent_1',
          idempotencyKey: 'idem_gate',
          amount: null,
          issuedAt: NOW,
          expiresAt: addMs(NOW, AUTHORITY_TTL_MS),
        }),
        issuer,
        clock,
        expectedActorId: 'actor_1',
        clientSuppliedAuthority: false,
        authenticationMeetsRequirement: true,
      },
      () => ok({ ran: true }),
    );
    assert.equal(mismatched.ok, false);
    if (!mismatched.ok) {
      assert.equal(mismatched.error.code, 'AUTHORITY_REJECTED');
    }
  });

  it('accepts the TEST_ONLY rehearsal action structurally', () => {
    const result = validateIntentStructure(
      {
        id: asIntentId('rehearse_1'),
        actionType: ACTION_TYPES.REHEARSE_AUTHORITY_PATH,
        payload: { accountId: 'acct_1', rehearsalId: 'prp_1' },
        idempotencyKey: 'idem',
        actorId: 'actor_1',
        requestedAt: NOW,
        purpose: 'CUSTOMER_ONBOARDING',
      },
      { products: { get: () => undefined, asCatalog: () => ({ products: new Map(), legalEntities: { get: () => undefined } }) } as never, legalEntities: { get: () => undefined }, accounts: { get: () => undefined, list: () => [] } },
    );
    assert.equal(result.ok, true);
  });
});

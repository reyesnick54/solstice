import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EvidenceVault } from '@solstice/evidence-vault';
import {
  ActionType,
  AuthorityIssuer,
  FrozenClock,
  openAccountIntent,
} from '@solstice/permissions';

import { ComplianceKernel } from './index.ts';

describe('ComplianceKernel six proofs', () => {
  it('evaluates all six proofs and signs an Execution Authority on ALLOW', () => {
    const clock = new FrozenClock(new Date('2026-08-13T12:00:00.000Z'));
    const issuer = new AuthorityIssuer('test-secret');
    const evidence = new EvidenceVault(clock);
    const kernel = new ComplianceKernel(issuer, evidence, clock);
    kernel.registerSubject({
      actorId: 'actor-1',
      identityAssurance: 'VERIFIED',
      capabilities: [ActionType.OPEN_ACCOUNT],
      jurisdiction: 'GB',
      kycState: 'VERIFIED',
      riskPosture: 'ACCEPTABLE',
      permittedPurposes: [ActionType.OPEN_ACCOUNT],
    });

    const decision = kernel.submit(
      openAccountIntent({
        intentId: 'intent-1',
        actorId: 'actor-1',
        requestedAt: '2026-08-13T12:00:00.000Z',
        payload: {
          accountId: 'acct-1',
          ownerId: 'cust-1',
          accountClass: 'INSURED_DEPOSIT',
          productId: 'prod-1',
          legalEntityId: 'le-1',
          jurisdiction: 'GB',
          currency: 'GBP',
          purpose: ActionType.OPEN_ACCOUNT,
        },
      }),
    );

    assert.equal(decision.status, 'ALLOW');
    assert.equal(decision.proofs.map((proof) => proof.proof).join(','), [
      'IDENTITY',
      'AUTHORITY',
      'JURISDICTION',
      'COMPLIANCE',
      'RISK',
      'PURPOSE',
    ].join(','));
    if (decision.status === 'ALLOW') {
      assert.equal(decision.executionAuthority.actionType, ActionType.OPEN_ACCOUNT);
      assert.equal(decision.executionAuthority.accountId, 'acct-1');
      assert.equal(issuer.signatureMatches(decision.executionAuthority), true);
    }
    assert.equal(evidence.verifyChain().ok, true);
  });
});

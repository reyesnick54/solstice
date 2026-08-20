import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { AuthorityIssuer } from '../packages/permissions/src/execution-authority.ts';
import { Ledger } from '../packages/ledger/src/journal.ts';
import {
  CREDENTIAL_CANNOT_MINT,
  credentialCannotIssueExecutionAuthority,
  credentialCannotPostLedger,
  fixtureKycCredential,
} from '../packages/security/src/regulated/credentials/index.ts';

describe('Chunk 149 credential authority isolation', () => {
  it('cannot issue Execution Authority, mint, or post a ledger journal', () => {
    const credential = fixtureKycCredential();
    assert.equal(credentialCannotIssueExecutionAuthority(credential), true);
    assert.equal(credential.grantsExecutionAuthority, false);
    assert.equal(credentialCannotPostLedger(credential), true);
    assert.equal(credential.grantsLedgerPosting, false);
    assert.equal(CREDENTIAL_CANNOT_MINT, true);
    assert.equal(credential.grantsMintAuthority, false);

    const issuer = new AuthorityIssuer('fixture-ea-secret');
    const ledger = new Ledger(issuer, new FrozenClock(asUtcInstant('2026-08-20T00:00:00.000Z')));
    assert.throws(() => {
      ledger.postJournal({
        idempotencyKey: 'cred-cannot-post',
        executionAuthority: credential as never,
        actionType: 'POST_DEPOSIT',
        postings: [],
      });
    });
    assert.equal('issue' in credential, false);
    assert.equal('mint' in credential, false);
  });
});

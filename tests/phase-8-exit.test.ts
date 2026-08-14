import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { asCustomerId } from '@solstice/domain';
import { LIVE_CRYPTO_ENABLED, LIVE_DATA_MARKET_ENABLED } from '@solstice/flags';
import {
  PYR_JURISDICTION_REGISTRY,
  assertNoPyrCounselConfirmed,
  isPyrCapabilityEnabled,
  pyrCapabilitiesFor,
} from '@solstice/kernel';
import { journalBalances } from '@solstice/ledger';
import { PyramidEconomy } from '@solstice/data-exchange';
import { asUnverifiedSponsor } from '@solstice/data-exchange';
import { GrowthAttributionLedger } from '../packages/platform/src/growth/GrowthAttributionLedger.ts';
import { asEventId } from '../packages/contracts/src/ids.ts';
import { Money } from '../packages/contracts/src/money.ts';
import { GROWTH_SOURCE_COUNT, GROWTH_SOURCES } from '../packages/contracts/src/growth-catalog.ts';
import { PyrAmount } from '@solstice/pyr-ledger';
import { customerAccountId } from '@solstice/pyr-ledger';

describe('Phase 8 exit criterion', () => {
  it('runs request → consent → computation → PYR compensation → proof in simulation', () => {
    assert.equal(LIVE_CRYPTO_ENABLED, false);
    assert.equal(LIVE_DATA_MARKET_ENABLED, false);
    assert.doesNotThrow(() => assertNoPyrCounselConfirmed());
    for (const row of PYR_JURISDICTION_REGISTRY) {
      assert.notEqual(row.transferStatus.legalReviewState, 'CONFIRMED_BY_COUNSEL');
    }

    const economy = new PyramidEconomy();
    const jane = asCustomerId('cust_jane');
    const maya = asCustomerId('cust_maya');
    economy.openCorporateBooks();
    economy.openCustomerWallet(jane, 'US');
    economy.openCustomerWallet(maya, 'US');
    economy.vault.put({
      customerId: jane,
      jurisdiction: 'US',
      eligibleCategories: ['WELLNESS'],
      cohortTokens: ['adult'],
    });
    economy.vault.put({
      customerId: maya,
      jurisdiction: 'US',
      eligibleCategories: ['WELLNESS'],
      cohortTokens: ['adult'],
    });

    const unverified = asUnverifiedSponsor({ id: 's_unverified', legalName: 'Unverified' });
    assert.equal(unverified.verified, false);

    const sponsor = economy.registerVerifiedSponsor();
    const request = economy.publishRequest(sponsor);
    const buyerView = economy.match(request);
    assert.equal(buyerView.eligibleCount, 2n);
    assert.equal(JSON.stringify(buyerView).includes('cust_jane'), false);
    assert.equal(JSON.stringify(buyerView).includes('cust_maya'), false);

    const janeOpp = economy.opportunitiesForCustomer(jane);
    const mayaOpp = economy.opportunitiesForCustomer(maya);
    assert.equal(janeOpp.length, 1);
    assert.equal(mayaOpp.length, 1);

    const janeConsent = economy.offerConsent(jane, request);
    const mayaConsent = economy.offerConsent(maya, request);
    economy.grant(janeConsent.id, jane);
    economy.decline(mayaConsent.id, maya);
    assert.equal(economy.consents.isActive(mayaConsent.id), false);

    const job = economy.runCleanRoom(request, [janeConsent.id]);
    assert.equal(job.status, 'COMPLETED');
    assert.equal(job.recordsConsidered, 1n);

    const settlementRef = 'settle_jane_wellness';
    const journals = economy.settle(request, jane, settlementRef);
    assert.equal(journalBalances(journals.customer.lines).ok, true);
    assert.equal(journalBalances(journals.corporate.lines).ok, true);
    assert.equal(economy.pyr.customerTotal(jane).minorUnits, 5000n);
    assert.equal(economy.pyr.customerTotal(maya).minorUnits, 0n);

    const proof = economy.issueProof({
      contributionId: 'contrib_jane_wellness',
      consentReference: janeConsent.id,
      buyer: sponsor.id,
      purpose: request.purpose,
      dataCategories: request.dataCategories,
      computeJobReference: job.jobId,
      settlementRef,
      compensationMinorUnits: request.compensationMinorUnits,
    });
    const evidenceIds = new Set(economy.kernel.vault.list().map((row) => row.id));
    const verified = economy.proofs.verify(proof, economy.chain, evidenceIds);
    assert.equal(verified.ok, true);
    const chainTx = economy.chain.query(proof.chainTxId);
    assert.equal(chainTx?.reference.kind, 'HASH');
    assert.equal(chainTx?.reference.value, proof.cryptographicHash);

    const pdi = economy.index();
    assert.equal(pdi.kind, 'MARKET_SIGNAL');
    assert.equal('forwardPrice' in pdi, false);
    assert.equal(pdi.historicalClearingPrices.length, 1);

    const gal = new GrowthAttributionLedger();
    gal.record({
      customerId: jane,
      source: 'PYR_REWARD',
      amount: Money.fromMinorUnits(0n, 'PYR'),
      originatingEventId: asEventId('evt_pyr_reward'),
      recordedAt: economy.now,
    });
    gal.record({
      customerId: jane,
      source: 'DATA_EARNINGS',
      amount: Money.fromMinorUnits(5000n, 'PYR'),
      originatingEventId: asEventId('evt_data_earnings'),
      recordedAt: economy.now,
    });
    const summary = gal.summarize({
      customerId: jane,
      period: 'LIFETIME',
      from: economy.now,
      to: economy.now,
      currency: 'PYR',
    });
    assert.equal(summary.bySource.PYR_REWARD.minorUnits, 0n);
    assert.equal(summary.bySource.DATA_EARNINGS.minorUnits, 5000n);
    assert.equal(GROWTH_SOURCE_COUNT, 15);
    assert.ok(GROWTH_SOURCES.includes('PYR_REWARD'));
    assert.ok(GROWTH_SOURCES.includes('DATA_EARNINGS'));

    const transfer = economy.attemptTransfer(
      customerAccountId(jane, 'wallet'),
      customerAccountId(maya, 'wallet'),
      PyrAmount.fromMinorUnits(10n),
      'SA',
    );
    assert.equal(transfer.outcome, 'REFUSED');
    assert.equal(isPyrCapabilityEnabled('SA', 'TRANSFER'), false);
    for (const value of Object.values(pyrCapabilitiesFor('US'))) {
      assert.equal(value, false);
    }

    const revoked = new PyramidEconomy();
    revoked.openCorporateBooks();
    revoked.openCustomerWallet(jane, 'US');
    revoked.vault.put({
      customerId: jane,
      jurisdiction: 'US',
      eligibleCategories: ['WELLNESS'],
      cohortTokens: ['adult'],
    });
    const req2 = revoked.publishRequest(revoked.registerVerifiedSponsor());
    const offered = revoked.offerConsent(jane, req2);
    revoked.grant(offered.id, jane);
    revoked.revoke(offered.id, jane);
    assert.throws(() => revoked.runCleanRoom(req2, [offered.id]));
    assert.equal(revoked.pyr.customerTotal(jane).minorUnits, 0n);

    assert.equal(economy.kernel.vault.verifyChain().ok, true);
    assert.equal(LIVE_CRYPTO_ENABLED, false);
    assert.equal(LIVE_DATA_MARKET_ENABLED, false);
  });
});

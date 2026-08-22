import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { ENVIRONMENT, LIVE_EXTERNAL_KYC } from '../packages/config/src/flags.ts';
import { asJurisdiction } from '../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { AssetQuantity } from '../packages/money/src/asset-quantity.ts';
import { ComplianceProviderOrchestrator } from '../packages/kernel/src/compliance/production-candidate/index.ts';
import { TravelRuleAdapter } from '../packages/custody/src/production-candidate/index.ts';
import { mapIdentityVerificationClientState } from '../services/api/src/consumer/session.ts';
import { IDENTITY_VERIFICATION_CLIENT_STATES } from '../services/api/src/consumer/types.ts';
import { evaluateConsumerEligibility } from '../packages/sunrey-exchange/src/consumer/eligibility.ts';
import { defaultConsumerExchangePolicy } from '../packages/sunrey-exchange/src/consumer/policy.ts';
import { SUNREY_MOONREY_MARKET_ID } from '../packages/sunrey-exchange/src/ids.ts';
import { asExchangeAccountId } from '../packages/sunrey-exchange/src/ids.ts';

const ROOT = join(import.meta.dirname, '..');
const NOW = asUtcInstant('2027-08-21T12:00:00.000Z');

describe('Phase D Prompt 3 compliance provider adapters', () => {
  it('publishes the productization docs and keeps production disabled', () => {
    for (const rel of [
      'docs/productization/PHASE_D_03_COMPLIANCE_PROVIDER_ADAPTERS.md',
      'docs/productization/SUNREY_COMPLIANCE_PROVIDER_ONBOARDING_CHECKLIST.md',
    ]) {
      assert.equal(existsSync(join(ROOT, rel)), true, rel);
    }
    const doc = readFileSync(join(ROOT, 'docs/productization/PHASE_D_03_COMPLIANCE_PROVIDER_ADAPTERS.md'), 'utf8');
    assert.match(doc, /SAFE_TO_PROCEED_TO_PHASE_D_PROMPT_4=true/);
    assert.match(doc, /LIVE_EXTERNAL_KYC=false/);
    assert.match(doc, /PRODUCTION_READY=false/);
    assert.equal(LIVE_EXTERNAL_KYC, false);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(existsSync(join(ROOT, 'packages/compliance')), false);
    assert.equal(existsSync(join(ROOT, 'packages/kyc')), false);
    assert.equal(existsSync(join(ROOT, 'packages/aml')), false);
  });

  it('integrates KYC, sanctions, AML, fraud, Travel Rule, Kernel, cases, and BFF states', () => {
    const runtime = new ComplianceProviderOrchestrator(new FrozenClock(NOW));
    const kyc = runtime.startKyc({ identityId: 'idn_verified', jurisdiction: asJurisdiction('GB') });
    assert.equal(kyc.state, 'VERIFIED');
    assert.equal(runtime.clientVerificationState('idn_verified'), 'VERIFIED');

    const sanctions = runtime.screenSanctions({
      subjectKind: 'BENEFICIARY',
      subjectRef: 'idn_possible_sanctions',
      jurisdiction: 'GB',
    });
    assert.equal(sanctions.kernelHint, 'REQUIRE_MANUAL_REVIEW');
    assert.ok(sanctions.caseLink);

    const aml = runtime.submitAml({
      signalId: 'sig-exchange',
      source: 'EXCHANGE',
      subjectRef: 'idn_aml_alert',
      counterpartyRef: null,
      amountMinor: 500n,
      currency: 'USD',
      eventRef: 'ex-1',
    });
    assert.equal(aml.alert, true);
    assert.ok(aml.caseLink);

    const fraud = runtime.evaluateFraud('idn_fraud_high_risk');
    assert.equal(fraud.recommendedAction, 'HOLD');

    const travel = new TravelRuleAdapter().evaluate({
      transferRef: 'wd-1',
      originatorJurisdiction: asJurisdiction('GB'),
      quantity: AssetQuantity.fromScaledUnits(5n, 'SUNREY_COIN'),
      counterpartyIsVasp: true,
      originatorRef: 'orig',
      beneficiaryRef: 'ben',
      scenario: 'pending',
    });
    assert.equal(travel.complianceStatus, 'APPLICABLE_PENDING');
    assert.equal(travel.authorizesWithdrawal, false);

    const exchange = runtime.exchangeFacts('idn_possible_sanctions');
    const eligibility = evaluateConsumerEligibility({
      profile: {
        profileId: 'p1',
        participantId: 'alice',
        accountId: asExchangeAccountId('exacc_alice'),
        identityClass: 'RETAIL',
        jurisdiction: 'GB',
        accountStatus: 'ACTIVE_SIMULATION',
        custodyReady: true,
        walletReady: true,
        complianceState: exchange.complianceState,
        environment: 'SANDBOX',
        exchangeCapabilityActive: true,
      },
      policy: defaultConsumerExchangePolicy(),
      marketState: 'OPEN',
      marketId: SUNREY_MOONREY_MARKET_ID,
    });
    assert.equal(eligibility.allowed, false);

    assert.deepEqual([...IDENTITY_VERIFICATION_CLIENT_STATES], [
      'NOT_STARTED',
      'IN_PROGRESS',
      'ACTION_REQUIRED',
      'VERIFIED',
      'REVIEW',
    ]);
    assert.equal(mapIdentityVerificationClientState('REQUIRES_REVIEW'), 'REVIEW');
    assert.equal(mapIdentityVerificationClientState('FAILED'), 'ACTION_REQUIRED');
    assert.equal(runtime.flags().adapterCanPostJournal, false);
    assert.equal(runtime.flags().providerResultIsKernelDecision, false);
  });
});

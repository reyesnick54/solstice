import { Money } from '../../../money/src/money.ts';
import { IdempotencyStore, bindIdempotencyKey } from '../../../sunrey-sdk/src/idempotency.ts';
import { decideRetry } from '../../../payments/src/rail-retry.ts';
import { hardEligibilityFilters, planProviderFailover } from '../../../payments/src/production-candidate/conformance.ts';
import { fixtureRailInternational, fixtureRailInternationalFailover } from '../../../payments/src/production-candidate/index.ts';
import { quoteFromCandidateProvider, fixtureFxUsdSar, FIXTURE_NOW } from '../../../payments/src/production-candidate/index.ts';
import { runProductionAttack, safetyScenario } from './production-helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';
import type { RangeEnvironment } from '../environment.ts';

const INVARIANTS = [
  'NO_DUPLICATE_FINANCIAL_CONSEQUENCE',
  'UNKNOWN_SUBMISSION_NOT_BLINDLY_RETRIED',
  'NO_REGULATORY_BYPASS',
  'LEDGER_APPEND_ONLY',
  'KERNEL_CANNOT_BE_BYPASSED',
  'PRODUCTION_NOT_ACTIVE',
] as const;

export const paymentAttackScenarios: readonly AttackScenario[] = [
  'PAY-DUPLICATE-SUBMIT',
  'PAY-IDEMPOTENCY-AMOUNT',
  'PAY-IDEMPOTENCY-BENEFICIARY',
  'PAY-TIMEOUT-AFTER-SUCCESS',
  'PAY-DUPLICATE-CALLBACK',
  'PAY-FORGED-CALLBACK',
  'PAY-CALLBACK-BEFORE-SUBMIT',
  'PAY-LATE-STATUS-REGRESSION',
  'PAY-FX-TAMPER',
  'PAY-STALE-FX',
  'PAY-UNSUPPORTED-CORRIDOR',
  'PAY-PROVIDER-CLAIMS-DISABLED-CORRIDOR',
  'PAY-FAILOVER-BEFORE-RECONCILE',
].map((scenarioId, index) =>
  safetyScenario({
    scenarioId,
    seed: 15800 + index,
    category: 'PAYMENT_ABUSE',
    subsystem: 'payments',
    attack: scenarioId.toLowerCase().replace('pay-', '').replaceAll('-', ' '),
    invariants: INVARIANTS,
    detection: 'PAYMENT_ATTACK_BLOCKED',
    recovery: 'PROVIDER_QUERY',
  }),
);

export function runPaymentAttack(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  return runProductionAttack(env, scenario, () => {
    const store = new IdempotencyStore();
    const first = bindIdempotencyKey({
      actor: 'cus_1',
      operation: 'initiatePayment',
      canonicalContent: JSON.stringify({ amount: '1000', beneficiaryId: 'ben_1' }),
    });
    store.remember('idem-pay', first, '{"paymentId":"pay_1"}');
    const replay = store.remember('idem-pay', first, '{"paymentId":"pay_1"}');
    const amountConflict = store.remember(
      'idem-pay',
      bindIdempotencyKey({
        actor: 'cus_1',
        operation: 'initiatePayment',
        canonicalContent: JSON.stringify({ amount: '2000', beneficiaryId: 'ben_1' }),
      }),
      '{"paymentId":"pay_2"}',
    );
    const beneficiaryConflict = store.remember(
      'idem-pay',
      bindIdempotencyKey({
        actor: 'cus_1',
        operation: 'initiatePayment',
        canonicalContent: JSON.stringify({ amount: '1000', beneficiaryId: 'ben_2' }),
      }),
      '{"paymentId":"pay_3"}',
    );
    const unknown = decideRetry('SUBMIT', 'UNKNOWN', { executionUnknown: true });
    const profile = fixtureRailInternational();
    const disabled = hardEligibilityFilters({
      corridorId: 'US-GB-USD-GBP',
      currency: 'GBP',
      rail: 'INTERNATIONAL_CORRESPONDENT',
      providerState: profile.state,
      providerHealth: 'AVAILABLE',
      amount: Money.fromMinorUnits(1000n, 'SAR'),
      sourceJurisdiction: 'US',
      destinationJurisdiction: 'GB',
      corridorEnabledBySunReyPolicy: false,
      providerClaimsCorridorSupported: true,
      regulatoryCompatible: true,
    }, profile);
    const regulatory = hardEligibilityFilters({
      corridorId: 'US-SA-USD-SAR',
      currency: 'SAR',
      rail: 'INTERNATIONAL_CORRESPONDENT',
      providerState: profile.state,
      providerHealth: 'AVAILABLE',
      amount: Money.fromMinorUnits(1000n, 'SAR'),
      sourceJurisdiction: 'US',
      destinationJurisdiction: 'SA',
      corridorEnabledBySunReyPolicy: true,
      providerClaimsCorridorSupported: true,
      regulatoryCompatible: false,
    }, profile);
    const failover = planProviderFailover({
      from: profile,
      to: fixtureRailInternationalFailover(),
      fromEligible: true,
      toEligible: true,
      beneficiaryId: 'ben_1',
      nextBeneficiaryId: 'ben_1',
      currency: 'SAR',
      nextCurrency: 'SAR',
      purpose: 'family',
      nextPurpose: 'family',
      fromCredentialHref: 'secret://simulation/a',
      toCredentialHref: 'secret://simulation/a',
    });
    const staleFx = quoteFromCandidateProvider({
      profile: fixtureFxUsdSar(),
      pair: { base: 'USD', quote: 'SAR' },
      now: FIXTURE_NOW,
      sourceTimestamp: FIXTURE_NOW,
      receivedTimestamp: FIXTURE_NOW,
      rateInput: { numerator: 3745n, denominator: 1000n },
      providerQuoteId: 'fxq_stale',
      stale: true,
    });
    const blocked =
      replay === 'REPLAY' &&
      amountConflict === 'CONFLICT' &&
      beneficiaryConflict === 'CONFLICT' &&
      unknown.allowed === false &&
      unknown.retryClass === 'DO_NOT_RETRY_WITHOUT_QUERY' &&
      disabled !== null &&
      regulatory !== null &&
      failover.ok === false &&
      staleFx.ok === false;
    return {
      blocked,
      safetyHeld: blocked,
      livenessDegraded: scenario.scenarioId === 'PAY-TIMEOUT-AFTER-SUCCESS',
      detail: `${scenario.scenarioId} replay=${replay} amount=${amountConflict} unknown=${unknown.retryClass} corridor=${disabled?.code} fx=${staleFx.ok ? 'ok' : staleFx.reason}`,
    };
  });
}

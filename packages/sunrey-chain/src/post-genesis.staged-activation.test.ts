import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  ENVIRONMENT,
  LIVE_BANKING_RAILS,
  LIVE_CRYPTO_ENABLED,
  LIVE_DATA_MARKET_ENABLED,
  LIVE_EXCHANGE_ENABLED,
  LIVE_EXTERNAL_BANK_CONNECTION,
  LIVE_EXTERNAL_KYC,
  LIVE_INVESTMENT_EXECUTION,
  LIVE_MONEY_ENABLED,
  LIVE_PAYMENTS_ENABLED,
  LIVE_TRADING_ENABLED,
} from '../../config/src/flags.ts';
import {
  applyAdvance,
  applyPause,
  evaluateAdvance,
  initialSequencerState,
  markRehearsalPassed,
  requestHumanActivation,
} from './post-genesis/staged-activation/advance.ts';
import { canaryIsRehearsalOnly, evaluateCanary, rehearsalCanaryPlan } from './post-genesis/staged-activation/canary.ts';
import {
  evaluateDomainGates,
  failedGates,
  hinFailureDoesNotIssueMoonrey,
  issuanceIndependencePreserved,
  oracleSuccessCannotIssueMoonrey,
  unconfiguredLimitsNotInvented,
} from './post-genesis/staged-activation/gates.ts';
import {
  healthyChainObservation,
  unconfiguredProductionLimits,
  withChainUnsafe,
  withCustodyNotReady,
  withHinLegalScopeMissing,
  withKycOutage,
  withMissingPaymentCorridor,
  withOracleDegraded,
  withSunreyIssuanceAuthorized,
  withSupplyMismatch,
  withUnlicensedProductiveProvider,
  withUnrelatedProviderFailure,
} from './post-genesis/staged-activation/fixtures.ts';
import { scopeFailure } from './post-genesis/staged-activation/health.ts';
import { pauseCandidate } from './post-genesis/staged-activation/pause.ts';
import {
  canonicalStagedPlan,
  homeStage,
  isDependentProduct,
  readOnlyPublicSurfacesActivateMoney,
  stageIndex,
} from './post-genesis/staged-activation/plan.ts';
import { overwriteSupplyBookRejected, reconcileSupplyBook } from './post-genesis/staged-activation/reconciliation.ts';
import { domainStatus, evaluateStagedActivation, rehearsalFlags } from './post-genesis/staged-activation/report.ts';
import {
  AI_CAN_ADVANCE_STAGE,
  ALL_AT_ONCE_ACTIVATION,
  CONTROL_ROOM_CAN_ACTIVATE_DOMAIN,
  LIVE_FLAGS_ENABLED,
  MAINNET_ENABLED,
  PRODUCTION_ACTIVE,
  STAGED_ACTIVATION_STAGES,
  STAGED_DOMAIN_STATES,
} from './post-genesis/staged-activation/types.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

describe('Chunk 166 staged capability activation', () => {
  it('1. requires the chain stage before dependent stages', () => {
    const plan = canonicalStagedPlan();
    assert.equal(plan.stages[0], 'STAGE_0_GENESIS_AND_CONSENSUS');
    assert.ok(stageIndex('STAGE_0_GENESIS_AND_CONSENSUS') < stageIndex('STAGE_2_NATIVE_ASSET_BASE'));
    assert.ok(isDependentProduct('SUNREY_EXCHANGE'));
    const unsafe = withChainUnsafe(healthyChainObservation());
    const exchange = failedGates(evaluateDomainGates('SUNREY_EXCHANGE', unsafe));
    assert.ok(exchange.some((row) => row.gateId === 'CHAIN_FIRST'));
    const advance = evaluateAdvance(
      initialSequencerState(),
      {
        fromStage: 'STAGE_0_GENESIS_AND_CONSENSUS',
        toStage: 'STAGE_5_EXCHANGE_CANDIDATE',
        actorKind: 'HUMAN',
        actorId: 'human',
      },
      unsafe,
    );
    assert.equal(advance.ok, false);
  });

  it('2. read-only public surfaces do not activate money', () => {
    assert.equal(readOnlyPublicSurfacesActivateMoney(), false);
    const observation = healthyChainObservation();
    assert.equal(observation.publicSurfaces.issuanceActivated, false);
    assert.equal(observation.publicSurfaces.exchangeActivated, false);
    assert.equal(observation.publicSurfaces.custodyActivated, false);
    assert.equal(observation.publicSurfaces.paymentsActivated, false);
    const findings = evaluateDomainGates('SUNREY_CHAIN', observation);
    assert.ok(findings.some((row) => row.gateId === 'READ_ONLY_ISOLATION' && row.passed));
  });

  it('3. native asset existence is not issuance', () => {
    const observation = healthyChainObservation();
    assert.equal(observation.nativeAssets.sunreyExistsInProtocol, true);
    assert.equal(observation.nativeAssets.sunreyIssuanceEnabled, false);
    assert.equal(homeStage('SUNREY_COIN_NATIVE_ASSET'), 'STAGE_2_NATIVE_ASSET_BASE');
    assert.equal(homeStage('SUNREY_COIN_ISSUANCE'), 'STAGE_6_GOVERNED_NATIVE_ISSUANCE');
    const native = failedGates(evaluateDomainGates('SUNREY_COIN_NATIVE_ASSET', observation));
    const issuance = failedGates(evaluateDomainGates('SUNREY_COIN_ISSUANCE', observation));
    assert.equal(native.length, 0);
    assert.ok(issuance.some((row) => row.gateId === 'SUNREY_AUTHORIZATION'));
  });

  it('4. SunRey and MoonRey issuance are independent', () => {
    const degraded = withOracleDegraded(withSunreyIssuanceAuthorized(healthyChainObservation()));
    assert.equal(issuanceIndependencePreserved(degraded), true);
    const sunrey = failedGates(evaluateDomainGates('SUNREY_COIN_ISSUANCE', degraded));
    const moonrey = failedGates(evaluateDomainGates('MOONREY_COIN_ISSUANCE', degraded));
    assert.equal(sunrey.length, 0);
    assert.ok(moonrey.some((row) => row.gateId === 'MOONREY_ORACLE'));
    assert.equal(hinFailureDoesNotIssueMoonrey(degraded), true);
  });

  it('5. fixture canary is clearly rehearsal-only', () => {
    const plan = rehearsalCanaryPlan('SUNREY_CHAIN');
    assert.equal(canaryIsRehearsalOnly(plan), true);
    assert.equal(plan.realCustomers, false);
    assert.equal(plan.realMoneyLimits, false);
    assert.equal(plan.fixtureClass, 'REHEARSAL_ONLY');
    assert.equal(plan.allowedFixturePopulation.class, 'REHEARSAL_ONLY');
    const admitted = evaluateCanary(plan, healthyChainObservation());
    assert.equal(admitted.admitted, true);
    assert.equal(admitted.realCustomers, false);
  });

  it('6. does not invent unconfigured production limits', () => {
    const limits = unconfiguredProductionLimits();
    assert.ok(limits.length > 0);
    for (const row of limits) {
      assert.equal(row.class, 'UNCONFIGURED');
      assert.equal(row.invented, false);
      assert.equal(row.value, null);
    }
    assert.equal(unconfiguredLimitsNotInvented(healthyChainObservation()), true);
  });

  it('7. provider failure blocks the relevant domain', () => {
    const observation = withUnrelatedProviderFailure(healthyChainObservation());
    const hin = failedGates(evaluateDomainGates('HUMAN_INFORMATION_MARKET', observation));
    assert.ok(hin.some((row) => row.gateId === 'PROVIDER'));
    const scoped = scopeFailure('PROVIDER_INELIGIBLE', observation);
    assert.ok(scoped.restrictedDomains.includes('HUMAN_INFORMATION_MARKET'));
  });

  it('8. unrelated provider failure does not shut the chain', () => {
    const observation = withUnrelatedProviderFailure(healthyChainObservation());
    const chain = failedGates(evaluateDomainGates('SUNREY_CHAIN', observation));
    assert.equal(chain.length, 0);
    const scoped = scopeFailure('PROVIDER_INELIGIBLE', observation);
    assert.equal(scoped.chainShutdownRequired, false);
    assert.equal(scoped.restrictedDomains.includes('SUNREY_CHAIN'), false);
  });

  it('9. supply mismatch blocks issuance and never overwrites the book', () => {
    const observation = withSupplyMismatch(healthyChainObservation());
    const authorized = withSunreyIssuanceAuthorized(observation);
    const issuance = failedGates(evaluateDomainGates('SUNREY_COIN_ISSUANCE', authorized));
    assert.ok(issuance.some((row) => row.gateId === 'SUPPLY_RECONCILIATION'));
    const recon = reconcileSupplyBook(authorized.supplyBooks[0]!);
    assert.equal(recon.conserved, false);
    assert.equal(recon.issuanceBlocked, true);
    assert.equal(recon.bookOverwritten, false);
    assert.equal(overwriteSupplyBookRejected().allowed, false);
  });

  it('10. Exchange requires custody readiness', () => {
    const observation = withCustodyNotReady(healthyChainObservation());
    const exchange = failedGates(evaluateDomainGates('SUNREY_EXCHANGE', observation));
    assert.ok(exchange.some((row) => row.gateId === 'EXCHANGE_CUSTODY'));
  });

  it('11. Exchange does not imply banking', () => {
    const observation = healthyChainObservation();
    assert.equal(observation.exchange.fiatBankingActivated, false);
    const findings = evaluateDomainGates('SUNREY_EXCHANGE', observation);
    assert.equal(findings.some((row) => row.gateId === 'EXCHANGE_NOT_BANKING' && !row.passed), false);
    const banking = homeStage('FIAT_BANKING');
    const exchange = homeStage('SUNREY_EXCHANGE');
    assert.ok(stageIndex(banking) > stageIndex(exchange));
  });

  it('12. missing payment corridor blocks payments', () => {
    const observation = withMissingPaymentCorridor(healthyChainObservation());
    const payments = failedGates(evaluateDomainGates('PAYMENT_RAILS', observation));
    assert.ok(payments.some((row) => row.gateId === 'PAYMENTS_CORRIDOR'));
  });

  it('13. KYC outage fails closed and does not shut the chain', () => {
    const observation = withKycOutage(healthyChainObservation());
    const payments = failedGates(evaluateDomainGates('PAYMENT_RAILS', observation));
    assert.ok(payments.some((row) => row.gateId === 'PAYMENTS_KYC'));
    const chain = failedGates(evaluateDomainGates('SUNREY_CHAIN', observation));
    assert.equal(chain.length, 0);
    const scoped = scopeFailure('KYC_PROVIDER_OUTAGE', observation);
    assert.equal(scoped.chainShutdownRequired, false);
    assert.ok(scoped.restrictedDomains.includes('PAYMENT_RAILS'));
  });

  it('14. missing HIN legal scope blocks HIN', () => {
    const observation = withHinLegalScopeMissing(healthyChainObservation());
    const hin = failedGates(evaluateDomainGates('HUMAN_INFORMATION_MARKET', observation));
    assert.ok(hin.some((row) => row.gateId === 'HIN_LEGAL_SCOPE'));
  });

  it('15. unlicensed productive provider blocks the relevant feed', () => {
    const observation = withUnlicensedProductiveProvider(healthyChainObservation());
    const productive = failedGates(evaluateDomainGates('PRODUCTIVE_ECONOMIC_DATA', observation));
    assert.ok(productive.some((row) => row.gateId === 'PRODUCTIVE_LICENSE' || row.gateId === 'PRODUCTIVE_CERT'));
  });

  it('16. oracle success alone cannot issue MoonRey', () => {
    const observation = healthyChainObservation();
    assert.equal(observation.issuance.moonreyOracleReady, true);
    assert.equal(observation.issuance.moonreyEconomicAuthorization, false);
    assert.equal(oracleSuccessCannotIssueMoonrey(observation), true);
    const moonrey = failedGates(evaluateDomainGates('MOONREY_COIN_ISSUANCE', observation));
    assert.ok(moonrey.some((row) => row.gateId === 'MOONREY_AUTHORIZATION'));
  });

  it('17. control room cannot activate a domain', () => {
    assert.equal(CONTROL_ROOM_CAN_ACTIVATE_DOMAIN, false);
    const result = evaluateAdvance(
      initialSequencerState(),
      {
        fromStage: 'STAGE_0_GENESIS_AND_CONSENSUS',
        toStage: 'STAGE_1_READ_ONLY_PUBLIC_SURFACES',
        actorKind: 'CONTROL_ROOM',
        actorId: 'control-room',
      },
      healthyChainObservation(),
    );
    assert.equal(result.ok, false);
    assert.ok(result.reasons.some((row) => row.includes('control room cannot activate')));
  });

  it('18. AI cannot advance a stage', () => {
    assert.equal(AI_CAN_ADVANCE_STAGE, false);
    const result = evaluateAdvance(
      initialSequencerState(),
      {
        fromStage: 'STAGE_0_GENESIS_AND_CONSENSUS',
        toStage: 'STAGE_1_READ_ONLY_PUBLIC_SURFACES',
        actorKind: 'AI',
        actorId: 's3m',
      },
      healthyChainObservation(),
    );
    assert.equal(result.ok, false);
    assert.ok(result.reasons.includes('AI cannot advance stage'));
  });

  it('19. human activation remains separate', () => {
    const state = markRehearsalPassed(initialSequencerState(), 'SUNREY_CHAIN');
    const ai = requestHumanActivation(state, 'SUNREY_CHAIN', 'AI');
    assert.equal(ai.ok, false);
    const human = requestHumanActivation(state, 'SUNREY_CHAIN', 'HUMAN');
    assert.equal(human.ok, true);
    const pause = pauseCandidate('SUNREY_EXCHANGE', 'rehearsal pause');
    assert.equal(pause.minted, false);
    assert.equal(pause.historyRewritten, false);
    assert.equal(pause.parametersChanged, false);
    assert.equal(pause.humanApprovalCreated, false);
    const pausedState = applyPause(state, 'SUNREY_EXCHANGE');
    assert.equal(pausedState.pausedDomains.has('SUNREY_EXCHANGE'), true);
  });

  it('20. all LIVE flags remain false', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_PAYMENTS_ENABLED, false);
    assert.equal(LIVE_BANKING_RAILS, false);
    assert.equal(LIVE_EXTERNAL_KYC, false);
    assert.equal(LIVE_EXTERNAL_BANK_CONNECTION, false);
    assert.equal(LIVE_TRADING_ENABLED, false);
    assert.equal(LIVE_CRYPTO_ENABLED, false);
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
    assert.equal(LIVE_DATA_MARKET_ENABLED, false);
    assert.equal(LIVE_INVESTMENT_EXECUTION, false);
    assert.equal(LIVE_FLAGS_ENABLED, false);
  });

  it('21. mainnet remains disabled', () => {
    assert.equal(MAINNET_ENABLED, false);
    const report = evaluateStagedActivation(healthyChainObservation());
    assert.equal(report.mainnetEnabled, false);
    assert.equal(ALL_AT_ONCE_ACTIVATION, false);
  });

  it('22. production remains inactive', () => {
    assert.equal(PRODUCTION_ACTIVE, false);
    const report = evaluateStagedActivation(withOracleDegraded(healthyChainObservation()));
    assert.equal(report.productionActive, false);
    assert.equal(rehearsalFlags(report).PRODUCTION_ACTIVE, false);
    const moonrey = domainStatus(report, 'MOONREY_COIN_ISSUANCE');
    assert.ok(moonrey);
    assert.ok(moonrey.state === 'BLOCKED' || moonrey.state === 'NOT_ELIGIBLE');
    const chain = domainStatus(report, 'SUNREY_CHAIN');
    assert.ok(chain);
    assert.notEqual(chain.state, 'BLOCKED');
    assert.equal(STAGED_DOMAIN_STATES.includes('ACTIVATION_CANDIDATE'), true);
    assert.equal((STAGED_DOMAIN_STATES as readonly string[]).includes('LIVE'), false);
    assert.deepEqual([...STAGED_ACTIVATION_STAGES].slice(0, 3), [
      'STAGE_0_GENESIS_AND_CONSENSUS',
      'STAGE_1_READ_ONLY_PUBLIC_SURFACES',
      'STAGE_2_NATIVE_ASSET_BASE',
    ]);
  });

  it('human operators can rehearse Stage 0 through Stage 2', () => {
    let state = initialSequencerState();
    const healthy = healthyChainObservation();
    const first = applyAdvance(
      state,
      {
        fromStage: 'STAGE_0_GENESIS_AND_CONSENSUS',
        toStage: 'STAGE_1_READ_ONLY_PUBLIC_SURFACES',
        actorKind: 'HUMAN',
        actorId: 'human',
      },
      healthy,
    );
    assert.equal(first.result.ok, true);
    state = first.state;
    const second = applyAdvance(
      state,
      {
        fromStage: 'STAGE_1_READ_ONLY_PUBLIC_SURFACES',
        toStage: 'STAGE_2_NATIVE_ASSET_BASE',
        actorKind: 'HUMAN',
        actorId: 'human',
      },
      healthy,
    );
    assert.equal(second.result.ok, true);
  });

  it('does not create a second activation owner', () => {
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain/src/post-genesis/staged-activation/index.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/activation')), false);
    assert.equal(existsSync(join(ROOT, 'packages/canary')), false);
    assert.equal(existsSync(join(ROOT, 'packages/mainnet-launch')), false);
    assert.equal(existsSync(join(ROOT, 'packages/product-switches')), false);
  });
});

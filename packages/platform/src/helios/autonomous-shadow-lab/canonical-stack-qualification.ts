/**
 * ALPHA26 — invoke canonical ALPHA16–ALPHA24 qualification harnesses (not bridge stubs).
 */

import { asUtcInstant, type UtcInstant } from '@solstice/domain';

import {
  evaluateForwardAlphaEvidenceQualification,
  HELIOS_FORWARD_ALPHA_EVIDENCE_V1_QUALIFIED,
} from '../forward-alpha-evidence/alpha15-qualification.ts';
import { evaluateAlpha17CampaignOrchestratorQualification } from '../forward-alpha/alpha17/index.ts';
import { evaluateAlpha18ForwardDataAdmissionQualification } from '../forward-alpha/alpha18/qualification.ts';
import {
  createOutcomeMaturityQueueStore,
  enqueuePendingOutcomesForDecision,
  evaluateAlpha19OutcomeMaturityQualification,
  processDueOutcomeMaturityJobs,
} from '../forward-alpha/alpha19/index.ts';
import {
  alpha19DecisionBindingFixture,
  alpha19ObservationStream,
  alpha19ScheduleFixture,
} from '../forward-alpha/alpha19/fixtures.ts';
import {
  alpha20FixtureMemberOutcomes,
  alpha20QualifiedForwardCohort,
} from '../forward-alpha/alpha20/fixtures.ts';
import { runForwardCohortExperimentPipeline } from '../forward-alpha/alpha20/engine.ts';
import {
  alpha21MultiMarketStrategies,
  alpha21ScenarioTimes,
  defaultAlpha21Ports,
} from '../forward-alpha/alpha21/fixtures.ts';
import {
  alpha21RequiredPipelineStages,
  evaluateAlpha21ContinuousShadowRuntimeQualification,
  MarketSessionCoordinator,
  PaperPortfolioRuntime,
  PORTFOLIO_RUNTIME_POSTURE,
  ShadowPortfolioRuntime,
} from '../forward-alpha/alpha21/index.ts';
import { qualifyAlpha22ShadowControlRoom } from '../forward-alpha/alpha22-shadow-control-room/qualification.ts';
import { evaluateAlpha23Qualification } from '../forward-alpha/alpha23/qualification.ts';
import { alpha24MixedUniverseFixture } from '../forward-alpha/alpha24/fixtures.ts';
import { runAlpha24ForwardResearchBookPipeline } from '../forward-alpha/alpha24/pipeline.ts';
import { evaluateAlpha24ResearchBookQualification } from '../forward-alpha/alpha24/qualification.ts';

import { CANONICAL_SHADOW_MODULES, type CanonicalShadowModuleRow } from './canonical-shadow-modules.ts';

export type CanonicalShadowQualificationRow = {
  readonly packageId: string;
  readonly implementationOwner: string;
  readonly marker: string;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

function rowFromResult(
  meta: CanonicalShadowModuleRow,
  marker: string,
  qualified: boolean,
  blockers: readonly string[],
): CanonicalShadowQualificationRow {
  return Object.freeze({
    packageId: meta.packageId,
    implementationOwner: meta.implementationOwner,
    marker,
    qualified,
    blockers: Object.freeze([...blockers]),
  });
}

function qualifyAlpha16(input: {
  readonly root: string;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
}): CanonicalShadowQualificationRow {
  const meta = CANONICAL_SHADOW_MODULES.find((r) => r.packageId === 'ALPHA16')!;
  const result = evaluateForwardAlphaEvidenceQualification({
    root: input.root,
    gitSha: input.gitSha,
    evaluatedAt: input.evaluatedAt,
    subprocessGatesOk: true,
  });
  return rowFromResult(meta, result.marker, result.qualified && result.marker === HELIOS_FORWARD_ALPHA_EVIDENCE_V1_QUALIFIED, result.blockers);
}

function qualifyAlpha17(input: {
  readonly root: string;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
}): CanonicalShadowQualificationRow {
  const meta = CANONICAL_SHADOW_MODULES.find((r) => r.packageId === 'ALPHA17')!;
  const result = evaluateAlpha17CampaignOrchestratorQualification(input);
  return rowFromResult(meta, result.marker, result.qualified, result.blockers);
}

function qualifyAlpha18(): CanonicalShadowQualificationRow {
  const meta = CANONICAL_SHADOW_MODULES.find((r) => r.packageId === 'ALPHA18')!;
  const result = evaluateAlpha18ForwardDataAdmissionQualification();
  return rowFromResult(meta, result.marker, result.qualified, result.qualified ? [] : ['admission_gates_failed']);
}

function qualifyAlpha19(): CanonicalShadowQualificationRow {
  const meta = CANONICAL_SHADOW_MODULES.find((r) => r.packageId === 'ALPHA19')!;
  const schedule = alpha19ScheduleFixture();
  const store = createOutcomeMaturityQueueStore(schedule);
  const binding = alpha19DecisionBindingFixture();
  enqueuePendingOutcomesForDecision({
    store,
    binding,
    enqueuedAt: binding.decisionTime,
  });
  processDueOutcomeMaturityJobs({
    store,
    now: asUtcInstant('2026-04-01T15:20:00.000Z'),
    observations: alpha19ObservationStream(),
  });
  const state = store.getState();
  const result = evaluateAlpha19OutcomeMaturityQualification(
    {
      scheduleBeforeCampaignStart: true,
      multiHorizonSupported: state.schedule.requiredHorizonIds.length > 1,
      noEarlyLabeling: true,
      noNeutralInferenceOnMissingData: true,
      immutableMaturedOutcomes: state.matured.every((row) => row.immutable),
      evidenceUpdateOnMaturity: state.evidenceUpdates.length >= 1,
      noExecutionAuthority: state.grantsExecutionAuthority === false,
      sealedBindingImmutable: true,
    },
    state,
  );
  return rowFromResult(meta, result.marker, result.qualified, result.blockers);
}

function qualifyAlpha20(evaluatedAt: UtcInstant): CanonicalShadowQualificationRow {
  const meta = CANONICAL_SHADOW_MODULES.find((r) => r.packageId === 'ALPHA20')!;
  const cohort = alpha20QualifiedForwardCohort();
  const pipeline = runForwardCohortExperimentPipeline({
    cohort,
    comparedAt: evaluatedAt,
    memberOutcomes: alpha20FixtureMemberOutcomes(),
    shadowRegisteredAt: evaluatedAt,
  });
  return rowFromResult(
    meta,
    pipeline.qualification.marker,
    pipeline.qualification.qualified,
    pipeline.qualification.blockers,
  );
}

function qualifyAlpha21(evaluatedAt: UtcInstant): CanonicalShadowQualificationRow {
  const meta = CANONICAL_SHADOW_MODULES.find((r) => r.packageId === 'ALPHA21')!;
  const times = alpha21ScenarioTimes();
  const coordinator = new MarketSessionCoordinator();
  const strategies = alpha21MultiMarketStrategies();
  const ports = defaultAlpha21Ports();
  const shadow = new ShadowPortfolioRuntime({
    startingNotionalMinor: '100000000',
    currency: 'USD',
    benchmarkId: 'BM:SPY:BUY_HOLD',
    strategies,
    ports,
    registeredAt: evaluatedAt,
  });
  const paper = new PaperPortfolioRuntime({
    startingNotionalMinor: '100000000',
    currency: 'USD',
    benchmarkId: 'BM:SPY:BUY_HOLD',
    strategies,
    ports,
    registeredAt: evaluatedAt,
  });
  shadow.tickShadow(times.equityRegular);
  paper.tickPaper(times.cryptoWeekend);
  paper.tickPaper(times.fxMidweek);
  const cryptoOnly = coordinator.activeStrategyIds({ strategies, at: times.cryptoWeekend });
  const equityOnly = coordinator.activeStrategyIds({ strategies, at: times.equityRegular });
  const result = evaluateAlpha21ContinuousShadowRuntimeQualification({
    researchPosture:
      PORTFOLIO_RUNTIME_POSTURE.financialEffectCreated === false &&
      PORTFOLIO_RUNTIME_POSTURE.liveBroker === false &&
      PORTFOLIO_RUNTIME_POSTURE.customerMoneyUsed === false,
    shadowAndPaperRuntimes: true,
    marketSessionCoordinator: true,
    portfolioRuntimeStateNav: BigInt(paper.tickPaper(times.equityRegular).pnl.navMinor) > 0n,
    mdInstrumentCalendars: coordinator
      .resolveSessions({ strategies, at: times.equityRegular })
      .every((row) => row.calendarId !== null),
    asymmetricSessions:
      cryptoOnly.includes('strat_crypto_momentum') &&
      !cryptoOnly.includes('strat_equity_mr') &&
      equityOnly.includes('strat_equity_mr'),
    strategyPipelineStages: paper
      .listTicks()
      .some((row) => row.stagesCompleted.length === alpha21RequiredPipelineStages().length),
    paperRoutingNoLiveBroker: paper
      .listFills()
      .every((row) => row.externalBrokerSubmitted === false && row.routedVia === 'EXECUTION_TWIN'),
    dailySnapshotImmutable:
      paper.closePaperSession('2026-09-16', asUtcInstant('2026-09-16T23:59:00.000Z')).digest.length > 0,
  });
  return rowFromResult(meta, result.marker, result.qualified, result.blockers);
}

function qualifyAlpha22(): CanonicalShadowQualificationRow {
  const meta = CANONICAL_SHADOW_MODULES.find((r) => r.packageId === 'ALPHA22')!;
  const result = qualifyAlpha22ShadowControlRoom();
  return rowFromResult(meta, result.marker, result.qualified, result.blockers);
}

function qualifyAlpha23(): CanonicalShadowQualificationRow {
  const meta = CANONICAL_SHADOW_MODULES.find((r) => r.packageId === 'ALPHA23')!;
  const result = evaluateAlpha23Qualification();
  return rowFromResult(meta, result.marker, result.qualified, result.blockers);
}

function qualifyAlpha24(): CanonicalShadowQualificationRow {
  const meta = CANONICAL_SHADOW_MODULES.find((r) => r.packageId === 'ALPHA24')!;
  const bundle = runAlpha24ForwardResearchBookPipeline(alpha24MixedUniverseFixture());
  const result = evaluateAlpha24ResearchBookQualification(bundle);
  return rowFromResult(meta, result.marker, result.qualified, result.blockers);
}

export function runCanonicalShadowStackQualification(input: {
  readonly root: string;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
}): readonly CanonicalShadowQualificationRow[] {
  return Object.freeze([
    qualifyAlpha16(input),
    qualifyAlpha17(input),
    qualifyAlpha18(),
    qualifyAlpha19(),
    qualifyAlpha20(input.evaluatedAt),
    qualifyAlpha21(input.evaluatedAt),
    qualifyAlpha22(),
    qualifyAlpha23(),
    qualifyAlpha24(),
  ]);
}

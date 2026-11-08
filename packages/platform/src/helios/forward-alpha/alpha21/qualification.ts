import {
  HELIOS_ALPHA21_CONTINUOUS_SHADOW_RUNTIME_BLOCKED,
  HELIOS_ALPHA21_CONTINUOUS_SHADOW_RUNTIME_QUALIFIED,
  STRATEGY_TICK_STAGES,
} from './taxonomy.ts';

export {
  HELIOS_ALPHA21_CONTINUOUS_SHADOW_RUNTIME_QUALIFIED,
  HELIOS_ALPHA21_CONTINUOUS_SHADOW_RUNTIME_BLOCKED,
};

export type Alpha21QualificationChecks = {
  readonly researchPosture: boolean;
  readonly shadowAndPaperRuntimes: boolean;
  readonly marketSessionCoordinator: boolean;
  readonly portfolioRuntimeStateNav: boolean;
  readonly mdInstrumentCalendars: boolean;
  readonly asymmetricSessions: boolean;
  readonly strategyPipelineStages: boolean;
  readonly paperRoutingNoLiveBroker: boolean;
  readonly dailySnapshotImmutable: boolean;
};

export type Alpha21QualificationResult = {
  readonly marker:
    | typeof HELIOS_ALPHA21_CONTINUOUS_SHADOW_RUNTIME_QUALIFIED
    | typeof HELIOS_ALPHA21_CONTINUOUS_SHADOW_RUNTIME_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

const LABELS: Record<keyof Alpha21QualificationChecks, string> = {
  researchPosture: 'financialEffectCreated=false, liveBroker=false, customerMoneyUsed=false',
  shadowAndPaperRuntimes: 'ShadowPortfolioRuntime and PaperPortfolioRuntime operate continuously',
  marketSessionCoordinator: 'MarketSessionCoordinator resolves sessions per instrument',
  portfolioRuntimeStateNav: 'PortfolioRuntimeState tracks cash, PnL, exposure, drawdown, benchmark NAV',
  mdInstrumentCalendars: 'uses MD instrument calendars (not simultaneous-open assumption)',
  asymmetricSessions: 'crypto/equity/futures/FX sessions differ by timestamp',
  strategyPipelineStages: 'strategy tick completes mandated pipeline stages',
  paperRoutingNoLiveBroker: 'fills route via execution twin / paper broker only',
  dailySnapshotImmutable: 'session close produces sealed daily portfolio snapshot',
};

export function evaluateAlpha21ContinuousShadowRuntimeQualification(
  checks: Alpha21QualificationChecks,
): Alpha21QualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof Alpha21QualificationChecks, boolean][]) {
    if (!passed) {
      blockers.push(LABELS[key]);
    }
  }
  return Object.freeze({
    marker:
      blockers.length === 0
        ? HELIOS_ALPHA21_CONTINUOUS_SHADOW_RUNTIME_QUALIFIED
        : HELIOS_ALPHA21_CONTINUOUS_SHADOW_RUNTIME_BLOCKED,
    qualified: blockers.length === 0,
    blockers: Object.freeze(blockers),
  });
}

export function alpha21RequiredPipelineStages(): readonly string[] {
  return STRATEGY_TICK_STAGES;
}

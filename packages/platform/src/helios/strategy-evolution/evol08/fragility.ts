import { analyzePerformanceConcentration, assessStructuralFalsificationQuestions } from './concentration.ts';
import type { FragilityAssessment, PerformanceConcentrationSnapshot, StrategyFalsificationContext } from './types.ts';

export function buildFragilityAssessment(ctx: StrategyFalsificationContext): FragilityAssessment {
  const analysis = analyzePerformanceConcentration(ctx.strategyId, ctx.concentration);
  const thresholdFragile = ctx.thresholdSensitivityFragile;
  const concentrationFragile = analysis.concentrationRisk;
  const structurallyFragile = thresholdFragile || concentrationFragile;

  const questionRows = assessStructuralFalsificationQuestions(ctx.concentration, thresholdFragile);
  const details = questionRows.filter((q) => q.triggered).map((q) => `Structural concern: ${q.questionId}`);

  return Object.freeze({
    strategyId: ctx.strategyId,
    thresholdFragile,
    concentrationFragile,
    structurallyFragile,
    details: Object.freeze(details),
  });
}

export function defaultHealthyConcentration(): PerformanceConcentrationSnapshot {
  return Object.freeze({
    topInstrumentShareBps: 2800,
    topYearShareBps: 3200,
    topSectorShareBps: 3000,
    topRegimeShareBps: 2900,
    topProviderShareBps: 3500,
    topTradeShareBps: 2200,
    extremeEventDependenceBps: 1800,
  });
}

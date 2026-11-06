import { STRUCTURAL_FALSIFICATION_QUESTIONS } from './taxonomy.ts';
import type {
  PerformanceConcentrationAnalysis,
  PerformanceConcentrationSnapshot,
  StructuralQuestionAssessment,
} from './types.ts';

/** Single-slice dominance thresholds (basis points of total edge attribution). */
const INSTRUMENT_DOMINANCE_BPS = 6500;
const YEAR_DOMINANCE_BPS = 7000;
const SECTOR_DOMINANCE_BPS = 6500;
const EXTREME_EVENT_DOMINANCE_BPS = 5500;
const PROVIDER_DOMINANCE_BPS = 7500;
const REGIME_DOMINANCE_BPS = 6000;
const TRADE_DOMINANCE_BPS = 8000;

export function analyzePerformanceConcentration(
  strategyId: string,
  snapshot: PerformanceConcentrationSnapshot,
): PerformanceConcentrationAnalysis {
  const concentrationRisk =
    snapshot.topInstrumentShareBps > INSTRUMENT_DOMINANCE_BPS ||
    snapshot.topYearShareBps > YEAR_DOMINANCE_BPS ||
    snapshot.topSectorShareBps > SECTOR_DOMINANCE_BPS ||
    snapshot.topRegimeShareBps > REGIME_DOMINANCE_BPS ||
    snapshot.topProviderShareBps > PROVIDER_DOMINANCE_BPS ||
    snapshot.topTradeShareBps > TRADE_DOMINANCE_BPS ||
    snapshot.extremeEventDependenceBps > EXTREME_EVENT_DOMINANCE_BPS;

  return Object.freeze({
    strategyId,
    topInstrumentShareBps: snapshot.topInstrumentShareBps,
    topYearShareBps: snapshot.topYearShareBps,
    topSectorShareBps: snapshot.topSectorShareBps,
    topRegimeShareBps: snapshot.topRegimeShareBps,
    topProviderShareBps: snapshot.topProviderShareBps,
    topTradeShareBps: snapshot.topTradeShareBps,
    extremeEventDependenceBps: snapshot.extremeEventDependenceBps,
    concentrationRisk,
  });
}

export function assessStructuralFalsificationQuestions(
  snapshot: PerformanceConcentrationSnapshot,
  thresholdFragile: boolean,
): readonly StructuralQuestionAssessment[] {
  const rows: StructuralQuestionAssessment[] = STRUCTURAL_FALSIFICATION_QUESTIONS.map((questionId) => {
    let triggered = false;
    switch (questionId) {
      case 'Does performance disappear if thresholds change slightly?':
        triggered = thresholdFragile;
        break;
      case 'Does performance come from one instrument?':
        triggered = snapshot.topInstrumentShareBps > INSTRUMENT_DOMINANCE_BPS;
        break;
      case 'Does performance come from one year?':
        triggered = snapshot.topYearShareBps > YEAR_DOMINANCE_BPS;
        break;
      case 'Does performance come from one sector?':
        triggered = snapshot.topSectorShareBps > SECTOR_DOMINANCE_BPS;
        break;
      case 'Does performance come from one extreme event?':
        triggered = snapshot.extremeEventDependenceBps > EXTREME_EVENT_DOMINANCE_BPS;
        break;
      case 'Does performance come from one provider?':
        triggered = snapshot.topProviderShareBps > PROVIDER_DOMINANCE_BPS;
        break;
      case 'Does performance come from one regime?':
        triggered = snapshot.topRegimeShareBps > REGIME_DOMINANCE_BPS;
        break;
      case 'Does performance come from one trade?':
        triggered = snapshot.topTradeShareBps > TRADE_DOMINANCE_BPS;
        break;
      default:
        triggered = false;
    }
    return Object.freeze({ questionId, triggered });
  });
  return Object.freeze(rows);
}

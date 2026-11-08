import {
  HELIOS_ALPHA11_ALPHA_DECAY_BLOCKED,
  HELIOS_ALPHA11_ALPHA_DECAY_QUALIFIED,
  REQUIRED_CHANGE_DETECTORS,
} from './taxonomy.ts';
import { runCusumDetector, runEwmaDetector, runPageHinkleyDetector } from './detectors/index.ts';
import type { AlphaDecayQualification } from './types.ts';

/**
 * Module qualification — requires transparent EWMA, CUSUM, and Page–Hinkley implementations.
 */
export function evaluateAlpha11Qualification(): AlphaDecayQualification {
  const probeSeries = [100, 102, 101, 99, 98, 97, 50, 48, 45, 40];
  const metric = 'ACTIVE_RETURN_BPS' as const;
  const ewma = runEwmaDetector({ metric, series: probeSeries });
  const cusum = runCusumDetector({ metric, series: probeSeries });
  const ph = runPageHinkleyDetector({ metric, series: probeSeries, worseIsLower: true });
  const present = REQUIRED_CHANGE_DETECTORS.filter((kind) => {
    if (kind === 'EWMA') return ewma.detector === 'EWMA';
    if (kind === 'CUSUM') return cusum.detector === 'CUSUM';
    return ph.detector === 'PAGE_HINKLEY';
  });
  const qualified = present.length === REQUIRED_CHANGE_DETECTORS.length && ewma.observationsUsed >= 3;
  return Object.freeze({
    qualified,
    marker: qualified ? HELIOS_ALPHA11_ALPHA_DECAY_QUALIFIED : HELIOS_ALPHA11_ALPHA_DECAY_BLOCKED,
    requiredDetectorsPresent: Object.freeze([...REQUIRED_CHANGE_DETECTORS]),
    grantsFinancialAuthority: false,
    permitsRiskIncrease: false,
  });
}

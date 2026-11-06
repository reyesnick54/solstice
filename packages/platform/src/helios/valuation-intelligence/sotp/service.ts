/**
 * VAL09 service — segment SOTP valuation.
 */

import { runSotpValuationEngine } from './engine.ts';
import type { RunSotpValuationInput, SotpValuation } from './types.ts';

export type HeliosVal09SotpService = {
  readonly value: (input: RunSotpValuationInput) => SotpValuation;
};

export function createHeliosVal09SotpService(): HeliosVal09SotpService {
  return Object.freeze({
    value: (input) => runSotpValuationEngine(input),
  });
}

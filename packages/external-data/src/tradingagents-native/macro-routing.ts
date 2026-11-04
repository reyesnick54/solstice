/**
 * Macro-data routing (TradingAgents macro_data → Wave 2 macro fixtures, simulation only).
 */

import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import { fetchMacroIndicators, type Wave2AdapterContext } from '../adapters.ts';
import { asOf, filterKnowableByDecisionTime } from './date-window.ts';
import type { DataflowOutcome } from './types.ts';

export function routeMacroIndicators(input: {
  readonly ctx: Wave2AdapterContext;
  readonly tradeDate: string;
  readonly requestedAsOf?: string | null;
}): DataflowOutcome {
  const asOfDate = asOf(input.requestedAsOf ?? input.tradeDate, input.tradeDate) ?? input.tradeDate;
  const evaluationTime = asUtcInstant(`${asOfDate}T23:59:59.000Z`);
  const observations = fetchMacroIndicators(input.ctx);
  const knowable = filterKnowableByDecisionTime(
    observations.map((row) =>
      Object.freeze({
        observation: row,
        knowableAt: asUtcInstant(row.time.sourceTimestamp ?? row.time.retrievedAt),
      }),
    ),
    evaluationTime,
  );
  if (knowable.length === 0) {
    return Object.freeze({
      kind: 'unavailable',
      reason: `NO_MACRO_DATA: no macro indicators knowable at ${asOfDate}`,
    });
  }
  const lines = knowable.map(
    (row) =>
      `- ${row.observation.data.seriesId}: ${row.observation.data.value} (${row.observation.data.unit}) @ ${row.observation.data.observationDate}`,
  );
  return Object.freeze({
    kind: 'payload',
    vendorId: 'fred',
    knowableAt: knowable[knowable.length - 1]!.knowableAt,
    body: `# Macro indicators (simulation)\n# as-of ${asOfDate}\n\n${lines.join('\n')}`,
  });
}

export function macroKnowableCutoff(tradeDate: string): UtcInstant {
  return asUtcInstant(`${tradeDate}T23:59:59.000Z`);
}

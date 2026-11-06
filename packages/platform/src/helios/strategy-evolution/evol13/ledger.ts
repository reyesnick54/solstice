import type { OperatorPerformanceLedger, OperatorEvolutionRunEvent } from './types.ts';

export function createInMemoryOperatorPerformanceLedger(): OperatorPerformanceLedger {
  const runs: OperatorEvolutionRunEvent[] = [];
  return Object.freeze({
    append(event: OperatorEvolutionRunEvent) {
      runs.push(event);
    },
    listRuns() {
      return Object.freeze([...runs]);
    },
  });
}

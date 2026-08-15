import type { UtcInstant } from '../../domain/src/time.ts';
import type { EconomicGraphId } from './ids.ts';

export type EconomicGraph = {
  readonly graphId: EconomicGraphId;
  readonly subjectId: string;
  readonly customerId?: string;
  readonly createdAt: UtcInstant;
  readonly authoritativeBalance: false;
  readonly mutatesFinancialState: false;
};

export function freezeGraph(graph: EconomicGraph): EconomicGraph {
  return Object.freeze({
    ...graph,
    authoritativeBalance: false,
    mutatesFinancialState: false,
  });
}

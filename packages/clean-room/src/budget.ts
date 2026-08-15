import { isExpired } from '../../config/src/clock.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import { DIFFERENTIAL_PRIVACY_NOT_IMPLEMENTED, SIMULATION_THRESHOLDS } from './taxonomy.ts';
import type { CleanRoomFailure, QueryAst, QueryBudget } from './types.ts';
import { queryComplexity } from './query.ts';

export function emptyBudget(input: {
  readonly sessionId: QueryBudget['sessionId'];
  readonly requesterId: QueryBudget['requesterId'];
  readonly purposeId: QueryBudget['purposeId'];
  readonly expiresAt: UtcInstant;
}): QueryBudget {
  return Object.freeze({
    sessionId: input.sessionId,
    requesterId: input.requesterId,
    purposeId: input.purposeId,
    queriesUsed: 0,
    complexityUsed: 0,
    outputCardinalityUsed: 0,
    repeatedSlices: 0,
    expiresAt: input.expiresAt,
    differentialPrivacy: DIFFERENTIAL_PRIVACY_NOT_IMPLEMENTED,
  });
}

export function consumeBudget(input: {
  readonly budget: QueryBudget;
  readonly ast: QueryAst;
  readonly now: UtcInstant;
  readonly fingerprint: string;
  readonly seenFingerprints: ReadonlySet<string>;
  readonly maxQueries?: number;
}): Result<QueryBudget, CleanRoomFailure> {
  if (isExpired(input.budget.expiresAt, input.now)) {
    return err({ code: 'SESSION_EXPIRED', message: 'query budget expired with the session' });
  }
  const maxQueries = input.maxQueries ?? SIMULATION_THRESHOLDS.maxQueriesPerSession;
  if (input.budget.queriesUsed >= maxQueries) {
    return err({ code: 'QUERY_BUDGET_EXHAUSTED', message: `session query budget of ${maxQueries} is exhausted` });
  }
  if (input.seenFingerprints.has(input.fingerprint)) {
    return err({
      code: 'REPEATED_QUERY',
      message: 'near-identical query replay is blocked by the session query budget',
    });
  }
  return ok(
    Object.freeze({
      ...input.budget,
      queriesUsed: input.budget.queriesUsed + 1,
      complexityUsed: input.budget.complexityUsed + queryComplexity(input.ast),
      outputCardinalityUsed: input.budget.outputCardinalityUsed + (input.ast.groupBy?.length ?? 1),
      repeatedSlices: input.budget.repeatedSlices,
    }),
  );
}

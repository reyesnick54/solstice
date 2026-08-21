import {
  additionalUnconfiguredPolicyDecisions,
  humanActivationAuthorizationRequired,
  humanParameterSelectionDecisions,
  parameterCoverage,
} from '../../release-candidate/economic/production-constitution/requirements.ts';
import { currentUnconfiguredParameters } from '../../economics/production-activation/parameters.ts';
import type { HumanDecisionRecord } from './types.ts';

export function currentHumanDecisionRegister(): readonly HumanDecisionRecord[] {
  const coverage = parameterCoverage(currentUnconfiguredParameters());
  const fromParameters = humanParameterSelectionDecisions(coverage).map((row) =>
    Object.freeze({
      decisionId: row.decisionId,
      title: row.title,
      unresolved: true as const,
      aiMayDecide: false as const,
      notes: 'Production parameter remains unconfigured. Cursor / AI must not select a value.',
    }),
  );
  const extras = [
    ...additionalUnconfiguredPolicyDecisions(),
    ...humanActivationAuthorizationRequired(),
  ].map((row) =>
    Object.freeze({
      decisionId: row.decisionId,
      title: row.title,
      unresolved: true as const,
      aiMayDecide: false as const,
      notes: 'Human decision still unresolved. Not selected by engineering closure.',
    }),
  );
  const tickers: readonly HumanDecisionRecord[] = Object.freeze([
    Object.freeze({
      decisionId: 'sunrey-public-ticker',
      title: 'SunRey public ticker symbol',
      unresolved: true as const,
      aiMayDecide: false as const,
      notes: 'Ticker status remains NOT_ASSIGNED.',
    }),
    Object.freeze({
      decisionId: 'moonrey-public-ticker',
      title: 'MoonRey public ticker symbol',
      unresolved: true as const,
      aiMayDecide: false as const,
      notes: 'Ticker status remains NOT_ASSIGNED.',
    }),
  ]);
  const seen = new Set<string>();
  const out: HumanDecisionRecord[] = [];
  for (const row of [...fromParameters, ...extras, ...tickers]) {
    if (seen.has(row.decisionId)) continue;
    seen.add(row.decisionId);
    out.push(row);
  }
  return Object.freeze(out);
}

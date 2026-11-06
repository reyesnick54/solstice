/**
 * Seal a decision episode — fixes the research-time record; outcomes attach elsewhere.
 */

import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import { HELIOS_COUNTERFACTUAL_LEARNING_SCHEMA } from './taxonomy.ts';
import type { DecisionContext, DecisionEpisode, DecisionEpisodeSeal } from './types.ts';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  const obj = value as Readonly<Record<string, unknown>>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function digestDecisionContext(context: DecisionContext): string {
  return createHash('sha256').update(stableStringify(context)).digest('hex').slice(0, 64);
}

export function digestCandidateActionSetContent(input: {
  readonly setId: string;
  readonly candidates: readonly { readonly candidateId: string; readonly actionClass: string }[];
}): string {
  return createHash('sha256')
    .update(stableStringify({ setId: input.setId, candidates: input.candidates }))
    .digest('hex')
    .slice(0, 64);
}

export function sealDecisionEpisode(input: {
  readonly episodeId: string;
  readonly context: DecisionContext;
  readonly candidateSet: DecisionEpisode['candidateSet'];
  readonly chosenAction: DecisionEpisode['chosenAction'];
  readonly rejectedActions: DecisionEpisode['rejectedActions'];
  readonly reasons: DecisionEpisode['reasons'];
  readonly policySnapshot: DecisionEpisode['policySnapshot'];
  readonly strategyGenome: DecisionEpisode['strategyGenome'];
  readonly modelVersions: DecisionEpisode['modelVersions'];
  readonly evidence: DecisionEpisode['evidence'];
  readonly manifest: DecisionEpisode['manifest'];
  readonly sealedAt: UtcInstant;
}): DecisionEpisode {
  const contextDigest = digestDecisionContext(input.context);
  const evidence: DecisionEpisode['evidence'] = Object.freeze({
    ...input.evidence,
    contextDigest,
  });
  const core = {
    schema: HELIOS_COUNTERFACTUAL_LEARNING_SCHEMA,
    episodeId: input.episodeId,
    context: input.context,
    candidateSet: input.candidateSet,
    chosenAction: input.chosenAction,
    rejectedActions: input.rejectedActions,
    reasons: input.reasons,
    policySnapshot: input.policySnapshot,
    strategyGenome: input.strategyGenome,
    modelVersions: input.modelVersions,
    evidence,
    manifest: input.manifest,
    grantsExecutionAuthority: false as const,
  };
  const episodeContentHash = createHash('sha256')
    .update(stableStringify(core))
    .digest('hex')
    .slice(0, 64);
  const seal: DecisionEpisodeSeal = Object.freeze({
    sealedAt: input.sealedAt,
    episodeContentHash,
  });
  return Object.freeze({
    ...core,
    seal,
  });
}

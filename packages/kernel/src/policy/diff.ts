import type { PolicyRule, PolicyVersionRecord } from './types.ts';

export type PolicyVersionDiff = {
  readonly fromVersionId: string;
  readonly toVersionId: string;
  readonly rulesAdded: readonly string[];
  readonly rulesRemoved: readonly string[];
  readonly effectsChanged: readonly string[];
  readonly scopesChanged: readonly string[];
  readonly reviewStatusChanged: readonly string[];
  readonly effectiveDatesChanged: readonly string[];
  readonly sourcesChanged: readonly string[];
};

export function diffPolicyVersions(
  from: PolicyVersionRecord,
  to: PolicyVersionRecord,
): PolicyVersionDiff {
  const fromRules = new Map(from.rules.map((rule) => [rule.ruleId, rule]));
  const toRules = new Map(to.rules.map((rule) => [rule.ruleId, rule]));
  const added: string[] = [];
  const removed: string[] = [];
  const effectsChanged: string[] = [];
  const scopesChanged: string[] = [];
  const reviewStatusChanged: string[] = [];
  const effectiveDatesChanged: string[] = [];
  const sourcesChanged: string[] = [];

  for (const [id, rule] of toRules) {
    if (!fromRules.has(id)) {
      added.push(id);
    } else {
      const prior = fromRules.get(id)!;
      noteChanges(prior, rule, {
        effectsChanged,
        scopesChanged,
        reviewStatusChanged,
        effectiveDatesChanged,
        sourcesChanged,
      });
    }
  }
  for (const id of fromRules.keys()) {
    if (!toRules.has(id)) {
      removed.push(id);
    }
  }

  return Object.freeze({
    fromVersionId: from.versionId,
    toVersionId: to.versionId,
    rulesAdded: Object.freeze(added.sort()),
    rulesRemoved: Object.freeze(removed.sort()),
    effectsChanged: Object.freeze(effectsChanged.sort()),
    scopesChanged: Object.freeze(scopesChanged.sort()),
    reviewStatusChanged: Object.freeze(reviewStatusChanged.sort()),
    effectiveDatesChanged: Object.freeze(effectiveDatesChanged.sort()),
    sourcesChanged: Object.freeze(sourcesChanged.sort()),
  });
}

function noteChanges(
  from: PolicyRule,
  to: PolicyRule,
  buckets: {
    effectsChanged: string[];
    scopesChanged: string[];
    reviewStatusChanged: string[];
    effectiveDatesChanged: string[];
    sourcesChanged: string[];
  },
): void {
  if (from.effect !== to.effect) {
    buckets.effectsChanged.push(to.ruleId);
  }
  if (
    from.scope !== to.scope ||
    from.actionTypes.join(',') !== to.actionTypes.join(',') ||
    from.productTypes.join(',') !== to.productTypes.join(',') ||
    from.customerTypes.join(',') !== to.customerTypes.join(',')
  ) {
    buckets.scopesChanged.push(to.ruleId);
  }
  if (from.legalReviewStatus !== to.legalReviewStatus) {
    buckets.reviewStatusChanged.push(to.ruleId);
  }
  if (from.effectiveFrom !== to.effectiveFrom || from.effectiveUntil !== to.effectiveUntil) {
    buckets.effectiveDatesChanged.push(to.ruleId);
  }
  if (from.sourceReference !== to.sourceReference) {
    buckets.sourcesChanged.push(to.ruleId);
  }
}

export function formatPolicyDiff(diff: PolicyVersionDiff): string {
  const lines = [
    `Policy version diff ${diff.fromVersionId} → ${diff.toVersionId}`,
    `rules added: ${diff.rulesAdded.join(', ') || '(none)'}`,
    `rules removed: ${diff.rulesRemoved.join(', ') || '(none)'}`,
    `effects changed: ${diff.effectsChanged.join(', ') || '(none)'}`,
    `scopes changed: ${diff.scopesChanged.join(', ') || '(none)'}`,
    `review status changed: ${diff.reviewStatusChanged.join(', ') || '(none)'}`,
    `effective dates changed: ${diff.effectiveDatesChanged.join(', ') || '(none)'}`,
    `sources changed: ${diff.sourcesChanged.join(', ') || '(none)'}`,
  ];
  return lines.join('\n');
}

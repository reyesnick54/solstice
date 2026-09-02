/**
 * Wave 6 — Human Economy synthetic performance baseline.
 * ENGINEERING_MEASUREMENT only — not production SLAs.
 */

import { performance } from 'node:perf_hooks';

import { HumanContributionRegistry } from '../../packages/human-economic-contribution/src/registry.ts';
import { fixtureContribution } from '../../packages/human-economic-contribution/src/fixtures.ts';
import { resolveEntityAlias } from '../../packages/sunrey-chain/src/economic-proof/entity-identity.ts';
import {
  HIN_ALIAS,
  ORCID_ALIAS,
  PUBMED_ALIAS,
  RESEARCH_PAPER_COMMITMENT,
  UNIVERSITY_ALIAS,
  createHumanAliasResolver,
} from '../../packages/sunrey-chain/src/economic-proof/fixtures/human.ts';
import { summarizeLatencyMs, type LatencySummary } from '../lib/stats.ts';

export type HumanEconomyBaselineCase = {
  readonly name: string;
  readonly iterations: number;
  readonly latency: LatencySummary;
};

export type HumanEconomyBaselineResult = {
  readonly generatedAt: string;
  readonly environment: 'simulation';
  readonly note: string;
  readonly cases: readonly HumanEconomyBaselineCase[];
};

function bench(name: string, iterations: number, fn: () => void): HumanEconomyBaselineCase {
  const samples: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    fn();
    samples.push(performance.now() - start);
  }
  return { name, iterations, latency: summarizeLatencyMs(samples) };
}

export async function runHumanEconomyBaseline(): Promise<HumanEconomyBaselineResult> {
  const registry = new HumanContributionRegistry();
  const aliasResolver = createHumanAliasResolver();
  const entityMaterial = {
    economy: 'HUMAN' as const,
    entityKind: 'RESEARCH_CONTRIBUTION' as const,
    entityCommitment: RESEARCH_PAPER_COMMITMENT,
  };

  const cases: HumanEconomyBaselineCase[] = [
    bench('contribution-registry-submit', 500, () => {
      void registry.submit(fixtureContribution('RESEARCH_PARTICIPATION', `perf-${Math.random()}`));
    }),
    bench('attestation-verification-verify', 300, () => {
      const submitted = registry.submit(fixtureContribution('PROFESSIONAL_EXPERTISE', `verify-${Math.random()}`));
      if (!submitted.ok) return;
      void registry.verify({
        contributionId: submitted.value.contributionId,
        verificationDecisionRef: 'decision-perf',
        verificationPolicyVersion: submitted.value.verificationPolicyVersion,
      });
    }),
    bench('identity-alias-resolve-four-sources', 500, () => {
      resolveEntityAlias(aliasResolver, ORCID_ALIAS, entityMaterial);
      resolveEntityAlias(aliasResolver, PUBMED_ALIAS, entityMaterial);
      resolveEntityAlias(aliasResolver, UNIVERSITY_ALIAS, entityMaterial);
      resolveEntityAlias(aliasResolver, HIN_ALIAS, entityMaterial);
    }),
    bench('duplicate-fingerprint-reject', 500, () => {
      const seed = `dup-${Math.floor(Math.random() * 10_000)}`;
      void registry.submit(fixtureContribution('CREATIVE_PRODUCTION', seed));
      void registry.submit(fixtureContribution('CREATIVE_PRODUCTION', seed));
    }),
    bench('registry-query-by-subject', 500, () => {
      registry.query({ subjectRef: fixtureContribution('COMMUNITY_CONTRIBUTION', 'q').subjectRef });
    }),
  ];

  return {
    generatedAt: new Date().toISOString(),
    environment: 'simulation',
    note: 'Local synthetic workloads on in-memory stores. Not representative of production HIN or PostgreSQL scale.',
    cases,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runHumanEconomyBaseline();
  console.log(JSON.stringify(result, null, 2));
}

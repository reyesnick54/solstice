import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';

import { HELIOS_ALPHA20_FORWARD_EXPERIMENTS_SCHEMA } from './taxonomy.ts';
import type { ForwardExperimentPreregistration } from './types.ts';
import type { StoppingPolicyKind } from './taxonomy.ts';

function fingerprintPreregistration(input: Omit<ForwardExperimentPreregistration, 'preregistrationFingerprint'>): string {
  const payload = JSON.stringify({
    primary: input.primaryOutcomeMetricId,
    secondary: input.secondaryOutcomeMetricIds,
    benchmark: input.benchmarkId,
    sample: input.minimumSampleOpportunities,
    stopping: input.stoppingPolicy,
    sealedAt: input.sealedAt,
  });
  return createHash('sha256').update(payload).digest('hex');
}

export function sealForwardExperimentPreregistration(input: {
  readonly preregistrationId: string;
  readonly primaryOutcomeMetricId: string;
  readonly secondaryOutcomeMetricIds: readonly string[];
  readonly benchmarkId: string;
  readonly minimumSampleOpportunities: number;
  readonly stoppingPolicyKind: StoppingPolicyKind;
  readonly fixedHorizonOpportunities?: number | null;
  readonly alpha07CampaignRef?: string | null;
  readonly sealedAt: UtcInstant;
}): ForwardExperimentPreregistration {
  if (input.minimumSampleOpportunities <= 0) {
    throw new Error('ALPHA20 minimumSampleOpportunities must be positive');
  }
  if (!input.primaryOutcomeMetricId.trim()) {
    throw new Error('ALPHA20 primary outcome required');
  }
  if (!input.benchmarkId.trim()) {
    throw new Error('ALPHA20 benchmark required');
  }

  const stoppingPolicy = Object.freeze({
    kind: input.stoppingPolicyKind,
    fixedHorizonOpportunities:
      input.stoppingPolicyKind === 'FIXED_HORIZON' ? (input.fixedHorizonOpportunities ?? null) : null,
    alpha07CampaignRef:
      input.stoppingPolicyKind === 'SEQUENTIAL_ALPHA07_BOUND' ? (input.alpha07CampaignRef ?? null) : null,
  });

  const base = {
    schema: HELIOS_ALPHA20_FORWARD_EXPERIMENTS_SCHEMA,
    preregistrationId: input.preregistrationId,
    primaryOutcomeMetricId: input.primaryOutcomeMetricId,
    secondaryOutcomeMetricIds: Object.freeze([...input.secondaryOutcomeMetricIds]),
    benchmarkId: input.benchmarkId,
    minimumSampleOpportunities: input.minimumSampleOpportunities,
    stoppingPolicy,
    sealedAt: input.sealedAt,
    preregistrationFingerprint: '',
  };

  return Object.freeze({
    ...base,
    preregistrationFingerprint: fingerprintPreregistration(base),
  });
}

export function assertPreregistrationUnchanged(
  before: ForwardExperimentPreregistration,
  after: ForwardExperimentPreregistration,
): void {
  if (before.preregistrationFingerprint !== after.preregistrationFingerprint) {
    throw new Error('ALPHA20 campaign preregistration rewrite forbidden after seal');
  }
}

import type { WorkforceSkillBucket } from './taxonomy.ts';
import type {
  InnovationHiringIntensity,
  JobPostingObservation,
  ManufacturingHiringIntensity,
  SalesHiringIntensity,
  SkillDemandState,
  SkillMixShift,
} from './types.ts';
import type { UtcInstant } from '@solstice/domain';
import { HELIOS_ALT04_WORKFORCE_AUTHORITY, HELIOS_ALT04_WORKFORCE_SCHEMA, WORKFORCE_SKILL_BUCKETS } from './taxonomy.ts';

const KEYWORD_MAP: Readonly<Record<WorkforceSkillBucket, readonly string[]>> = Object.freeze({
  AI: Object.freeze(['artificial intelligence', 'machine learning', 'llm', 'deep learning', 'nlp', 'generative']),
  DATA: Object.freeze(['data engineer', 'analytics', 'sql', 'etl', 'warehouse', 'bi ', 'business intelligence']),
  SOFTWARE: Object.freeze(['software', 'developer', 'engineer', 'backend', 'frontend', 'full stack', 'devops', 'sre']),
  SALES: Object.freeze(['sales', 'account executive', 'business development', 'sdr', 'bdr', 'revenue']),
  OPERATIONS: Object.freeze(['operations', 'supply chain', 'program manager', 'customer success', 'support']),
  MANUFACTURING: Object.freeze(['manufacturing', 'production', 'assembly', 'plant', 'cnc', 'welding']),
  R_AND_D: Object.freeze(['research scientist', 'r&d', 'phd', 'laboratory', 'principal scientist']),
  FINANCE: Object.freeze(['finance', 'accounting', 'fp&a', 'controller', 'treasury', 'audit']),
  LEGAL: Object.freeze(['legal', 'counsel', 'compliance', 'paralegal', 'regulatory']),
  SECURITY: Object.freeze(['security', 'cyber', 'infosec', 'soc ', 'penetration']),
  LOGISTICS: Object.freeze(['logistics', 'warehouse', 'freight', 'fulfillment', 'driver', 'dispatcher']),
  OTHER: Object.freeze([]),
});

function haystackFor(observation: JobPostingObservation): string {
  const skills = observation.sourceJob.skills.join(' ').toLowerCase();
  const title = observation.sourceJob.title.toLowerCase();
  return `${title} ${skills}`.toLowerCase();
}

export function classifyJobPostingSkills(observation: JobPostingObservation): readonly WorkforceSkillBucket[] {
  const haystack = haystackFor(observation);
  const hits = new Set<WorkforceSkillBucket>();
  for (const bucket of WORKFORCE_SKILL_BUCKETS) {
    if (bucket === 'OTHER') continue;
    const keywords = KEYWORD_MAP[bucket];
    if (keywords.some((kw) => haystack.includes(kw))) {
      hits.add(bucket);
    }
  }
  if (hits.size === 0) hits.add('OTHER');
  return Object.freeze([...hits]);
}

function shareBps(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count * 10_000) / total);
}

export function buildSkillDemandState(input: {
  readonly firmKey: string;
  readonly evaluationTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly observations: readonly JobPostingObservation[];
  readonly providerIds: readonly string[];
}): SkillDemandState {
  const mix: Partial<Record<WorkforceSkillBucket, number>> = {};
  for (const obs of input.observations) {
    for (const bucket of obs.skillBuckets) {
      mix[bucket] = (mix[bucket] ?? 0) + 1;
    }
  }
  let dominant: WorkforceSkillBucket | null = null;
  let max = 0;
  for (const [bucket, count] of Object.entries(mix)) {
    if ((count ?? 0) > max) {
      max = count ?? 0;
      dominant = bucket as WorkforceSkillBucket;
    }
  }
  return Object.freeze({
    schema: HELIOS_ALT04_WORKFORCE_SCHEMA,
    authority: HELIOS_ALT04_WORKFORCE_AUTHORITY,
    stateId: `skill_demand:${input.firmKey}:${input.evaluationTime}`,
    firmKey: input.firmKey,
    canonicalEntityId: null,
    observationTime: input.evaluationTime,
    knowableAt: input.knowableAt,
    providerIds: Object.freeze([...input.providerIds]),
    grantsExecutionAuthority: false,
    mix: Object.freeze({ ...mix }),
    dominantBucket: dominant,
  });
}

export function computeSkillMixShift(input: {
  readonly firmKey: string;
  readonly prior: readonly JobPostingObservation[];
  readonly current: readonly JobPostingObservation[];
  readonly fromWindowStart: UtcInstant;
  readonly toWindowEnd: UtcInstant;
  readonly knowableAt: UtcInstant;
}): SkillMixShift {
  const priorMix: Partial<Record<WorkforceSkillBucket, number>> = {};
  const currentMix: Partial<Record<WorkforceSkillBucket, number>> = {};
  for (const obs of input.prior) {
    for (const b of obs.skillBuckets) priorMix[b] = (priorMix[b] ?? 0) + 1;
  }
  for (const obs of input.current) {
    for (const b of obs.skillBuckets) currentMix[b] = (currentMix[b] ?? 0) + 1;
  }
  const delta: Partial<Record<WorkforceSkillBucket, number>> = {};
  for (const bucket of WORKFORCE_SKILL_BUCKETS) {
    delta[bucket] = (currentMix[bucket] ?? 0) - (priorMix[bucket] ?? 0);
  }
  return Object.freeze({
    firmKey: input.firmKey,
    fromWindowStart: input.fromWindowStart,
    toWindowEnd: input.toWindowEnd,
    deltaByBucket: Object.freeze({ ...delta }),
    knowableAt: input.knowableAt,
  });
}

export function computeInnovationHiringIntensity(input: {
  readonly firmKey: string;
  readonly observations: readonly JobPostingObservation[];
  readonly knowableAt: UtcInstant;
}): InnovationHiringIntensity {
  const total = input.observations.length;
  let ai = 0;
  let data = 0;
  let rnd = 0;
  for (const obs of input.observations) {
    if (obs.skillBuckets.includes('AI')) ai += 1;
    if (obs.skillBuckets.includes('DATA')) data += 1;
    if (obs.skillBuckets.includes('R_AND_D')) rnd += 1;
  }
  const intensity = ai * 3 + data * 2 + rnd * 2;
  return Object.freeze({
    firmKey: input.firmKey,
    intensityScore: intensity,
    aiShareBps: shareBps(ai, total),
    dataShareBps: shareBps(data, total),
    rAndDShareBps: shareBps(rnd, total),
    knowableAt: input.knowableAt,
  });
}

export function computeSalesHiringIntensity(input: {
  readonly firmKey: string;
  readonly observations: readonly JobPostingObservation[];
  readonly knowableAt: UtcInstant;
}): SalesHiringIntensity {
  const total = input.observations.length;
  let sales = 0;
  for (const obs of input.observations) {
    if (obs.skillBuckets.includes('SALES')) sales += 1;
  }
  return Object.freeze({
    firmKey: input.firmKey,
    intensityScore: sales * 2,
    salesShareBps: shareBps(sales, total),
    knowableAt: input.knowableAt,
  });
}

export function computeManufacturingHiringIntensity(input: {
  readonly firmKey: string;
  readonly observations: readonly JobPostingObservation[];
  readonly knowableAt: UtcInstant;
}): ManufacturingHiringIntensity {
  const total = input.observations.length;
  let mfg = 0;
  for (const obs of input.observations) {
    if (obs.skillBuckets.includes('MANUFACTURING')) mfg += 1;
  }
  return Object.freeze({
    firmKey: input.firmKey,
    intensityScore: mfg * 2,
    manufacturingShareBps: shareBps(mfg, total),
    knowableAt: input.knowableAt,
  });
}

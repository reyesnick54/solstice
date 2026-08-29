/**
 * Access Economy scenario engine.
 *
 * Runs one Access Economy scenario on top of the existing dual-economy
 * simulator. Deterministic in seed: the same scenario and seed produce the
 * same decisions, the same capacity ledger, and the same evidence head.
 */

import { createHash } from 'node:crypto';

import {
  ACCESS_CANONICAL_INTEGRATIONS,
  ACCESS_ECONOMY_LABEL,
  ACCESS_ECONOMY_SCHEMA_VERSION,
  ACCESS_ECONOMY_TOOL_VERSION,
  type AccessDecisionOutcome,
  type AccessScarcityDimension,
  type AccessScarcityMode,
} from './ids.ts';
import { allocate } from './allocation.ts';
import { buildCapacityPools, buildRequests, macroReport } from './capacity.ts';
import { accessScenarioById } from './catalog.ts';
import { AccessSimulationEvidence } from './evidence.ts';
import { checkAccessInvariants } from './invariants.ts';
import type {
  AccessCapacityLedgerRow,
  AccessCapacityPool,
  AccessDecision,
  AccessEconomyScenario,
  AccessEconomyScenarioResult,
} from './types.ts';

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value, bigintReplacer)).digest('hex');
}

function outcomeCounts(
  decisions: readonly AccessDecision[],
): Readonly<Partial<Record<AccessDecisionOutcome, number>>> {
  const counts: Partial<Record<AccessDecisionOutcome, number>> = {};
  for (const row of decisions) {
    counts[row.outcome] = (counts[row.outcome] ?? 0) + 1;
  }
  return Object.freeze(counts);
}

function groupKey(pool: AccessCapacityPool, dimension: AccessScarcityDimension): string {
  switch (dimension) {
    case 'GEOGRAPHIC':
      return pool.locationId;
    case 'TEMPORAL':
      return pool.dateKey;
    case 'PROVIDER':
      return pool.providerId;
    default:
      return 'AGGREGATE';
  }
}

function scarcityFromRemainingBps(remainingBps: bigint): AccessScarcityMode {
  if (remainingBps < 500n) {
    return 'SCARCE';
  }
  if (remainingBps < 6_000n) {
    return 'CONSTRAINED';
  }
  return 'ABUNDANT';
}

/**
 * Scarcity per bucket group along the dimension the scenario exercises.
 * A geographic or temporal shortage stays visible here instead of being
 * averaged away. Engineering labels only, never a price signal.
 */
function scarcityByGroup(
  pools: readonly AccessCapacityPool[],
  capacity: readonly AccessCapacityLedgerRow[],
  dimension: AccessScarcityDimension,
  unavailable: boolean,
): Readonly<Record<string, AccessScarcityMode>> {
  const byPool = new Map(capacity.map((row) => [row.poolId, row]));
  const groups = new Map<string, { published: bigint; remaining: bigint }>();
  for (const pool of pools) {
    const row = byPool.get(pool.poolId);
    if (!row) {
      continue;
    }
    const key = groupKey(pool, dimension);
    const current = groups.get(key) ?? { published: 0n, remaining: 0n };
    groups.set(key, {
      published: current.published + row.publishedUnits,
      remaining: current.remaining + row.remainingUnits,
    });
  }
  const out: Record<string, AccessScarcityMode> = {};
  for (const [key, group] of [...groups.entries()].sort(([left], [right]) => (left < right ? -1 : 1))) {
    out[key] =
      unavailable || group.published === 0n
        ? 'UNAVAILABLE'
        : scarcityFromRemainingBps((group.remaining * 10_000n) / group.published);
  }
  return Object.freeze(out);
}

/** Worst group along the exercised dimension. */
function observedScarcity(
  byGroup: Readonly<Record<string, AccessScarcityMode>>,
  unavailable: boolean,
): AccessScarcityMode {
  if (unavailable) {
    return 'UNAVAILABLE';
  }
  const modes = Object.values(byGroup);
  if (modes.length === 0 || modes.includes('UNAVAILABLE')) {
    return 'UNAVAILABLE';
  }
  if (modes.includes('SCARCE')) {
    return 'SCARCE';
  }
  if (modes.includes('CONSTRAINED')) {
    return 'CONSTRAINED';
  }
  return 'ABUNDANT';
}

export function runAccessEconomyScenario(
  scenarioId: string,
  options?: { readonly seed?: number },
): AccessEconomyScenarioResult {
  const catalogued = accessScenarioById(scenarioId);
  if (!catalogued) {
    throw new Error(`unknown access economy scenario ${scenarioId}`);
  }
  const scenario: AccessEconomyScenario =
    options?.seed === undefined ? catalogued : Object.freeze({ ...catalogued, seed: options.seed });
  return executeAccessScenario(scenario);
}

export function executeAccessScenario(scenario: AccessEconomyScenario): AccessEconomyScenarioResult {
  const macro = macroReport(scenario);
  const pools = buildCapacityPools(scenario, macro);
  const requests = buildRequests(scenario, pools);
  const evidence = new AccessSimulationEvidence();

  evidence.seal('access.scenario.opened', {
    scenarioId: scenario.scenarioId,
    seed: scenario.seed,
    macroScenarioId: scenario.macroScenarioId,
    shocks: scenario.shocks,
  });
  evidence.seal('access.capacity.published', {
    pools: pools.map((row) => ({
      poolId: row.poolId,
      publishedUnits: row.publishedUnits.toString(),
      providerAvailable: row.providerAvailable,
      evidenceStale: row.evidenceStale,
    })),
  });
  evidence.seal('access.envelope.evaluated', {
    subjects: new Set(requests.map((row) => row.subjectId)).size,
    requests: requests.length,
    humanWorthScore: false,
  });

  const allocation = allocate(scenario, pools, requests, evidence);
  const counts = outcomeCounts(allocation.decisions);
  const totalPublishedUnits = allocation.capacity.reduce((sum, row) => sum + row.publishedUnits, 0n);

  const serializedState = JSON.stringify(
    {
      scenarioId: scenario.scenarioId,
      pools,
      capacity: allocation.capacity,
      decisions: allocation.decisions,
      policyChanges: allocation.policyChanges,
      evidenceRecords: evidence.records(),
    },
    bigintReplacer,
  );

  evidence.seal('access.scenario.sealed', {
    scenarioId: scenario.scenarioId,
    decisions: allocation.decisions.length,
    grantedUnits: allocation.grantedUnits.toString(),
    oversoldUnits: allocation.oversoldUnits.toString(),
  });

  const evidenceSummary = evidence.summary();
  const invariants = checkAccessInvariants({
    scenario,
    pools,
    requests,
    allocation,
    evidence: evidenceSummary,
    macro,
    serializedState,
  });

  const unavailable = allocation.decisions.length > 0 && allocation.grantedUnits === 0n;
  const groupScarcity = scarcityByGroup(pools, allocation.capacity, scenario.scarcityDimension, unavailable);

  const result = {
    schemaVersion: ACCESS_ECONOMY_SCHEMA_VERSION,
    toolVersion: ACCESS_ECONOMY_TOOL_VERSION,
    simulationLabel: ACCESS_ECONOMY_LABEL,
    scenarioId: scenario.scenarioId,
    seed: scenario.seed,
    macroScenarioId: scenario.macroScenarioId,
    inputFixtureSha256: digest({
      scenarioId: scenario.scenarioId,
      seed: scenario.seed,
      macroScenarioId: scenario.macroScenarioId,
      macroEpochs: scenario.macroEpochs,
      shocks: scenario.shocks,
      poolTemplates: scenario.poolTemplates,
      demand: scenario.demand,
    }),
    resultDigestSha256: digest({
      capacity: allocation.capacity,
      counts,
      grantedUnits: allocation.grantedUnits,
      evidenceHead: evidenceSummary.headRecordSha256,
    }),
    scarcityMode: observedScarcity(groupScarcity, unavailable),
    scarcityByGroup: groupScarcity,
    scarcityDimension: scenario.scarcityDimension,
    expectedOutcomesObserved: scenario.expectedOutcomes.every((outcome) => (counts[outcome] ?? 0) > 0),
    capacity: allocation.capacity,
    decisions: allocation.decisions,
    outcomeCounts: counts,
    policyChanges: allocation.policyChanges,
    invariants,
    invariantsHeld: invariants.every((row) => row.held),
    evidence: evidenceSummary,
    totalPublishedUnits,
    totalGrantedUnits: allocation.grantedUnits,
    oversoldUnits: allocation.oversoldUnits,
    refusedRequests: allocation.decisions.filter((row) => row.outcome.startsWith('REFUSED_')).length,
    canonicalIntegrations: ACCESS_CANONICAL_INTEGRATIONS,
    nativeIssuance: {
      sunreyIssuedBySimulation: 0n,
      moonreyIssuedBySimulation: 0n,
      fixedSunreyMoonreyPeg: null,
    },
    productionActivation: {
      environment: 'simulation',
      liveFlagsChanged: false,
      productionAuthorization: false,
    },
  } satisfies AccessEconomyScenarioResult;

  return Object.freeze(result);
}

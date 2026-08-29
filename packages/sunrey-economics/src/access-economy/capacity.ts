/**
 * Derives Access Economy capacity and demand from the existing
 * dual-economy simulation. Capacity is never invented here: it is a share
 * of the productive output the Chunk 75 simulator already produced.
 */

import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import { simulateScenario } from '../engine.ts';
import { DeterministicRng, mulBps } from '../seed.ts';
import type { DualEconomySimulationReport } from '../types.ts';
import { brandAccessEntitlementId } from './branding.ts';
import type {
  AccessCapacityPool,
  AccessDemandProfile,
  AccessEconomyScenario,
  AccessLegalEligibility,
  AccessPoolTemplate,
  AccessRequest,
  AccessRequestOrigin,
  SimulatedAuthorityReference,
} from './types.ts';

/** Fixed simulated clock base. Abstract instants, never wall-clock time. */
export const ACCESS_SIM_EPOCH_START = '2031-04-01T00:00:00.000Z';

export function simInstant(offsetMinutes: number): UtcInstant {
  return asUtcInstant(new Date(Date.parse(ACCESS_SIM_EPOCH_START) + offsetMinutes * 60_000).toISOString());
}

export function macroReport(scenario: AccessEconomyScenario): DualEconomySimulationReport {
  return simulateScenario(scenario.macroScenarioId, {
    seed: scenario.seed,
    epochs: scenario.macroEpochs,
  });
}

function poolBuckets(template: AccessPoolTemplate): readonly { location: string; dateKey: string; providerId: string }[] {
  const buckets: { location: string; dateKey: string; providerId: string }[] = [];
  let index = 0;
  for (const location of template.locations) {
    for (const dateKey of template.dateKeys) {
      const providerId = template.providerIds[index % template.providerIds.length] ?? 'provider.unassigned';
      buckets.push({ location, dateKey, providerId });
      index += 1;
    }
  }
  return Object.freeze(buckets);
}

/**
 * Capacity weighting per bucket. Geographic and temporal scarcity are
 * expressed by skewing available units, not by hiding buckets.
 */
function bucketShareBps(
  scenario: AccessEconomyScenario,
  bucketIndex: number,
  bucketCount: number,
): bigint {
  const even = 10_000n / BigInt(bucketCount);
  if (scenario.scarcityDimension === 'GEOGRAPHIC' && scenario.shocks.includes('ACCESS_GEOGRAPHIC_CONCENTRATION')) {
    return bucketIndex === 0 ? even / 20n : even + (even * 19n) / (20n * BigInt(Math.max(bucketCount - 1, 1)));
  }
  if (scenario.scarcityDimension === 'TEMPORAL' && scenario.shocks.includes('ACCESS_TEMPORAL_PEAK')) {
    return bucketIndex === 0 ? even / 10n : even + (even * 9n) / (10n * BigInt(Math.max(bucketCount - 1, 1)));
  }
  return even;
}

function shockCapacityBps(scenario: AccessEconomyScenario): bigint {
  let bps = 10_000n;
  if (scenario.shocks.includes('ACCESS_ABUNDANCE_EXPANSION')) {
    bps = (bps * 40_000n) / 10_000n;
  }
  if (scenario.shocks.includes('ACCESS_PRODUCTIVE_CAPACITY_FALL')) {
    bps = (bps * 1_800n) / 10_000n;
  }
  return bps;
}

export function buildCapacityPools(
  scenario: AccessEconomyScenario,
  macro: DualEconomySimulationReport,
): readonly AccessCapacityPool[] {
  const pools: AccessCapacityPool[] = [];
  const capacityBps = shockCapacityBps(scenario);
  const providerOutage = scenario.shocks.includes('ACCESS_PROVIDER_OUTAGE');
  const staleEvidence = scenario.shocks.includes('ACCESS_ORACLE_STALE');

  for (const template of scenario.poolTemplates) {
    const categoryOutput = macro.productive.output[template.category] ?? 0n;
    const classUnits = mulBps(mulBps(categoryOutput, template.categoryShareBps), capacityBps);
    const buckets = poolBuckets(template);
    buckets.forEach((bucket, bucketIndex) => {
      const shareBps = bucketShareBps(scenario, bucketIndex, buckets.length);
      const publishedUnits = mulBps(classUnits, shareBps);
      const preCommittedUnits = mulBps(publishedUnits, template.preCommittedBps);
      const providerAvailable = !(providerOutage && bucket.providerId === template.providerIds[0]);
      pools.push(
        Object.freeze({
          poolId: `pool.${template.experienceClass}.${bucket.location}.${bucket.dateKey}`,
          category: template.category,
          experienceClass: template.experienceClass,
          locationId: bucket.location,
          dateKey: bucket.dateKey,
          unit: template.unit,
          providerId: bucket.providerId,
          publishedUnits,
          preCommittedUnits,
          providerAvailable,
          evidenceFreshAsOf: staleEvidence ? simInstant(-72 * 60) : simInstant(-30),
          evidenceStale: staleEvidence,
        }),
      );
    });
  }
  return Object.freeze(pools);
}

function authorityFor(
  scenario: AccessEconomyScenario,
  requestIndex: number,
  rng: DeterministicRng,
  demand: AccessDemandProfile,
): SimulatedAuthorityReference | null {
  if (scenario.shocks.includes('ACCESS_AUTHORITY_WITHHELD')) {
    return null;
  }
  if (rng.nextBps() < demand.missingAuthorityBps) {
    return null;
  }
  return Object.freeze({
    authorityRef: `ea.sim.${scenario.scenarioId}.${requestIndex}`,
    scope: 'ACCESS_RESERVATION',
    verifiedByCanonicalKernel: true,
    issuedBySimulation: false,
    expiresAt: simInstant(120),
  });
}

function eligibilityFor(rng: DeterministicRng, demand: AccessDemandProfile): AccessLegalEligibility {
  const roll = rng.nextBps();
  if (roll < demand.undeterminedEligibilityBps) {
    return 'UNDETERMINED';
  }
  return 'ELIGIBLE';
}

/**
 * Deterministically generates the simulated request population. The RNG
 * shapes who asks for what; it never decides who is granted access.
 */
export function buildRequests(
  scenario: AccessEconomyScenario,
  pools: readonly AccessCapacityPool[],
): readonly AccessRequest[] {
  const demand = scenario.demand;
  const rng = new DeterministicRng(scenario.seed);
  const requests: AccessRequest[] = [];
  if (pools.length === 0) {
    return Object.freeze(requests);
  }
  const hotPool = pools[0]!;
  let requestIndex = 0;

  for (let subject = 0; subject < demand.subjectCount; subject += 1) {
    const subjectId = `subject.${scenario.scenarioId}.${subject.toString().padStart(5, '0')}`;
    for (let attempt = 0; attempt < demand.requestsPerSubject; attempt += 1) {
      const hotspot = rng.nextBps() < demand.hotspotConcentrationBps;
      const pool = hotspot ? hotPool : pools[rng.nextBounded(pools.length)]!;
      const quantity = rng.jitterBps(demand.meanQuantity, demand.quantityJitter);
      const narrowEntitlement = rng.nextBps() < demand.narrowEntitlementBps;
      const agentProposal = rng.nextBps() < demand.agentProposalBps;
      const origin: AccessRequestOrigin = agentProposal ? 'AGENT_PROPOSAL' : 'HUMAN';
      const selfApproval = agentProposal
        ? rng.nextBps() < demand.agentSelfApprovalBps || scenario.shocks.includes('ACCESS_AGENT_SELF_APPROVAL_ATTEMPT')
        : false;
      requests.push(
        Object.freeze({
          requestId: `req.${scenario.scenarioId}.${requestIndex.toString().padStart(6, '0')}`,
          subjectId,
          entitlementId: brandAccessEntitlementId(`aent_sim_${scenario.scenarioId}_${subject}`),
          poolId: pool.poolId,
          quantity: quantity > 0n ? quantity : 1n,
          entitlementCapacityUnits: narrowEntitlement
            ? demand.meanQuantity / 2n
            : demand.meanQuantity + demand.quantityJitter,
          purpose: `ACCESS_${pool.experienceClass.toUpperCase()}`,
          jurisdiction: pool.locationId.split('.')[0] ?? 'SIM',
          origin,
          submittedAt: simInstant(requestIndex % (24 * 60)),
          policyPriorityBand: (requestIndex % 3) + 1,
          authority: authorityFor(scenario, requestIndex, rng, demand),
          legalEligibility: eligibilityFor(rng, demand),
          agentSelfApprovalAttempted: selfApproval,
        }),
      );
      requestIndex += 1;
    }
  }
  return Object.freeze(requests);
}

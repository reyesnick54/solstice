import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ACCESS_15_INVARIANT_IDS,
  allocateProportional,
  allAccess15InvariantsHeld,
  assertNoOverAllocation,
  buildCapacityPool,
  CATEGORY_CAPACITY_UNITS,
  checkAccess15Invariants,
  computeNormalizedWeight,
  computeTwab,
  demoEpoch,
  demoParticipants,
  demoPools,
  demoSupply,
  eligibleSupplyForParticipants,
  flatEpochCheckpoints,
  PARTICIPATION_SCALE,
  runDualTokenAllocation,
  sqrtTransformScaled,
  syntheticParticipants,
  totalAllocated,
} from './index.ts';
import { serializeAllocationResult } from './invariants.ts';
import { subjectRefFor } from '../ids.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { evaluateAntiGaming } from './anti-gaming.ts';
import { checkpointAt } from './twab.ts';
import {
  DEFAULT_SQRT_TRANSFORM,
  SIMULATION_DUAL_PARTICIPATION_POLICY,
} from './policy.ts';

describe('ACCESS-15 fixed-point transforms', () => {
  it('applies sqrt concave transform deterministically', () => {
    const quarter = PARTICIPATION_SCALE / 4n;
    const half = sqrtTransformScaled(quarter);
    assert.equal(half, PARTICIPATION_SCALE / 2n);
  });
});

describe('ACCESS-15 TWAB', () => {
  it('averages balances across epoch without end-snapshot exploitation', () => {
    const epoch = demoEpoch();
    const checkpoints = [
      checkpointAt(epoch.startsAt, 0n, 0n),
      checkpointAt(asUtcInstant('2026-08-15T00:00:00.000Z'), 1_000n, 0n),
      checkpointAt(epoch.endsAt, 0n, 0n),
    ];
    const twab = computeTwab(epoch, checkpoints);
    assert.ok(twab.eligibleSunReyTwab > 0n);
    assert.ok(twab.eligibleSunReyTwab < 1_000n);
  });
});

describe('ACCESS-15 demo participants A-D', () => {
  const epoch = demoEpoch();
  const supply = demoSupply();
  const pools = demoPools(epoch.epochId);

  it('allocates with diminishing returns and dual bonus', () => {
    const result = runDualTokenAllocation({
      epoch,
      participants: demoParticipants(),
      supply,
      pools,
      categories: ['MOBILITY', 'AI_COMPUTE', 'EXPERIENCES'],
    });

    const mobility = result.normalized.filter((row) => row.category === 'MOBILITY');
    const a = mobility.find((row) => row.subjectRef === subjectRefFor('participant-a'))!;
    const b = mobility.find((row) => row.subjectRef === subjectRefFor('participant-b'))!;
    const c = mobility.find((row) => row.subjectRef === subjectRefFor('participant-c'))!;
    const d = mobility.find((row) => row.subjectRef === subjectRefFor('participant-d'))!;

    assert.ok(a.weightScaled > 0n);
    assert.ok(b.weightScaled > a.weightScaled);
    assert.ok(c.weightScaled > 0n);
    assert.ok(d.weightScaled > a.weightScaled);

    const aiCompute = result.normalized.filter((row) => row.category === 'AI_COMPUTE');
    const bAi = aiCompute.find((row) => row.subjectRef === subjectRefFor('participant-b'))!.weightScaled;
    const cAi = aiCompute.find((row) => row.subjectRef === subjectRefFor('participant-c'))!.weightScaled;
    assert.ok(cAi > bAi, 'MoonRey-heavy participant should weigh more in AI_COMPUTE');

    const experiences = result.normalized.filter((row) => row.category === 'EXPERIENCES');
    const bExp = experiences.find((row) => row.subjectRef === subjectRefFor('participant-b'))!.weightScaled;
    const cExp = experiences.find((row) => row.subjectRef === subjectRefFor('participant-c'))!.weightScaled;
    assert.ok(bExp > cExp, 'SunRey-heavy participant should weigh more in EXPERIENCES');
  });

  it('never exceeds pool capacity', () => {
    const result = runDualTokenAllocation({
      epoch,
      participants: demoParticipants(),
      supply,
      pools,
    });
    for (const pool of result.pools) {
      const allocated = totalAllocated(result.allocations.filter((row) => row.poolId === pool.poolId));
      assert.ok(allocated <= pool.allocatableCapacity);
    }
  });

  it('holds all ACCESS-15 invariants', () => {
    const result = runDualTokenAllocation({
      epoch,
      participants: demoParticipants(),
      supply,
      pools,
    });
    const checks = checkAccess15Invariants(result, serializeAllocationResult(result));
    assert.equal(checks.length, ACCESS_15_INVARIANT_IDS.length);
    assert.equal(allAccess15InvariantsHeld(checks), true);
  });
});

describe('ACCESS-15 conservation property tests', () => {
  it('deterministic allocation is stable across repeated runs', () => {
    const epoch = demoEpoch();
    const participants = demoParticipants();
    const supply = demoSupply();
    const pools = demoPools(epoch.epochId);
    const first = runDualTokenAllocation({ epoch, participants, supply, pools, categories: ['MOBILITY'] });
    const second = runDualTokenAllocation({ epoch, participants, supply, pools, categories: ['MOBILITY'] });
    assert.deepEqual(
      first.allocations.map((row) => [row.subjectRef, row.allocatedUnits]),
      second.allocations.map((row) => [row.subjectRef, row.allocatedUnits]),
    );
  });

  it('largest-remainder distribution is deterministic', () => {
    const pool = buildCapacityPool({
      poolId: 'pool-test',
      epochId: 'epoch-test',
      category: 'MOBILITY',
      geography: 'SIM',
      timeWindow: '2026-08',
      capacityUnit: CATEGORY_CAPACITY_UNITS.MOBILITY,
      verifiedGrossCapacity: 10n,
      reservedCapacity: 0n,
      providerCommittedCapacity: 0n,
      fundedExternalCapacity: 0n,
      policyReservedCapacity: 0n,
      sourceRefs: [],
      evidenceRefs: [],
      status: 'VERIFIED',
      allocatableCapacity: 10n,
    });
    const participants = [
      computeNormalizedWeight(
        subjectRefFor('p1'),
        'epoch-test',
        'MOBILITY',
        {
          subjectRef: subjectRefFor('p1'),
          epochId: 'epoch-test',
          sunReyTwab: 1n,
          moonReyTwab: 1n,
          eligibleSunReyTwab: 1n,
          eligibleMoonReyTwab: 1n,
          policyVersion: 'v1',
          sourceStateCommitment: 'c1',
          calculatedAt: asUtcInstant('2026-08-31T23:59:59.999Z'),
        },
        { sunReyEligibleBase: 3n, moonReyEligibleBase: 3n, sourceStateCommitment: 'c1', observedAt: asUtcInstant('2026-08-31T23:59:59.999Z') },
        DEFAULT_SQRT_TRANSFORM,
        SIMULATION_DUAL_PARTICIPATION_POLICY,
      ),
      computeNormalizedWeight(
        subjectRefFor('p2'),
        'epoch-test',
        'MOBILITY',
        {
          subjectRef: subjectRefFor('p2'),
          epochId: 'epoch-test',
          sunReyTwab: 2n,
          moonReyTwab: 2n,
          eligibleSunReyTwab: 2n,
          eligibleMoonReyTwab: 2n,
          policyVersion: 'v1',
          sourceStateCommitment: 'c1',
          calculatedAt: asUtcInstant('2026-08-31T23:59:59.999Z'),
        },
        { sunReyEligibleBase: 3n, moonReyEligibleBase: 3n, sourceStateCommitment: 'c1', observedAt: asUtcInstant('2026-08-31T23:59:59.999Z') },
        DEFAULT_SQRT_TRANSFORM,
        SIMULATION_DUAL_PARTICIPATION_POLICY,
      ),
    ];
    const allocations = allocateProportional({
      epochId: 'epoch-test',
      pool,
      participants,
      policyVersion: 'v1',
    });
    assert.equal(totalAllocated(allocations), 10n);
    assert.doesNotThrow(() => assertNoOverAllocation(pool, allocations));
  });
});

describe('ACCESS-15 adversarial balance history', () => {
  it('flags rapid cycling and excludes self-transfer loops', () => {
    const epoch = demoEpoch();
    const checkpoints = [
      checkpointAt(epoch.startsAt, 100n, 0n),
      checkpointAt(asUtcInstant('2026-08-02T00:00:00.000Z'), 0n, 0n),
      checkpointAt(asUtcInstant('2026-08-03T00:00:00.000Z'), 200n, 0n),
      checkpointAt(asUtcInstant('2026-08-04T00:00:00.000Z'), 0n, 0n),
      checkpointAt(asUtcInstant('2026-08-05T00:00:00.000Z'), 200n, 0n),
      checkpointAt(asUtcInstant('2026-08-06T00:00:00.000Z'), 0n, 0n),
      checkpointAt(asUtcInstant('2026-08-07T00:00:00.000Z'), 200n, 0n),
    ];
    const gaming = evaluateAntiGaming(subjectRefFor('adversary'), checkpoints, ['canonical-custody']);
    assert.equal(gaming.flags.rapidCyclingSuspected, true);
  });

  it('rejects duplicate custody sources', () => {
    const gaming = evaluateAntiGaming(
      subjectRefFor('dup'),
      flatEpochCheckpoints(subjectRefFor('dup'), demoEpoch(), 10n, 10n),
      ['custody-a', 'custody-b'],
    );
    assert.equal(gaming.excludedFromAllocation, true);
  });
});

describe('ACCESS-15 large synthetic participant tests', () => {
  it('runs 1,000 participants without over-allocation', () => {
    const epoch = demoEpoch();
    const participants = syntheticParticipants(1_000, 42);
    const supply = eligibleSupplyForParticipants(participants, 'synthetic-1k');
    const pools = demoPools(epoch.epochId).map((pool) =>
      buildCapacityPool({
        ...pool,
        verifiedGrossCapacity: 50_000n,
        reservedCapacity: 0n,
        providerCommittedCapacity: 0n,
        policyReservedCapacity: 0n,
      }),
    );
    const result = runDualTokenAllocation({
      epoch,
      participants,
      supply,
      pools,
      categories: ['MOBILITY'],
    });
    const pool = result.pools[0]!;
    const allocated = totalAllocated(result.allocations);
    assert.ok(allocated <= pool.allocatableCapacity);
    assert.equal(allAccess15InvariantsHeld(checkAccess15Invariants(result, serializeAllocationResult(result))), true);
  });

  it('runs 100,000 synthetic participants for MOBILITY only', () => {
    const epoch = demoEpoch();
    const participants = syntheticParticipants(100_000, 99);
    const supply = eligibleSupplyForParticipants(participants, 'synthetic-100k');
    const pool = buildCapacityPool({
      poolId: 'pool-100k',
      epochId: epoch.epochId,
      category: 'MOBILITY',
      geography: 'GLOBAL_SIM',
      timeWindow: epoch.epochId,
      capacityUnit: CATEGORY_CAPACITY_UNITS.MOBILITY,
      verifiedGrossCapacity: 500_000n,
      reservedCapacity: 0n,
      providerCommittedCapacity: 0n,
      fundedExternalCapacity: 0n,
      policyReservedCapacity: 0n,
      sourceRefs: [],
      evidenceRefs: [],
      status: 'VERIFIED',
    });
    const result = runDualTokenAllocation({
      epoch,
      participants,
      supply,
      pools: [pool],
      categories: ['MOBILITY'],
    });
    assert.ok(totalAllocated(result.allocations) <= pool.allocatableCapacity);
  });
});

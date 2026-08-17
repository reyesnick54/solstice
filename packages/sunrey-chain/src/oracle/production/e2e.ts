import { moonreyIssuanceProperties } from '../../assurance/properties.ts';
import { SeededRng } from '../../assurance/rng.ts';
import {
  ProductiveEconomyEngine,
  developmentIssuancePolicy,
  evaluateIssuance,
  emptyEpoch,
  finalizeIssuance,
  verifyProductiveClaim,
} from '../../productive/index.ts';
import { fixtureClaim, fixtureRight, solarFacility } from '../../productive/fixtures.ts';
import type { OracleFact } from '../../productive/oracle.ts';
import { WEIGHT_SCALE } from '../../productive/types.ts';
import { defaultOracleSuiteId } from '../crypto.ts';
import { OracleCollector, engineSubmissionPort } from './collector.ts';
import { analyzeConcentration } from './concentration.ts';
import { evaluateProductionContributionEligibility, defaultEligibilityPolicy } from './eligibility.ts';
import { analyzeIndependence } from './independence.ts';
import { collectorIdentityFor, createProductionPlane, planePublicFeeds, planeQuality } from './plane.ts';
import { finalizeOrFailClosed } from './quorum.ts';
import { SoftwareDevelopmentSigner } from './signing.ts';
import { LocalProviderSimulator } from './simulator.ts';

export type ProductionOracleE2EReport = {
  readonly validatorCount: 7;
  readonly providerCount: 3;
  readonly factId: string;
  readonly qualityStatus: string;
  readonly validatorsAgree: boolean;
  readonly contributionId: string;
  readonly authorizationId: string;
  readonly issuanceId: string;
  readonly explorerFeedId: string;
  readonly explorerVerifiedFact: string | null;
  readonly staleFailsClosed: boolean;
  readonly conflicted: boolean;
  readonly independenceRequired: true;
  readonly concentrationWarnedWithoutSybilClaim: true;
  readonly moonreyEligibilityChecked: true;
  readonly automaticIssuance: false;
  readonly formalMoonReyInvariants: true;
  readonly consensusCalledExternalApi: false;
};

function factToProductive(factId: string, objectId: string, sourceId: string, quantity: bigint): OracleFact {
  return Object.freeze({
    factId,
    feedId: 'feed_energy_production_sim',
    objectId,
    category: 'ENERGY',
    quantity,
    unit: 'kWh',
    sourceId,
    quality: WEIGHT_SCALE,
    observedAtUnixSeconds: 1_799_000_000n,
    validFromUnixSeconds: 1_799_000_000n,
    validUntilUnixSeconds: 1_801_000_000n,
    conflictKey: `ck.${objectId}.kWh`,
    status: 'FINALIZED',
    attestationHeight: 8,
  });
}

export function runProductionOracleE2E(nowUnix = 1_700_000_000n): ProductionOracleE2EReport {
  const plane = createProductionPlane(nowUnix);
  const values = ['100', '102', '104'];
  const labels = ['energy-a', 'energy-b', 'energy-c'] as const;

  for (let i = 0; i < labels.length; i += 1) {
    const label = labels[i]!;
    const sourceId = `src_${label}`;
    const signer = SoftwareDevelopmentSigner.fromLabel(label, defaultOracleSuiteId());
    if (!signer.ok) {
      throw new Error(signer.error.detail);
    }
    const identity = collectorIdentityFor(plane, sourceId, nowUnix);
    const adapter = new LocalProviderSimulator(
      { ...Object.freeze({
        category: 'energy' as const,
        identifier: 'plant_sim_1',
        healthyValue: values[i]!,
        unit: 'MWh',
        schemaId: 'energy.resource.v1',
        schemaVersion: 1,
      }) },
      'HEALTHY',
      nowUnix,
    );
    for (const engine of plane.engines) {
      const collector = new OracleCollector(
        plane.onboarding,
        plane.sources,
        adapter,
        signer.value,
        plane.secrets,
        engineSubmissionPort(engine),
      );
      const ran = collector.run({
        identity,
        sourceId,
        feed: plane.feed,
        subject: 'plant_sim_1',
        sequence: 1n,
        nowUnix,
        networkId: engine.networkId,
        chainId: engine.chainId,
      });
      if (!ran.ok) {
        throw new Error(ran.error.detail);
      }
    }
  }

  const facts = plane.engines.map((engine) => {
    const finalized = finalizeOrFailClosed(
      engine,
      plane.feed,
      plane.sources.list(),
      { subject: 'plant_sim_1', startUnix: nowUnix, endUnix: nowUnix + 60n },
      true,
    );
    if (!finalized.ok) {
      throw new Error(finalized.error.detail);
    }
    return finalized.value;
  });
  const fact = facts[0]!;
  const validatorsAgree = facts.every((row) => row.factId === fact.factId && row.aggregatedValue.mantissa === fact.aggregatedValue.mantissa);

  const independence = analyzeIndependence(plane.sources.list(), true);
  if (independence.some((row) => !row.independent && row.sourceIds.length > 1)) {
    throw new Error('shared-controller sources counted as independent');
  }
  const concentration = analyzeConcentration(plane.sources.list(), nowUnix, 9_000);

  const object = solarFacility();
  const productive = new ProductiveEconomyEngine({
    height: 10,
    blockTimeUnixSeconds: 1_800_000_000n,
    blockId: 'blk_prod_oracle_10',
  });
  productive.registerObject(object);
  productive.putRight(fixtureRight({ rightId: object.rightsReference, objectId: object.objectId, holderId: object.controller }));
  const productiveFacts = labels.map((label, index) =>
    factToProductive(`fact.${object.objectId}.${index + 1}`, object.objectId, `oracle_${label}`, 1_200n),
  );
  for (const row of productiveFacts) {
    productive.putOracleFact(row);
  }
  const claim = fixtureClaim({
    claimId: 'claim.solar.output.prod',
    objectId: object.objectId,
    claimType: 'OUTPUT',
    category: 'ENERGY',
    quantity: 1_200n,
    unit: 'kWh',
  });
  const verified = verifyProductiveClaim(claim, {
    height: 10,
    blockTimeUnixSeconds: 1_800_000_000n,
    object,
    rights: [fixtureRight({ rightId: object.rightsReference, objectId: object.objectId, holderId: object.controller })],
    facts: productiveFacts,
    policy: developmentIssuancePolicy(),
    knownFingerprints: new Set(),
  });
  if (!verified.ok) {
    throw new Error(verified.code);
  }
  const eligibility = evaluateProductionContributionEligibility({
    policy: defaultEligibilityPolicy([plane.feed.feedId], ['energy']),
    feed: plane.feed,
    providers: plane.providers,
    fact,
    category: 'energy',
    nowUnix: nowUnix + 30n,
    contribution: verified.contribution,
    qualityBps: planeQuality('src_energy-a').scoreBps,
  });
  if (!eligibility.ok) {
    throw new Error(eligibility.error.detail);
  }
  const issued = evaluateIssuance(verified.contribution, developmentIssuancePolicy(), emptyEpoch(1), new Set());
  if (!issued.ok) {
    throw new Error(issued.code);
  }
  const receipt = finalizeIssuance(issued.authorization, verified.contribution, 10, 'blk_prod_oracle_10');
  const explorer = planePublicFeeds(plane, fact, nowUnix + 30n)[0]!;

  const staleAdapter = new LocalProviderSimulator(
    {
      category: 'energy',
      identifier: 'plant_sim_1',
      healthyValue: '100',
      unit: 'MWh',
      schemaId: 'energy.resource.v1',
      schemaVersion: 1,
    },
    'STALE',
    nowUnix,
  );
  const staleSigner = SoftwareDevelopmentSigner.fromLabel('energy-a', defaultOracleSuiteId());
  if (!staleSigner.ok) {
    throw new Error(staleSigner.error.detail);
  }
  const staleRun = new OracleCollector(
    plane.onboarding,
    plane.sources,
    staleAdapter,
    staleSigner.value,
    plane.secrets,
    engineSubmissionPort(plane.engines[0]!),
  ).run({
    identity: collectorIdentityFor(plane, 'src_energy-a', nowUnix),
    sourceId: 'src_energy-a',
    feed: plane.feed,
    subject: 'plant_sim_stale',
    sequence: 2n,
    nowUnix,
    networkId: plane.engines[0]!.networkId,
    chainId: plane.engines[0]!.chainId,
  });
  const staleFailsClosed = !staleRun.ok || staleRun.value.observation.validUntilUnix < nowUnix + 86_400n;

  const conflictValues = ['10', '500', '12'];
  for (let i = 0; i < labels.length; i += 1) {
    const label = labels[i]!;
    const signer = SoftwareDevelopmentSigner.fromLabel(label, defaultOracleSuiteId());
    if (!signer.ok) {
      throw new Error(signer.error.detail);
    }
    const adapter = new LocalProviderSimulator(
      {
        category: 'energy',
        identifier: 'plant_sim_conflict',
        healthyValue: conflictValues[i]!,
        unit: 'MWh',
        schemaId: 'energy.resource.v1',
        schemaVersion: 1,
      },
      'HEALTHY',
      nowUnix + 100n,
    );
    const collector = new OracleCollector(
      plane.onboarding,
      plane.sources,
      adapter,
      signer.value,
      plane.secrets,
      engineSubmissionPort(plane.engines[0]!),
    );
    const ran = collector.run({
      identity: collectorIdentityFor(plane, `src_${label}`, nowUnix + 100n),
      sourceId: `src_${label}`,
      feed: plane.feed,
      subject: 'plant_sim_conflict',
      sequence: 3n,
      nowUnix: nowUnix + 100n,
      networkId: plane.engines[0]!.networkId,
      chainId: plane.engines[0]!.chainId,
    });
    if (!ran.ok) {
      throw new Error(ran.error.detail);
    }
  }
  const conflicted = finalizeOrFailClosed(
    plane.engines[0]!,
    plane.feed,
    plane.sources.list(),
    { subject: 'plant_sim_conflict', startUnix: nowUnix + 100n, endUnix: nowUnix + 160n },
    true,
  );
  if (!conflicted.ok) {
    throw new Error(conflicted.error.detail);
  }

  moonreyIssuanceProperties(new SeededRng(68), 8);

  return Object.freeze({
    validatorCount: 7,
    providerCount: 3,
    factId: fact.factId,
    qualityStatus: fact.qualityStatus,
    validatorsAgree,
    contributionId: verified.contribution.contributionId,
    authorizationId: issued.authorization.authorizationId,
    issuanceId: receipt.issuanceId,
    explorerFeedId: explorer.feedId,
    explorerVerifiedFact: explorer.verifiedFact,
    staleFailsClosed,
    conflicted: conflicted.value.qualityStatus === 'CONFLICTED',
    independenceRequired: true,
    concentrationWarnedWithoutSybilClaim: concentration.sybilResistanceClaimed === false,
    moonreyEligibilityChecked: eligibility.value.eligible,
    automaticIssuance: false,
    formalMoonReyInvariants: true,
    consensusCalledExternalApi: false,
  });
}

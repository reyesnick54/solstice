/**
 * ENGINEERING_SIMULATION_PARAMETERS
 *
 * Development fixtures only. These weights, quantities, and oracle
 * qualities are not market prices, yields, or economic promises.
 */

import type { RightObject } from '../protocol/rights.ts';
import type { ProductiveClaim } from './claims.ts';
import type { EngineClock } from './engine.ts';
import type { ProductiveEconomicObject } from './objects.ts';
import type { OracleFact } from './oracle.ts';
import { PRODUCTIVE_SCHEMA_VERSION, WEIGHT_SCALE, type ClaimType, type ProductiveCategory } from './types.ts';

export const FIXTURE_PARAMETER_CLASS = 'ENGINEERING_SIMULATION_PARAMETERS' as const;

export const DEV_CLOCK: EngineClock = Object.freeze({
  height: 10,
  blockTimeUnixSeconds: 1_800_000_000n,
  blockId: 'blk_dev_productive_10',
});

const GEO = Object.freeze({ geographyId: 'geo.dev.sim', jurisdiction: 'SIMULATION' });

export function fixtureRight(input: {
  readonly rightId: string;
  readonly objectId: string;
  readonly holderId: string;
}): RightObject {
  return Object.freeze({
    schemaVersion: 1,
    rightId: input.rightId,
    rightType: 'CONTROL',
    subjectId: input.holderId,
    objectId: input.objectId,
    holderId: input.holderId,
    issuerId: 'iss.dev.rights',
    scope: 'productive',
    purpose: 'sunrey.productive-capacity.record',
    permittedOperations: ['ATTEST', 'CLAIM'],
    jurisdiction: 'SIMULATION',
    startUnixSeconds: 1_700_000_000n,
    expirationUnixSeconds: 1_900_000_000n,
    revocationState: 'ACTIVE',
    transferable: false,
    compensationRef: '',
    provenanceRef: 'prov.dev',
  });
}

export function fixtureObject(input: {
  readonly objectId: string;
  readonly category: ProductiveCategory;
  readonly unitSchema: string;
  readonly owner?: string;
}): ProductiveEconomicObject {
  const owner = input.owner ?? `ctl.${input.objectId}`;
  return Object.freeze({
    schemaVersion: PRODUCTIVE_SCHEMA_VERSION,
    objectId: input.objectId,
    category: input.category,
    owner,
    controller: owner,
    operator: owner,
    geography: GEO,
    rightsReference: `right.${input.objectId}`,
    oracleFeedReferences: [`feed.${input.objectId}`],
    unitSchema: input.unitSchema,
    capacityMetadata: Object.freeze({ fixture: FIXTURE_PARAMETER_CLASS }),
    provenance: 'prov.dev.object',
    status: 'ACTIVE',
    activationHeight: 1,
    expirationHeight: null,
    validFromUnixSeconds: 1_700_000_000n,
    validUntilUnixSeconds: null,
  });
}

export function fixtureFacts(input: {
  readonly objectId: string;
  readonly category: ProductiveCategory;
  readonly quantity: bigint;
  readonly unit: string;
  readonly count?: number;
  readonly quality?: bigint;
  readonly validUntil?: bigint;
  readonly conflicted?: boolean;
}): OracleFact[] {
  const count = input.count ?? 3;
  const facts: OracleFact[] = [];
  for (let index = 1; index <= count; index += 1) {
    facts.push(
      Object.freeze({
        factId: `fact.${input.objectId}.${index}`,
        feedId: `feed.${input.objectId}`,
        objectId: input.objectId,
        category: input.category,
        quantity: input.conflicted && index === count ? input.quantity + 1n : input.quantity,
        unit: input.unit,
        sourceId: `oracle.${index}`,
        quality: input.quality ?? WEIGHT_SCALE,
        observedAtUnixSeconds: 1_799_000_000n,
        validFromUnixSeconds: 1_799_000_000n,
        validUntilUnixSeconds: input.validUntil ?? 1_801_000_000n,
        conflictKey: `ck.${input.objectId}.${input.unit}`,
        status: input.conflicted && index === count ? 'CONFLICTED' : 'FINALIZED',
        attestationHeight: 8,
      }),
    );
  }
  return facts;
}

export function fixtureClaim(input: {
  readonly claimId: string;
  readonly objectId: string;
  readonly claimType: ClaimType;
  readonly category: ProductiveCategory;
  readonly quantity: bigint;
  readonly unit: string;
  readonly controller?: string;
  readonly factCount?: number;
  readonly epoch?: number;
}): ProductiveClaim {
  const count = input.factCount ?? 3;
  const factIds = Array.from({ length: count }, (_, index) => `fact.${input.objectId}.${index + 1}`);
  return Object.freeze({
    schemaVersion: PRODUCTIVE_SCHEMA_VERSION,
    claimId: input.claimId,
    objectId: input.objectId,
    claimType: input.claimType,
    category: input.category,
    quantity: input.quantity,
    unit: input.unit,
    measurementPeriod: Object.freeze({
      validFromUnixSeconds: 1_799_000_000n,
      validUntilUnixSeconds: 1_800_000_000n,
      epoch: input.epoch ?? 1,
    }),
    geography: GEO,
    oracleFactIds: factIds,
    rightsReferences: [`right.${input.objectId}`],
    controller: input.controller ?? `ctl.${input.objectId}`,
    proofReferences: ['proof.dev'],
    status: 'SUBMITTED',
    upstreamContributionIds: [],
  });
}

export function solarFacility(): ProductiveEconomicObject {
  return fixtureObject({
    objectId: 'obj.solar.alpha',
    category: 'ENERGY',
    unitSchema: 'kWh',
  });
}

export function gpuCluster(): ProductiveEconomicObject {
  return fixtureObject({
    objectId: 'obj.gpu.cluster',
    category: 'AI_COMPUTE',
    unitSchema: 'GPU_HOUR',
  });
}

export function automatedFactory(): ProductiveEconomicObject {
  return fixtureObject({
    objectId: 'obj.factory.auto',
    category: 'MANUFACTURING',
    unitSchema: 'UNIT',
  });
}

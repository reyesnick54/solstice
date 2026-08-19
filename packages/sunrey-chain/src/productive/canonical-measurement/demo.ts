import { ENERGY_FIXTURE } from '../../oracle/production/simulator.ts';
import { fixtureVerifiedFact, energyBuildInput } from '../claim-candidate/fixtures.ts';
import { buildProductiveClaimCandidate } from '../claim-candidate/builder.ts';
import { claimFromCandidate } from '../claim-candidate/claim-gate.ts';
import { fixtureFacts, fixtureObject, fixtureRight, DEV_CLOCK } from '../fixtures.ts';
import { ProductiveEconomyEngine } from '../engine.ts';
import { WEIGHT_SCALE } from '../types.ts';
import {
  CANONICAL_UNIT_AUTHORITY,
  NORMALIZATION_AUTHORIZES_MOONREY,
  PHYSICAL_NORMALIZATION_INCLUDES_ECONOMIC_WEIGHTING,
  PRODUCTION_ACTIVE,
} from '../../units/index.ts';
import { LOSSY_CONVERSION_ALLOWED } from '../../units/constitution.ts';
import { measureSourceObservation } from '../../units/pipeline.ts';

export type MoonReyCanonicalMeasurementReport = {
  readonly sourceObservationId: string;
  readonly factId: string;
  readonly receiptId: string;
  readonly candidateId: string;
  readonly contributionId: string;
  readonly canonicalUnit: string;
  readonly canonicalQuantity: string;
  readonly CANONICAL_UNIT_AUTHORITY: typeof CANONICAL_UNIT_AUTHORITY;
  readonly PHYSICAL_NORMALIZATION_INCLUDES_ECONOMIC_WEIGHTING: false;
  readonly LOSSY_CONVERSION: false;
  readonly NORMALIZATION_AUTHORIZES_MOONREY: false;
  readonly PRODUCTION_ACTIVE: false;
};

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { detail: string; code?: string } }): T {
  if (!result.ok) {
    throw new Error(result.error.detail);
  }
  return result.value;
}

export function runMoonReyCanonicalMeasurementDemo(): MoonReyCanonicalMeasurementReport {
  const fixture = ENERGY_FIXTURE;
  const observation = unwrap(
    measureSourceObservation({
      sourceUnit: fixture.unit,
      sourceMantissa: BigInt(fixture.healthyValue),
      productiveCategory: 'ENERGY',
      factType: 'ENERGY_PRODUCTION',
      claimType: 'OUTPUT',
      measurementStart: 1_799_000_000n,
      measurementEnd: 1_800_000_000n,
      clock: { nowIso: () => '2026-08-19T00:00:00.000Z' },
    }),
  );
  const fact = fixtureVerifiedFact({
    subject: 'obj.solar.alpha',
    unit: 'kWh',
    quantity: 1_200n,
  });
  const built = unwrap(buildProductiveClaimCandidate(energyBuildInput({ unit: 'kWh' })));
  if (built.automaticIssuance !== false) {
    throw new Error('normalization must not authorize MoonRey');
  }
  const object = fixtureObject({ objectId: built.objectId, category: 'ENERGY', unitSchema: 'kWh' });
  const engine = new ProductiveEconomyEngine(DEV_CLOCK);
  engine.registerObject(object);
  engine.putRight(fixtureRight({ rightId: object.rightsReference, objectId: object.objectId, holderId: object.controller }));
  for (const oracleFact of fixtureFacts({
    objectId: object.objectId,
    category: 'ENERGY',
    quantity: built.quantity,
    unit: 'kWh',
    quality: WEIGHT_SCALE,
  })) {
    engine.putOracleFact(oracleFact);
  }
  const claim = claimFromCandidate(built, 'claim.canonical.energy', object.controller);
  engine.submitClaim({
    ...claim,
    oracleFactIds: fixtureFacts({
      objectId: object.objectId,
      category: 'ENERGY',
      quantity: built.quantity,
      unit: 'kWh',
    }).map((row) => row.factId),
  });
  const verified = engine.verifyClaim('claim.canonical.energy');
  if (!verified.ok) {
    throw new Error(verified.code);
  }
  const report: MoonReyCanonicalMeasurementReport = Object.freeze({
    sourceObservationId: `obs.${fixture.identifier}`,
    factId: fact.factId,
    receiptId: observation.normalizationReceiptId,
    candidateId: built.candidateId,
    contributionId: verified.contribution.contributionId,
    canonicalUnit: built.canonicalUnit,
    canonicalQuantity: `${built.canonicalQuantity.mantissa.toString()}/${built.canonicalQuantity.denominator.toString()}`,
    CANONICAL_UNIT_AUTHORITY,
    PHYSICAL_NORMALIZATION_INCLUDES_ECONOMIC_WEIGHTING,
    LOSSY_CONVERSION: LOSSY_CONVERSION_ALLOWED,
    NORMALIZATION_AUTHORIZES_MOONREY,
    PRODUCTION_ACTIVE,
  });
  console.log('MoonRey canonical measurement migration — Chunk 119');
  console.log(`provider fixture=${fixture.identifier}`);
  console.log(`oracle observation unit=${fixture.unit} quantity=${fixture.healthyValue}`);
  console.log(`verified fact=${report.factId}`);
  console.log(`canonical unit=${report.canonicalUnit} quantity=${report.canonicalQuantity}`);
  console.log(`normalization receipt=${report.receiptId}`);
  console.log(`claim candidate=${report.candidateId}`);
  console.log(`verified contribution=${report.contributionId}`);
  console.log(`CANONICAL_UNIT_AUTHORITY=${report.CANONICAL_UNIT_AUTHORITY}`);
  console.log(`PHYSICAL_NORMALIZATION_INCLUDES_ECONOMIC_WEIGHTING=${String(report.PHYSICAL_NORMALIZATION_INCLUDES_ECONOMIC_WEIGHTING)}`);
  console.log(`LOSSY_CONVERSION=${String(report.LOSSY_CONVERSION)}`);
  console.log(`NORMALIZATION_AUTHORIZES_MOONREY=${String(report.NORMALIZATION_AUTHORIZES_MOONREY)}`);
  console.log(`PRODUCTION_ACTIVE=${String(report.PRODUCTION_ACTIVE)}`);
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMoonReyCanonicalMeasurementDemo();
}

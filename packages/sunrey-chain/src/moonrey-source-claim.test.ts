import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EconomicAssetRegistry } from '../../economic-asset-registry/src/index.ts';
import { EconomicDataSourceRegistry } from './oracle/production/sources.ts';
import { developmentProductionFeed } from './oracle/production/plane.ts';
import {
  CANONICAL_SOURCE_TAXONOMY,
  HISTORICAL_ENERGY_PRODUCTION_MAPPING,
  allProductiveCategoriesMapped,
  historicalMapping,
  mappingById,
  moonreySourceCoverageReport,
  registryWithRetiredCategory,
  validateSourceFactClaimMapping,
} from './oracle/source-taxonomy/index.ts';
import { ProductiveClaimCandidateBuilder, buildProductiveClaimCandidate } from './productive/claim-candidate/builder.ts';
import {
  claimFromCandidate,
  gateMappedClaimSubmission,
  mappingVersionOf,
} from './productive/claim-candidate/claim-gate.ts';
import {
  attachVerifiedContributionLineage,
  recordCompatibilityLineage,
  registryDoesNotAuthorizeMint,
} from './productive/claim-candidate/lineage.ts';
import { candidateCannotIssue, candidateCannotVerify } from './productive/claim-candidate/types.ts';
import {
  CANDIDATE_NOW,
  energyBuildInput,
  fixtureObject,
  pathBuildInput,
  requireMapping,
} from './productive/claim-candidate/fixtures.ts';
import { runMoonReySourceClaimPathDemo } from './productive/claim-candidate/demo.ts';
import { ProductiveEconomyEngine } from './productive/engine.ts';
import { fixtureFacts, fixtureRight } from './productive/fixtures.ts';
import { WEIGHT_SCALE } from './productive/types.ts';

function fixtureSource(input: {
  readonly sourceId: string;
  readonly category: 'energy' | 'compute' | 'manufacturing' | 'reference_price' | 'ai_usage' | 'service_delivery';
  readonly factType:
    | 'ENERGY_PRODUCTION'
    | 'SERVICE_DELIVERY'
    | 'COMPUTE_USAGE'
    | 'AI_INFERENCE_USAGE'
    | 'MANUFACTURING_OUTPUT'
    | 'MANUFACTURING_CAPACITY'
    | 'REFERENCE_PRICE';
  readonly unit: 'kWh' | 'MWh' | 'gpu_s' | 'token_inference' | 'units_produced' | 'machine_h';
}) {
  return {
    schemaVersion: 1 as const,
    sourceId: input.sourceId,
    version: 1,
    providerId: `oracle_${input.sourceId}`,
    category: input.category,
    factType: input.factType,
    feedId: `feed_${input.sourceId}`,
    unit: input.unit,
    schemaId: 'schema.sim.v1',
    sourceSchemaVersion: 1,
    normalizationVersion: 'oracle.normalize.v1',
    authenticationMethod: 'FILE_FIXTURE_TEST_ONLY' as const,
    credentialRef: null,
    controllerId: 'ctl.sim',
    upstreamOrganizationId: 'org.sim',
    infrastructureRegion: 'sim-lab',
    retired: false,
  };
}

describe('CHUNK-117 MoonRey source fact claim compatibility', () => {
  it('1. accepts a valid energy path', () => {
    const result = validateSourceFactClaimMapping({
      sourceCategory: 'energy',
      factType: 'ENERGY_PRODUCTION',
      sourceUnit: 'kWh',
      productiveCategory: 'ENERGY',
      claimType: 'OUTPUT',
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.status, 'COMPATIBLE');
      assert.equal(result.value.mapping.productiveCategory, 'ENERGY');
    }
  });

  it('2. rejects an energy source with a service-delivery fact', () => {
    const result = validateSourceFactClaimMapping({
      sourceCategory: 'energy',
      factType: 'SERVICE_DELIVERY',
      sourceUnit: 'kWh',
      productiveCategory: 'ENERGY',
      claimType: 'OUTPUT',
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'FACT_NOT_ALLOWED_FOR_SOURCE');
    }
  });

  it('3. accepts a valid AI compute path', () => {
    const result = validateSourceFactClaimMapping({
      sourceCategory: 'ai_usage',
      factType: 'AI_INFERENCE_USAGE',
      sourceUnit: 'token_inference',
      productiveCategory: 'AI_COMPUTE',
      claimType: 'USAGE',
    });
    assert.equal(result.ok, true);
    const built = buildProductiveClaimCandidate(
      pathBuildInput({
        objectId: 'obj.ai.cluster',
        category: 'AI_COMPUTE',
        mappingId: 'spm.ai_usage.AI_INFERENCE_USAGE.AI_COMPUTE',
        sourceCategory: 'ai_usage',
        factType: 'AI_INFERENCE_USAGE',
        unit: 'token_inference',
        claimType: 'USAGE',
        unitSchema: 'TOKEN',
      }),
    );
    assert.equal(built.ok, true);
  });

  it('4. accepts a valid infrastructure path', () => {
    const result = validateSourceFactClaimMapping({
      sourceCategory: 'manufacturing',
      factType: 'MANUFACTURING_CAPACITY',
      sourceUnit: 'machine_h',
      productiveCategory: 'INFRASTRUCTURE',
      claimType: 'CAPACITY',
    });
    assert.equal(result.ok, true);
    const built = buildProductiveClaimCandidate(
      pathBuildInput({
        objectId: 'obj.infra.hub',
        category: 'INFRASTRUCTURE',
        mappingId: 'spm.manufacturing.MANUFACTURING_CAPACITY.INFRASTRUCTURE',
        sourceCategory: 'manufacturing',
        factType: 'MANUFACTURING_CAPACITY',
        unit: 'machine_h',
        claimType: 'CAPACITY',
        unitSchema: 'facility_hour',
      }),
    );
    assert.equal(built.ok, true);
  });

  it('5. accepts a valid goods path', () => {
    const result = validateSourceFactClaimMapping({
      sourceCategory: 'manufacturing',
      factType: 'MANUFACTURING_OUTPUT',
      sourceUnit: 'units_produced',
      productiveCategory: 'GOODS',
      claimType: 'OUTPUT',
    });
    assert.equal(result.ok, true);
    const built = buildProductiveClaimCandidate(
      pathBuildInput({
        objectId: 'obj.goods.batch',
        category: 'GOODS',
        mappingId: 'spm.manufacturing.MANUFACTURING_OUTPUT.GOODS',
        sourceCategory: 'manufacturing',
        factType: 'MANUFACTURING_OUTPUT',
        unit: 'units_produced',
        claimType: 'OUTPUT',
        unitSchema: 'UNIT',
      }),
    );
    assert.equal(built.ok, true);
  });

  it('6. accepts a valid automated machine path', () => {
    const result = validateSourceFactClaimMapping({
      sourceCategory: 'manufacturing',
      factType: 'MANUFACTURING_OUTPUT',
      sourceUnit: 'units_produced',
      productiveCategory: 'AUTOMATED_MACHINE_OUTPUT',
      claimType: 'OUTPUT',
    });
    assert.equal(result.ok, true);
    const built = buildProductiveClaimCandidate(
      pathBuildInput({
        objectId: 'obj.auto.cell',
        category: 'AUTOMATED_MACHINE_OUTPUT',
        mappingId: 'spm.manufacturing.MANUFACTURING_OUTPUT.AUTOMATED_MACHINE_OUTPUT',
        sourceCategory: 'manufacturing',
        factType: 'MANUFACTURING_OUTPUT',
        unit: 'units_produced',
        claimType: 'OUTPUT',
        unitSchema: 'UNIT',
      }),
    );
    assert.equal(built.ok, true);
  });

  it('7. refuses a reference price as a productive claim', () => {
    const reference = validateSourceFactClaimMapping({
      sourceCategory: 'reference_price',
      factType: 'REFERENCE_PRICE',
      sourceUnit: 'units_produced',
    });
    assert.equal(reference.ok, true);
    const claimed = validateSourceFactClaimMapping({
      sourceCategory: 'reference_price',
      factType: 'REFERENCE_PRICE',
      sourceUnit: 'units_produced',
      productiveCategory: 'ENERGY',
      claimType: 'OUTPUT',
    });
    assert.equal(claimed.ok, false);
    if (!claimed.ok) {
      assert.equal(claimed.error.code, 'REFERENCE_DATA_CANNOT_CREATE_CLAIM');
    }
    const sources = new EconomicDataSourceRegistry();
    const registered = sources.register(
      fixtureSource({
        sourceId: 'src.ref.price',
        category: 'reference_price',
        factType: 'REFERENCE_PRICE',
        unit: 'units_produced',
      }),
    );
    assert.equal(registered.ok, true);
  });

  it('8. rejects a wrong source unit', () => {
    const result = validateSourceFactClaimMapping({
      sourceCategory: 'energy',
      factType: 'ENERGY_PRODUCTION',
      sourceUnit: 'token_inference',
      productiveCategory: 'ENERGY',
      claimType: 'OUTPUT',
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'SOURCE_UNIT_NOT_ALLOWED');
    }
  });

  it('9. rejects a wrong claim type', () => {
    const result = validateSourceFactClaimMapping({
      sourceCategory: 'energy',
      factType: 'ENERGY_CAPACITY',
      sourceUnit: 'kWh',
      productiveCategory: 'ENERGY',
      claimType: 'OUTPUT',
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'CLAIM_TYPE_NOT_ALLOWED');
    }
    const object = fixtureObject({ objectId: 'obj.solar.capacity', category: 'ENERGY', unitSchema: 'kWh' });
    const gated = gateMappedClaimSubmission({
      claim: {
        schemaVersion: 1,
        claimId: 'claim.wrong.type',
        objectId: object.objectId,
        claimType: 'OUTPUT',
        category: 'ENERGY',
        quantity: 10n,
        unit: 'kWh',
        measurementPeriod: { validFromUnixSeconds: 1n, validUntilUnixSeconds: 2n, epoch: 1 },
        geography: object.geography,
        oracleFactIds: ['fact.1'],
        rightsReferences: [object.rightsReference],
        controller: object.controller,
        proofReferences: [],
        status: 'SUBMITTED',
        upstreamContributionIds: [],
      },
      object,
      sourceCategory: 'energy',
      factType: 'ENERGY_CAPACITY',
      sourceUnit: 'kWh',
    });
    assert.equal(gated.ok, false);
    if (!gated.ok) {
      assert.equal(gated.error.code, 'CLAIM_TYPE_NOT_ALLOWED');
    }
  });

  it('10. rejects a wrong productive object category', () => {
    const object = fixtureObject({ objectId: 'obj.service.desk', category: 'SERVICES', unitSchema: 'service_hour' });
    const built = buildProductiveClaimCandidate(
      energyBuildInput({
        object,
        subject: object.objectId,
      }),
    );
    assert.equal(built.ok, false);
    if (!built.ok) {
      assert.equal(built.error.code, 'FACT_NOT_ALLOWED_FOR_PRODUCTIVE_CATEGORY');
    }
  });

  it('11. rejects a wrong object identity', () => {
    const built = buildProductiveClaimCandidate(
      energyBuildInput({
        subject: 'obj.solar.bravo',
      }),
    );
    assert.equal(built.ok, false);
    if (!built.ok) {
      assert.equal(built.error.code, 'PRODUCTIVE_OBJECT_REQUIRED');
    }
  });

  it('12. rejects a geography mismatch', () => {
    const built = buildProductiveClaimCandidate(
      energyBuildInput({
        geography: { geographyId: 'geo.other', jurisdiction: 'OTHER' },
      }),
    );
    assert.equal(built.ok, false);
    if (!built.ok) {
      assert.equal(built.error.code, 'GEOGRAPHY_REQUIRED');
    }
  });

  it('13. rejects a stale fact', () => {
    const built = buildProductiveClaimCandidate(
      energyBuildInput({
        qualityStatus: 'STALE',
      }),
    );
    assert.equal(built.ok, false);
    if (!built.ok) {
      assert.equal(built.error.code, 'VERIFIED_FACT_REQUIRED');
      assert.match(built.error.detail, /stale/);
    }
    const expired = buildProductiveClaimCandidate(
      energyBuildInput({
        nowUnix: 1_900_000_000n,
      }),
    );
    assert.equal(expired.ok, false);
    if (!expired.ok) {
      assert.match(expired.error.detail, /stale/);
    }
  });

  it('14. rejects a conflicted fact', () => {
    const built = buildProductiveClaimCandidate(
      energyBuildInput({
        qualityStatus: 'CONFLICTED',
      }),
    );
    assert.equal(built.ok, false);
    if (!built.ok) {
      assert.equal(built.error.code, 'VERIFIED_FACT_REQUIRED');
      assert.match(built.error.detail, /conflicted/);
    }
  });

  it('15. rejects an unverified fact', () => {
    const built = buildProductiveClaimCandidate(
      energyBuildInput({
        qualityStatus: 'PENDING',
      }),
    );
    assert.equal(built.ok, false);
    if (!built.ok) {
      assert.equal(built.error.code, 'VERIFIED_FACT_REQUIRED');
      assert.match(built.error.detail, /unverified/);
    }
  });

  it('16. creates a candidate from a valid finalized fact', () => {
    const builder = new ProductiveClaimCandidateBuilder();
    const built = builder.build(energyBuildInput());
    assert.equal(built.ok, true);
    if (built.ok) {
      assert.equal(built.value.objectId, 'obj.solar.alpha');
      assert.equal(built.value.proposedClaimType, 'OUTPUT');
      assert.equal(built.value.sourceUnit, 'kWh');
      assert.equal(built.value.automaticIssuance, false);
    }
  });

  it('17. does not auto-verify a candidate', () => {
    const built = buildProductiveClaimCandidate(energyBuildInput());
    assert.equal(built.ok, true);
    if (built.ok) {
      assert.equal(built.value.verified, false);
      assert.equal(candidateCannotVerify(built.value), false);
    }
  });

  it('18. does not auto-issue a candidate', () => {
    const built = buildProductiveClaimCandidate(energyBuildInput());
    assert.equal(built.ok, true);
    if (built.ok) {
      assert.equal(built.value.issued, false);
      assert.equal(built.value.automaticIssuance, false);
      assert.equal(candidateCannotIssue(built.value), false);
    }
  });

  it('19. retains the mapping version on the candidate', () => {
    const built = buildProductiveClaimCandidate(energyBuildInput());
    assert.equal(built.ok, true);
    if (built.ok) {
      const version = mappingVersionOf(built.value);
      assert.equal(version.mappingId, 'spm.energy.ENERGY_PRODUCTION.ENERGY');
      assert.equal(version.mappingVersion, 2);
    }
  });

  it('20. refuses a superseded mapping for new claims', () => {
    const built = buildProductiveClaimCandidate(
      energyBuildInput({
        mapping: HISTORICAL_ENERGY_PRODUCTION_MAPPING,
      }),
    );
    assert.equal(built.ok, false);
    if (!built.ok) {
      assert.equal(built.error.code, 'MAPPING_SUPERSEDED');
    }
    const validated = validateSourceFactClaimMapping({
      sourceCategory: 'energy',
      factType: 'ENERGY_PRODUCTION',
      sourceUnit: 'kWh',
      productiveCategory: 'ENERGY',
      claimType: 'OUTPUT',
      mappingId: 'spm.energy.ENERGY_PRODUCTION.ENERGY',
      mappingVersion: 1,
    });
    assert.equal(validated.ok, false);
    if (!validated.ok) {
      assert.equal(validated.error.code, 'MAPPING_SUPERSEDED');
    }
  });

  it('21. reports no productive-category coverage gaps', () => {
    const report = moonreySourceCoverageReport();
    assert.equal(allProductiveCategoriesMapped(), true);
    assert.deepEqual(report.unmappedProductiveCategories, []);
    assert.equal(report.coveragePercent, 100);
    assert.equal(report.invalidMappings.length, 0);
    assert.ok(report.referenceOnlyMappings.length >= 1);
  });

  it('22. flags attribution-risk routes without pretending the policy is complete', () => {
    const result = validateSourceFactClaimMapping({
      sourceCategory: 'manufacturing',
      factType: 'MANUFACTURING_OUTPUT',
      sourceUnit: 'units_produced',
      productiveCategory: 'GOODS',
      claimType: 'OUTPUT',
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.attributionState, 'ATTRIBUTION_REVIEW_REQUIRED');
      assert.equal(result.value.mapping.requiresAttributionPolicy, true);
    }
    const built = buildProductiveClaimCandidate(
      pathBuildInput({
        objectId: 'obj.goods.attr',
        category: 'GOODS',
        mappingId: 'spm.manufacturing.MANUFACTURING_OUTPUT.GOODS',
        sourceCategory: 'manufacturing',
        factType: 'MANUFACTURING_OUTPUT',
        unit: 'units_produced',
        claimType: 'OUTPUT',
        unitSchema: 'UNIT',
      }),
    );
    assert.equal(built.ok, true);
    if (built.ok) {
      assert.equal(built.value.attributionState, 'ATTRIBUTION_REVIEW_REQUIRED');
    }
    const required = buildProductiveClaimCandidate({
      ...pathBuildInput({
        objectId: 'obj.goods.policy',
        category: 'GOODS',
        mappingId: 'spm.manufacturing.MANUFACTURING_OUTPUT.GOODS',
        sourceCategory: 'manufacturing',
        factType: 'MANUFACTURING_OUTPUT',
        unit: 'units_produced',
        claimType: 'OUTPUT',
        unitSchema: 'UNIT',
      }),
      requireApprovedAttributionPolicy: true,
    });
    assert.equal(required.ok, false);
    if (!required.ok) {
      assert.equal(required.error.code, 'ATTRIBUTION_POLICY_REQUIRED');
    }
  });

  it('23. keeps a historical mapping reproducible after supersession', () => {
    const historical = historicalMapping('spm.energy.ENERGY_PRODUCTION.ENERGY', 1);
    assert.ok(historical);
    assert.equal(historical?.status, 'SUPERSEDED');
    assert.equal(historical?.mappingVersion, 1);
    assert.equal(historical?.allowedClaimTypes[0], 'OUTPUT');
    const current = mappingById('spm.energy.ENERGY_PRODUCTION.ENERGY', 2);
    assert.equal(current?.status, 'ACTIVE');
    assert.equal(current?.mappingVersion, 2);
    assert.notEqual(historical?.mappingVersion, current?.mappingVersion);
  });

  it('rejects unknown and retired source categories', () => {
    const unknown = validateSourceFactClaimMapping({
      sourceCategory: 'astrology',
      factType: 'ENERGY_PRODUCTION',
      sourceUnit: 'kWh',
    });
    assert.equal(unknown.ok, false);
    if (!unknown.ok) {
      assert.equal(unknown.error.code, 'SOURCE_CATEGORY_UNKNOWN');
    }
    const retired = validateSourceFactClaimMapping(
      {
        sourceCategory: 'energy',
        factType: 'ENERGY_PRODUCTION',
        sourceUnit: 'kWh',
      },
      registryWithRetiredCategory('energy'),
    );
    assert.equal(retired.ok, false);
    if (!retired.ok) {
      assert.equal(retired.error.code, 'SOURCE_CATEGORY_RETIRED');
    }
  });

  it('rejects a mapping version mismatch', () => {
    const result = validateSourceFactClaimMapping({
      sourceCategory: 'energy',
      factType: 'ENERGY_PRODUCTION',
      sourceUnit: 'kWh',
      mappingId: 'spm.energy.ENERGY_PRODUCTION.ENERGY',
      mappingVersion: 99,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'MAPPING_VERSION_MISMATCH');
    }
  });

  it('adds mapping validation as an extra source and feed filter', () => {
    const sources = new EconomicDataSourceRegistry();
    const valid = sources.register(
      fixtureSource({
        sourceId: 'src.energy.valid',
        category: 'energy',
        factType: 'ENERGY_PRODUCTION',
        unit: 'kWh',
      }),
    );
    assert.equal(valid.ok, true);
    const invalid = sources.register(
      fixtureSource({
        sourceId: 'src.energy.service',
        category: 'energy',
        factType: 'SERVICE_DELIVERY',
        unit: 'kWh',
      }),
    );
    assert.equal(invalid.ok, false);
    if (!invalid.ok) {
      assert.equal(invalid.error.code, 'FACT_NOT_ALLOWED_FOR_SOURCE');
    }
    const feed = developmentProductionFeed();
    const feedOk = validateSourceFactClaimMapping({
      sourceCategory: 'energy',
      factType: feed.factType,
      sourceUnit: feed.measurementUnit,
    });
    assert.equal(feedOk.ok, true);
  });

  it('does not let a verified fact or candidate mint MoonRey', () => {
    const built = buildProductiveClaimCandidate(energyBuildInput());
    assert.equal(built.ok, true);
    if (!built.ok) {
      throw new Error(built.error.detail);
    }
    const object = fixtureObject({ objectId: built.value.objectId, category: 'ENERGY', unitSchema: 'kWh' });
    const engine = new ProductiveEconomyEngine({
      height: 10,
      blockTimeUnixSeconds: CANDIDATE_NOW,
      blockId: 'blk_compat_test',
    });
    engine.registerObject(object);
    engine.putRight(fixtureRight({ rightId: object.rightsReference, objectId: object.objectId, holderId: object.controller }));
    for (const fact of fixtureFacts({
      objectId: object.objectId,
      category: 'ENERGY',
      quantity: built.value.quantity,
      unit: 'kWh',
      quality: WEIGHT_SCALE,
    })) {
      engine.putOracleFact(fact);
    }
    const claim = claimFromCandidate(built.value, 'claim.compat.energy', object.controller);
    engine.submitClaim({
      ...claim,
      oracleFactIds: fixtureFacts({
        objectId: object.objectId,
        category: 'ENERGY',
        quantity: built.value.quantity,
        unit: 'kWh',
      }).map((row) => row.factId),
    });
    const verified = engine.verifyClaim('claim.compat.energy');
    assert.equal(verified.ok, true);
    assert.equal(engine.snapshot().receipts.length, 0);
    assert.equal(built.value.automaticIssuance, false);
  });

  it('can record optional economic-asset-registry lineage without minting', () => {
    const built = buildProductiveClaimCandidate(energyBuildInput());
    assert.equal(built.ok, true);
    if (!built.ok) {
      throw new Error(built.error.detail);
    }
    assert.equal(recordCompatibilityLineage(null, built.value), null);
    const registry = new EconomicAssetRegistry();
    const lineage = recordCompatibilityLineage(registry, built.value);
    assert.ok(lineage);
    const withContribution = attachVerifiedContributionLineage(registry, lineage!, 'vpc.sim');
    assert.ok(withContribution.verifiedProductiveContributionId);
    assert.equal(registryDoesNotAuthorizeMint(registry, lineage!.oracleSourceDatasetId), false);
    assert.equal(registryDoesNotAuthorizeMint(registry, withContribution.verifiedProductiveContributionId!), false);
    assert.equal(registry.get(lineage!.verifiedEconomicFactId)?.assetClass, 'VERIFIED_ECONOMIC_FACT');
    assert.equal(registry.get(lineage!.productiveClaimId)?.assetClass, 'PRODUCTIVE_CLAIM');
    assert.equal(registry.get(lineage!.oracleObservationSetId)?.assetClass, 'ORACLE_OBSERVATION_SET');
  });

  it('runs the source-claim path demo without production activation', () => {
    const report = runMoonReySourceClaimPathDemo();
    assert.equal(report.PRODUCTIVE_CATEGORY_GAPS, 0);
    assert.equal(report.VERIFIED_FACT_ALONE_CAN_MINT, false);
    assert.equal(report.CLAIM_CANDIDATE_ALONE_CAN_MINT, false);
    assert.equal(report.ATTRIBUTION_POLICY_COMPLETE, false);
    assert.equal(report.PRODUCTION_ACTIVE, false);
    assert.equal(report.validPath, 'COMPATIBLE');
    assert.equal(report.invalidPathCode, 'FACT_NOT_ALLOWED_FOR_SOURCE');
  });

  it('keeps the canonical taxonomy frozen and versioned', () => {
    assert.equal(CANONICAL_SOURCE_TAXONOMY.taxonomyId, 'moonrey.source-productive-mapping.v1');
    assert.ok(requireMapping('spm.energy.ENERGY_PRODUCTION.ENERGY', 2).requiresGeography);
    assert.equal(requireMapping('spm.reference_price.REFERENCE_PRICE.REFERENCE').referenceDataOnly, true);
  });
});

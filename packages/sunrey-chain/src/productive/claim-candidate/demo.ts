import { EconomicDataSourceRegistry } from '../../oracle/production/sources.ts';
import { developmentProductionFeed } from '../../oracle/production/plane.ts';
import {
  attributionPolicyComplete,
  claimCandidateAloneCanMint,
  enforceFeedDefinitionMapping,
  moonreySourceCoverageReport,
  productionActive,
  validateSourceFactClaimMapping,
  verifiedFactAloneCanMint,
} from '../../oracle/source-taxonomy/index.ts';
import { ProductiveEconomyEngine } from '../engine.ts';
import { fixtureFacts } from '../fixtures.ts';
import { WEIGHT_SCALE } from '../types.ts';
import { ProductiveClaimCandidateBuilder } from './builder.ts';
import { claimFromCandidate } from './claim-gate.ts';
import { energyBuildInput, fixtureObject, fixtureRight } from './fixtures.ts';

export type MoonReySourceClaimPathReport = {
  readonly validPath: 'COMPATIBLE';
  readonly invalidPathCode: string;
  readonly candidateVerified: false;
  readonly candidateIssued: false;
  readonly automaticIssuance: false;
  readonly contributionId: string | null;
  readonly PRODUCTIVE_CATEGORY_GAPS: number;
  readonly VERIFIED_FACT_ALONE_CAN_MINT: false;
  readonly CLAIM_CANDIDATE_ALONE_CAN_MINT: false;
  readonly ATTRIBUTION_POLICY_COMPLETE: false;
  readonly PRODUCTION_ACTIVE: false;
};

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { detail: string } }): T {
  if (!result.ok) {
    throw new Error(result.error.detail);
  }
  return result.value;
}

export function runMoonReySourceClaimPathDemo(): MoonReySourceClaimPathReport {
  const sources = new EconomicDataSourceRegistry();
  const feed = developmentProductionFeed();
  unwrap(enforceFeedDefinitionMapping(feed, 'energy'));
  unwrap(
    sources.register({
      schemaVersion: 1,
      sourceId: 'src.energy.demo',
      version: 1,
      providerId: 'oracle_energy_demo',
      category: 'energy',
      factType: 'ENERGY_PRODUCTION',
      feedId: feed.feedId,
      unit: 'kWh',
      schemaId: 'energy.resource.v1',
      sourceSchemaVersion: 1,
      normalizationVersion: 'oracle.normalize.v1',
      authenticationMethod: 'FILE_FIXTURE_TEST_ONLY',
      credentialRef: null,
      controllerId: 'ctl.energy.demo',
      upstreamOrganizationId: 'org.energy.demo',
      infrastructureRegion: 'sim-lab',
      retired: false,
    }),
  );

  const mapped = unwrap(
    validateSourceFactClaimMapping({
      sourceCategory: 'energy',
      factType: 'ENERGY_PRODUCTION',
      sourceUnit: 'kWh',
      productiveCategory: 'ENERGY',
      claimType: 'OUTPUT',
    }),
  );

  const builder = new ProductiveClaimCandidateBuilder();
  const built = unwrap(builder.build(energyBuildInput({ mapping: mapped.mapping })));
  if (built.automaticIssuance !== false || built.verified !== false || built.issued !== false) {
    throw new Error('claim candidate must not auto-verify or auto-issue');
  }

  const object = fixtureObject({ objectId: built.objectId, category: 'ENERGY', unitSchema: 'kWh' });
  const engine = new ProductiveEconomyEngine({
    height: 10,
    blockTimeUnixSeconds: 1_800_000_000n,
    blockId: 'blk_source_claim_demo',
  });
  engine.registerObject(object);
  engine.putRight(fixtureRight({ rightId: object.rightsReference, objectId: object.objectId, holderId: object.controller }));
  for (const fact of fixtureFacts({
    objectId: object.objectId,
    category: 'ENERGY',
    quantity: built.quantity,
    unit: 'kWh',
    quality: WEIGHT_SCALE,
  })) {
    engine.putOracleFact(fact);
  }
  const claim = claimFromCandidate(built, 'claim.solar.output.demo', object.controller);
  engine.submitClaim({
    ...claim,
    oracleFactIds: fixtureFacts({
      objectId: object.objectId,
      category: 'ENERGY',
      quantity: built.quantity,
      unit: 'kWh',
    }).map((fact) => fact.factId),
  });
  const verified = engine.verifyClaim('claim.solar.output.demo');
  if (!verified.ok) {
    throw new Error(`valid mapped claim failed verification: ${verified.code}`);
  }

  const refused = validateSourceFactClaimMapping({
    sourceCategory: 'energy',
    factType: 'SERVICE_DELIVERY',
    sourceUnit: 'kWh',
    productiveCategory: 'ENERGY',
    claimType: 'OUTPUT',
  });
  if (refused.ok) {
    throw new Error('energy + SERVICE_DELIVERY must be refused');
  }

  const coverage = moonreySourceCoverageReport();
  const report: MoonReySourceClaimPathReport = Object.freeze({
    validPath: 'COMPATIBLE',
    invalidPathCode: refused.error.code,
    candidateVerified: false,
    candidateIssued: false,
    automaticIssuance: false,
    contributionId: verified.contribution.contributionId,
    PRODUCTIVE_CATEGORY_GAPS: coverage.unmappedProductiveCategories.length,
    VERIFIED_FACT_ALONE_CAN_MINT: verifiedFactAloneCanMint(),
    CLAIM_CANDIDATE_ALONE_CAN_MINT: claimCandidateAloneCanMint(),
    ATTRIBUTION_POLICY_COMPLETE: attributionPolicyComplete(),
    PRODUCTION_ACTIVE: productionActive(),
  });

  console.log('MoonRey source / fact / claim compatibility — Chunk 117');
  console.log(`valid energy path=${report.validPath}`);
  console.log(`invalid energy/service fact=${report.invalidPathCode}`);
  console.log(`candidate.mappingId=${built.mappingId}`);
  console.log(`candidate.mappingVersion=${built.mappingVersion}`);
  console.log(`candidate.automaticIssuance=${String(built.automaticIssuance)}`);
  console.log(`verifiedContribution=${report.contributionId}`);
  console.log(`PRODUCTIVE_CATEGORY_GAPS=${report.PRODUCTIVE_CATEGORY_GAPS}`);
  console.log(`VERIFIED_FACT_ALONE_CAN_MINT=${String(report.VERIFIED_FACT_ALONE_CAN_MINT)}`);
  console.log(`CLAIM_CANDIDATE_ALONE_CAN_MINT=${String(report.CLAIM_CANDIDATE_ALONE_CAN_MINT)}`);
  console.log(`ATTRIBUTION_POLICY_COMPLETE=${String(report.ATTRIBUTION_POLICY_COMPLETE)}`);
  console.log(`PRODUCTION_ACTIVE=${String(report.PRODUCTION_ACTIVE)}`);
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMoonReySourceClaimPathDemo();
}

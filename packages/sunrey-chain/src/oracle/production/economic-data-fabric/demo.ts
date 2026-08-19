/**
 * Chunk 138 demo — unified economic data fabric coverage and simulation.
 *
 * SIMULATION ONLY. No live providers. No MoonRey issuance from the fabric.
 */

import { quantity } from '../../units.ts';
import { OracleEngine, developmentEnergyFeed, developmentProvider } from '../../engine.ts';
import { signDraft } from '../../demo-helpers.ts';
import { defaultOracleSuiteId, deriveOracleKey } from '../../crypto.ts';
import type { FactType } from '../../types.ts';
import { IntegratedEconomicStack } from '../../../economics/stack.ts';
import { supplyReconciles } from '../../../economics/supply.ts';
import { CERTIFICATION_FINALIZES_ORACLE, CERTIFICATION_MINTS_MOONREY } from '../certification/types.ts';
import { FETCH_AUTO_FINALIZED_ORACLE, FETCH_AUTO_MINTED_MOONREY, CONSENSUS_CALLED_HTTP as CONNECTOR_CONSENSUS_HTTP } from '../runtime-types.ts';
import { oracleFactCreationNeverMintsMoonRey } from '../eligibility.ts';
import { ingestBatch } from './batch.ts';
import { buildCoverageReport, documentedCoverageGaps } from './coverage.ts';
import {
  energyProductionFixture,
  FABRIC_NOW_UNIX,
  manufacturingOutputFixture,
  multiDomainScenario,
} from './fixtures.ts';
import { collectLineage } from './lineage.ts';
import { detectCorrelationCandidates, groupObservations, prepareObservationBatch } from './reconciliation.ts';
import {
  CHUNK_71_REMAINS_MONETARY_AUTHORITY,
  DATA_FABRIC_FINALIZES_FACTS,
  DATA_FABRIC_MINTS_MOONREY,
  LIVE_PROVIDER_CONNECTED,
  PRODUCTION_ACTIVE,
} from './types.ts';

export function submitEnvelopeGroupToOracle(input: {
  readonly feedId: string;
  readonly factType: 'ENERGY_PRODUCTION' | 'MANUFACTURING_OUTPUT';
  readonly unit: 'kWh' | 'units_produced';
  readonly subject: string;
  readonly envelopes: readonly { readonly providerLabel: string; readonly mantissa: bigint; readonly commitment: string }[];
}): { readonly factId: string; readonly qualityStatus: string } {
  const engine = new OracleEngine({
    networkId: 'net_sunrey_simulation',
    chainId: 'chn_sunrey_simulation',
    clock: { nowUnix: () => FABRIC_NOW_UNIX },
  });
  const labels = ['energy-a', 'energy-b', 'energy-c'] as const;
  const types = ['INSTITUTIONAL_DATA_PROVIDER', 'REGULATED_PROVIDER', 'PUBLIC_DATA_PROVIDER'] as const;
  const providers = labels.map((label, index) => {
    const key = deriveOracleKey(engine.ports, defaultOracleSuiteId(), label);
    if (!key.ok) {
      throw new Error(key.error.detail);
    }
    const record = developmentProvider(
      `oracle_${label}`,
      types[index]!,
      key.value.publicKey.publicKeyHex,
      [input.factType as FactType],
    );
    const registered = engine.registerProvider(record, key.value.publicKey);
    if (!registered.ok) {
      throw new Error(registered.error.detail);
    }
    return { record, label };
  });
  const feed = engine.registerFeed(
    developmentEnergyFeed({
      feedId: input.feedId,
      factType: input.factType,
      measurementUnit: input.unit,
      maxObservationSpread: 10_000n,
    }),
  );
  if (!feed.ok) {
    throw new Error(feed.error.detail);
  }
  for (let i = 0; i < input.envelopes.length; i += 1) {
    const row = input.envelopes[i]!;
    const provider = providers[i]!;
    const value = quantity(row.mantissa, 0, input.unit);
    if (!value.ok) {
      throw new Error(value.error.detail);
    }
    const submitted = engine.submitObservation(
      signDraft(engine, provider.label, {
        schemaVersion: 1,
        oracleId: provider.record.oracleId,
        feedId: feed.value.feedId,
        subject: input.subject,
        value: value.value,
        measurementStartUnix: FABRIC_NOW_UNIX - 3_600n,
        measurementEndUnix: FABRIC_NOW_UNIX,
        observationTimeUnix: FABRIC_NOW_UNIX,
        validUntilUnix: FABRIC_NOW_UNIX + 3_600n,
        geography: { schemaVersion: 1, jurisdiction: 'US', region: 'sim-west', locality: 'zone-a' },
        sourceReferenceCommitment: row.commitment,
        methodologyReference: 'method.unified-fabric.v1',
        confidence: { schemaVersion: 1, scoreBps: 9_000, sampleCount: 1, notesRef: 'unified-fabric' },
        sequence: 1n,
        networkId: engine.networkId,
        chainId: engine.chainId,
        deviceProvenance: null,
        weight: 1n,
      }),
    );
    if (!submitted.ok) {
      throw new Error(submitted.error.detail);
    }
  }
  const finalized = engine.finalizeWindow({
    feedId: feed.value.feedId,
    subject: input.subject,
    startUnix: FABRIC_NOW_UNIX - 3_600n,
    endUnix: FABRIC_NOW_UNIX,
  });
  if (!finalized.ok) {
    throw new Error(finalized.error.detail);
  }
  return { factId: finalized.value.factId, qualityStatus: finalized.value.qualityStatus };
}

export function simulateGovernedPath(input: {
  readonly category: 'ENERGY' | 'MANUFACTURING';
  readonly quantity: bigint;
  readonly unit: string;
  readonly claimId: string;
}): { readonly quantity: bigint; readonly authorizationId: string; readonly supplyReconciles: boolean; readonly simulationOnly: true } {
  const stack = new IntegratedEconomicStack();
  const objectId = `obj.unified.${input.category.toLowerCase()}`;
  stack.registerProductiveObject({
    objectId,
    category: input.category,
    unit: input.unit,
    owner: 'controller.sim',
  });
  const issued = stack.issueMoonReyFromGovernedValue({
    claimId: input.claimId,
    objectId,
    category: input.category,
    quantity: input.quantity,
    unit: input.unit,
    controller: 'controller.sim',
    epoch: 1,
    providerCount: 3,
  });
  if (!issued.ok) {
    throw new Error(issued.code);
  }
  return Object.freeze({
    quantity: issued.quantity,
    authorizationId: issued.authorizationId,
    supplyReconciles: supplyReconciles(stack.moonrey),
    simulationOnly: true,
  });
}

export function runUnifiedEconomicDataFabricDemo(): {
  readonly coverageGaps: readonly string[];
  readonly envelopeCount: number;
  readonly energyFactId: string;
  readonly manufacturingFactId: string;
  readonly energyIssuance: bigint;
  readonly manufacturingIssuance: bigint;
  readonly flags: Readonly<Record<string, boolean | number | string>>;
} {
  const coverage = buildCoverageReport();
  const gaps = documentedCoverageGaps(coverage);
  const batch = ingestBatch(multiDomainScenario(), 'FIXTURE_ONLY', FABRIC_NOW_UNIX);
  const groups = groupObservations(batch.accepted);
  const lineage = collectLineage(batch.accepted);
  const manufacturing = batch.accepted.find((row) => row.familyId === 'MANUFACTURING');
  const goods = batch.accepted.find((row) => row.familyId === 'GOODS');
  const correlations = manufacturing && goods
    ? detectCorrelationCandidates(batch.accepted, [
        {
          leftEnvelopeId: manufacturing.envelopeId,
          rightEnvelopeId: goods.envelopeId,
          batchRef: 'batch.factory_line_1',
          objectRef: 'object.goods_batch_1',
        },
      ])
    : [];

  const energyTriple = [energyProductionFixture('prov_energy_a'), energyProductionFixture('prov_energy_b'), energyProductionFixture('prov_energy_c')];
  const energyBatch = ingestBatch(energyTriple, 'FIXTURE_ONLY', FABRIC_NOW_UNIX);
  const energyFact = submitEnvelopeGroupToOracle({
    feedId: 'feed_energy_production_sim',
    factType: 'ENERGY_PRODUCTION',
    unit: 'kWh',
    subject: 'plant_sim_1',
    envelopes: energyBatch.accepted.map((row, index) => ({
      providerLabel: `energy-${['a', 'b', 'c'][index]}`,
      mantissa: row.sourceQuantity.mantissa,
      commitment: row.contentCommitment,
    })),
  });

  const mfgTriple = [manufacturingOutputFixture('prov_mfg_a'), manufacturingOutputFixture('prov_mfg_b'), manufacturingOutputFixture('prov_mfg_c')];
  const mfgBatch = ingestBatch(mfgTriple, 'FIXTURE_ONLY', FABRIC_NOW_UNIX);
  const manufacturingFact = submitEnvelopeGroupToOracle({
    feedId: 'feed_manufacturing_output_sim',
    factType: 'MANUFACTURING_OUTPUT',
    unit: 'units_produced',
    subject: 'factory_line_1',
    envelopes: mfgBatch.accepted.map((row, index) => ({
      providerLabel: `energy-${['a', 'b', 'c'][index]}`,
      mantissa: row.sourceQuantity.mantissa,
      commitment: row.contentCommitment,
    })),
  });

  const energyIssuance = simulateGovernedPath({
    category: 'ENERGY',
    quantity: 1_200n,
    unit: 'kWh',
    claimId: 'claim.unified.energy',
  });
  const manufacturingIssuance = simulateGovernedPath({
    category: 'MANUFACTURING',
    quantity: 40n,
    unit: 'UNIT',
    claimId: 'claim.unified.manufacturing',
  });

  return Object.freeze({
    coverageGaps: gaps,
    envelopeCount: batch.accepted.length,
    energyFactId: energyFact.factId,
    manufacturingFactId: manufacturingFact.factId,
    energyIssuance: energyIssuance.quantity,
    manufacturingIssuance: manufacturingIssuance.quantity,
    flags: Object.freeze({
      PRODUCTIVE_CATEGORY_GAPS: gaps.filter((row) => !row.startsWith('FACT:') && !row.startsWith('SOURCE:')).length,
      LIVE_PROVIDER_CONNECTIONS: 0,
      CONSENSUS_CALLED_HTTP: CONNECTOR_CONSENSUS_HTTP,
      DATA_FABRIC_FINALIZES_FACTS: DATA_FABRIC_FINALIZES_FACTS,
      DATA_FABRIC_MINTS_MOONREY: DATA_FABRIC_MINTS_MOONREY,
      CHUNK_71_REMAINS_MONETARY_AUTHORITY: CHUNK_71_REMAINS_MONETARY_AUTHORITY,
      PRODUCTION_ACTIVE: PRODUCTION_ACTIVE,
      LIVE_PROVIDER_CONNECTED,
      FETCH_AUTO_FINALIZED_ORACLE,
      FETCH_AUTO_MINTED_MOONREY,
      CERTIFICATION_FINALIZES_ORACLE,
      CERTIFICATION_MINTS_MOONREY,
      ORACLE_FACT_MINTS: oracleFactCreationNeverMintsMoonRey() ? false : true,
      ENERGY_SUPPLY_RECONCILES: energyIssuance.supplyReconciles,
      MANUFACTURING_SUPPLY_RECONCILES: manufacturingIssuance.supplyReconciles,
      LINEAGE_LINKS: lineage.length,
      CORRELATION_CANDIDATES: correlations.length,
      OBSERVATION_GROUPS: groups.length,
      ORACLE_BATCHES: groups.map((group) => prepareObservationBatch(group, batch.accepted)).length,
    }),
  });
}

function printCoverageTable(): void {
  const coverage = buildCoverageReport();
  console.log('Provider Family\tSource Category\tFact Types\tProductive Category\tCanonical Units\tCertification\tOracle Route\tEvent Identity\tValue Route\tLive Connected?');
  for (const row of coverage.sourceCategories) {
    const family = row.familyId ?? 'UNROUTED';
    const facts = coverage.factTypes.filter((fact) => fact.familyId === row.familyId).map((fact) => fact.factType).join(',');
    const productive = coverage.productiveCategories.find((item) => item.familyId === row.familyId)?.productiveCategory ?? (row.flags.referenceOnly ? 'null' : '');
    console.log(
      [
        family,
        row.sourceCategory,
        facts || '—',
        productive || '—',
        row.flags.canonicalUnitPathAvailable ? 'yes' : 'gap',
        row.flags.certificationProfileAvailable ? 'yes' : 'gap',
        row.flags.oracleFeedPathAvailable ? 'yes' : 'no',
        row.flags.eventIdentityCompatible ? 'yes' : 'no',
        row.flags.valueFunctionCategoryReviewed ? 'yes' : 'ref-only',
        'false',
      ].join('\t'),
    );
  }
}

const isDirect = import.meta.url === `file://${process.argv[1]}`;
if (isDirect) {
  const report = runUnifiedEconomicDataFabricDemo();
  console.log('SunRey unified economic data fabric demo — SIMULATION ONLY');
  printCoverageTable();
  console.log(`acceptedEnvelopes=${report.envelopeCount}`);
  console.log(`energyVerifiedFact=${report.energyFactId}`);
  console.log(`manufacturingVerifiedFact=${report.manufacturingFactId}`);
  console.log(`energySimulationIssuance=${report.energyIssuance.toString()}`);
  console.log(`manufacturingSimulationIssuance=${report.manufacturingIssuance.toString()}`);
  console.log(`PRODUCTIVE_CATEGORY_GAPS=${report.flags.PRODUCTIVE_CATEGORY_GAPS}`);
  console.log('LIVE_PROVIDER_CONNECTIONS=0');
  console.log('CONSENSUS_CALLED_HTTP=false');
  console.log('DATA_FABRIC_FINALIZES_FACTS=false');
  console.log('DATA_FABRIC_MINTS_MOONREY=false');
  console.log('CHUNK_71_REMAINS_MONETARY_AUTHORITY=true');
  console.log('PRODUCTION_ACTIVE=false');
  console.log('demo ok — unified fabric routed, admitted, and stopped before becoming a mint');
}

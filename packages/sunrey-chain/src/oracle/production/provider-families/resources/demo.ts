/**
 * Chunk 133 demo — minerals / extraction economic data fabric.
 *
 * Mine production + haul telemetry + weighbridge → one extraction event.
 * Extracted ore → processing → concentrate (lineage, not summed mass).
 * Reference commodity price remains a separate reference-only fact.
 *
 * No real providers. No production activation. No MoonRey mint.
 */

import { ingestResourceRecords, identifyExtractionEvents, linkExtractionToProcessing, evaluateResourceClaimPath } from './adapter.ts';
import { certifyResourceSandbox, resourceCertificationCannotAuthorizeMoonRey } from './certification.ts';
import {
  concentrateRecord,
  haulTelemetryRecord,
  mineProductionRecord,
  referencePriceRecord,
  simulationPolicy,
  weighbridgeRecord,
} from './fixtures.ts';
import {
  LEGAL_OWNERSHIP_INFERRED,
  REFERENCE_PRICE_CREATES_OUTPUT,
  RESERVE_EQUALS_EXTRACTION,
  RESOURCE_PRODUCTION_ACTIVE,
  RESOURCE_REAL_PROVIDER_CONTACTED,
  STOCKPILE_MOVEMENT_EQUALS_EXTRACTION,
  resourceFactCannotAutoMint,
} from './types.ts';

const NOW = 1_700_000_000n;

export function runResourceDataFabricDemo(): {
  readonly extractionEventCount: number;
  readonly concentrateLinked: boolean;
  readonly flags: Readonly<Record<string, boolean>>;
} {
  const policy = simulationPolicy();
  const ingested = ingestResourceRecords(
    [mineProductionRecord(NOW), haulTelemetryRecord(NOW), weighbridgeRecord(NOW), concentrateRecord(NOW)],
    NOW,
    policy,
  );
  if (!ingested.ok) {
    throw new Error(`${ingested.error.code}: ${ingested.error.detail}`);
  }
  const extractionObs = ingested.value.filter((row) => row.observation.createsExtractionEvent).map((row) => row.observation);
  const concentrateObs = ingested.value.find((row) => row.observation.measurementSemantics === 'PROCESSED_CONCENTRATE');
  const events = identifyExtractionEvents(extractionObs, NOW, NOW + 3_600n);
  if (!events.ok) {
    throw new Error(`${events.error.code}: ${events.error.detail}`);
  }
  if (!concentrateObs) {
    throw new Error('missing concentrate observation');
  }
  const lineage = linkExtractionToProcessing({
    extraction: extractionObs[0]!,
    concentrate: concentrateObs.observation,
  });
  if (!lineage.ok) {
    throw new Error(`${lineage.error.code}: ${lineage.error.detail}`);
  }
  const price = evaluateResourceClaimPath({
    factType: referencePriceRecord(NOW).factType,
    claimType: 'OUTPUT',
    sourceCategory: 'reference_price',
  });
  const certified = certifyResourceSandbox('valid_extracted_tonnage', NOW);
  console.log('CHUNK-133 minerals / extraction economic data fabric');
  console.log(`extraction_sensors=${extractionObs.length}`);
  console.log(`underlying_extraction_events=${events.value.length}`);
  console.log(`processing_lineage=${lineage.value.relation}`);
  console.log(`reference_price_claim_blocked=${!price.ok}`);
  console.log(`sandbox_certification_status=${certified.record.status}`);
  console.log(`sandbox_production_authorized=${certified.record.productionAuthorized}`);
  console.log(`RESERVE_EQUALS_EXTRACTION=${RESERVE_EQUALS_EXTRACTION}`);
  console.log(`STOCKPILE_MOVEMENT_EQUALS_EXTRACTION=${STOCKPILE_MOVEMENT_EQUALS_EXTRACTION}`);
  console.log(`REFERENCE_PRICE_CREATES_OUTPUT=${REFERENCE_PRICE_CREATES_OUTPUT}`);
  console.log(`LEGAL_OWNERSHIP_INFERRED=${LEGAL_OWNERSHIP_INFERRED}`);
  console.log(`REAL_PROVIDER_CONTACTED=${RESOURCE_REAL_PROVIDER_CONTACTED}`);
  console.log(`PRODUCTION_ACTIVE=${RESOURCE_PRODUCTION_ACTIVE}`);
  console.log(`RESOURCE_FACT_AUTO_MINT=${resourceFactCannotAutoMint()}`);
  console.log(`CERTIFICATION_AUTHORIZES_MOONREY=${resourceCertificationCannotAuthorizeMoonRey()}`);
  return Object.freeze({
    extractionEventCount: events.value.length,
    concentrateLinked: lineage.value.relation === 'TRANSFORMS',
    flags: Object.freeze({
      RESERVE_EQUALS_EXTRACTION,
      STOCKPILE_MOVEMENT_EQUALS_EXTRACTION,
      REFERENCE_PRICE_CREATES_OUTPUT,
      LEGAL_OWNERSHIP_INFERRED,
      REAL_PROVIDER_CONTACTED: RESOURCE_REAL_PROVIDER_CONTACTED,
      PRODUCTION_ACTIVE: RESOURCE_PRODUCTION_ACTIVE,
    }),
  });
}

const invokedDirectly = (process.argv[1] ?? '').includes('provider-families/resources/demo');
if (invokedDirectly) {
  runResourceDataFabricDemo();
}

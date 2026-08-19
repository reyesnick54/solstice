/**
 * Compute economic data adapter.
 *
 * Connector records enter here after the off-chain runtime. The
 * adapter never calls a live provider, never mints MoonRey, and
 * never stores workload payloads.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { convertExact } from '../../../../units/convert.ts';
import { TOKEN_INFERENCE_QUALIFIER } from '../../../../units/constitution.ts';
import { receiptDigestOf } from '../../../../units/measurement.ts';
import { identityRef } from '../../../../productive/policy-governance/attribution/identity.ts';
import { validateExternalRecord } from '../../schema.ts';
import type { ExternalSourceRecord } from '../../schema.ts';
import {
  COMPUTE_FACT_AUTO_MINTS_MOONREY,
  computeRefusal,
  isForbiddenComputeFactType,
  type ComputeEconomicRecord,
  type ComputeRefusal,
  type ComputeSourceObservation,
} from './types.ts';
import { scanComputePrivacy } from './privacy.ts';
import { computeFeedSchema } from './schemas.ts';
import { resolveResourceTime } from './resource-context.ts';
import { refuseTokenGpuConversion, refuseTrainingInferenceTokens, resolveInferenceTokens } from './usage.ts';
import { inventoryFrom } from './capacity.ts';
import { executionReferenceOf } from './jobs.ts';
import { profileFor } from './profiles.ts';

const STALE_AFTER_SECONDS = 3_600n;

export function ingestComputeObservation(
  observation: ComputeSourceObservation,
  nowUnix: bigint,
): Result<ComputeEconomicRecord, ComputeRefusal> {
  const privacy = scanComputePrivacy(observation);
  if (!privacy.ok) {
    return privacy;
  }
  if (isForbiddenComputeFactType(observation.factType)) {
    return err(computeRefusal('FORBIDDEN_FACT_TYPE', `${observation.factType} is not an economic compute fact`));
  }
  if (
    observation.workloadClass !== 'GENERAL_COMPUTE' &&
    observation.workloadClass !== 'AI_INFERENCE' &&
    observation.workloadClass !== 'AI_TRAINING'
  ) {
    return err(
      computeRefusal('WORKLOAD_CLASS_REQUIRED', 'workload class must be explicit; it is not inferred from provider name'),
    );
  }
  const profile = profileFor(observation.sourceClass);
  if (!profile.allowedWorkloadClasses.includes(observation.workloadClass)) {
    return err(
      computeRefusal(
        'WORKLOAD_CLASS_NOT_INFERRED_FROM_PROVIDER',
        `${observation.sourceClass} does not accept implicit ${observation.workloadClass} from a vendor name`,
      ),
    );
  }
  if (!profile.allowedFactTypes.includes(observation.factType)) {
    return err(computeRefusal('SCHEMA_INCOMPATIBLE', `${observation.sourceClass} cannot emit ${observation.factType}`));
  }
  if (nowUnix - BigInt(observation.sourceTimestampUnix) > STALE_AFTER_SECONDS) {
    return err(computeRefusal('STALE_JOB', 'compute job observation exceeds freshness bound'));
  }
  if (observation.energyProductionFactRef) {
    return err(
      computeRefusal(
        'ENERGY_PRODUCTION_CLAIMED_AS_OWN',
        'compute may reference ENERGY_CONSUMPTION lineage only; ENERGY_PRODUCTION stays with the producer',
      ),
    );
  }

  if (
    observation.factType === 'AI_TRAINING_USAGE' &&
    (observation.unit === 'token_inference' || observation.tokenBreakdown?.mapsToTokenInference)
  ) {
    return refuseTrainingInferenceTokens(observation);
  }
  if (
    observation.unit === 'token_inference' &&
    (observation.timeBase === 'GPU_SECONDS' || observation.factType === 'COMPUTE_USAGE')
  ) {
    return refuseTokenGpuConversion(observation);
  }

  const schema = computeFeedSchema(observation.schemaId);
  const sourceUnit =
    observation.unit === 'cpu_s' || observation.unit === 'GPU_HOUR' || observation.unit === 'CPU_HOUR'
      ? schema.unit
      : observation.unit;
  const external: ExternalSourceRecord = Object.freeze({
    identifier: observation.identifier,
    numericValue: observation.numericValue,
    unit: sourceUnit,
    sourceTimestampUnix: observation.sourceTimestampUnix,
    schemaId: schema.schemaId,
    schemaVersion: 1,
  });
  const validated = validateExternalRecord(schema, external);
  if (!validated.ok) {
    if (validated.error.code === 'FLOAT_FORBIDDEN' || validated.error.code === 'WRONG_NUMERIC_REPRESENTATION') {
      return err(computeRefusal('FLOAT_USAGE_FORBIDDEN', validated.error.detail));
    }
    return err(computeRefusal('SCHEMA_INCOMPATIBLE', validated.error.detail));
  }

  if (observation.factType === 'AI_INFERENCE_USAGE') {
    const tokens = resolveInferenceTokens(observation);
    if (!tokens.ok) {
      return tokens;
    }
    return inferenceRecord(observation, tokens.value);
  }

  const resolved = resolveResourceTime(observation);
  if (!resolved.ok) {
    return resolved;
  }
  const capacity =
    observation.factType === 'AI_COMPUTE_CAPACITY' || observation.factType === 'COMPUTE_CAPACITY'
      ? inventoryFrom(observation)
      : undefined;
  if (capacity && !capacity.ok) {
    return capacity;
  }

  const execution = executionReferenceOf(observation);
  return ok(
    Object.freeze({
      fabricVersion: 'sunrey.compute-ai-data-fabric.v1' as const,
      schemaId: observation.schemaId,
      factType: observation.factType,
      productiveCategory: observation.productiveCategory,
      claimType: observation.claimType,
      sourceClass: observation.sourceClass,
      execution,
      sourceQuantity: resolved.value.measurement.sourceQuantity,
      canonicalQuantity: resolved.value.measurement.canonicalQuantity,
      canonicalUnit: resolved.value.measurement.canonicalUnit,
      dimension: resolved.value.measurement.measurementDimension,
      measurement: resolved.value.measurement,
      receipt: resolved.value.receipt,
      tokenBreakdown: observation.tokenBreakdown ?? null,
      capacity: capacity && capacity.ok ? capacity.value : null,
      energyLineage: observation.energyConsumptionFactRef
        ? Object.freeze({
            energyConsumptionFactRef: identityRef('energy-consumption', observation.energyConsumptionFactRef),
            claimsEnergyProduction: false as const,
          })
        : null,
      promptContentStored: false as const,
      modelOutputStored: false as const,
      credentialMaterialStored: false as const,
      tokenEqualsGpuTime: false as const,
      capacityEqualsRealizedOutput: false as const,
      realProviderContacted: false as const,
      computeFactAutoMintsMoonRey: COMPUTE_FACT_AUTO_MINTS_MOONREY,
    }),
  );
}

function inferenceRecord(
  observation: ComputeSourceObservation,
  tokenBreakdown: NonNullable<ComputeSourceObservation['tokenBreakdown']>,
): Result<ComputeEconomicRecord, ComputeRefusal> {
  const quantity = {
    mantissa: BigInt(observation.numericValue),
    scale: 0,
    numerator: 1n,
    denominator: 1n,
    unitId: 'token_inference',
  };
  const receipt = convertExact({
    source: quantity,
    targetUnitId: 'TOKEN',
    context: {
      semanticQualifier: TOKEN_INFERENCE_QUALIFIER,
      factType: 'AI_INFERENCE_USAGE',
      productiveCategory: 'AI_COMPUTE',
    },
  });
  if (!receipt.ok) {
    return err(computeRefusal('INCOMPATIBLE_DIMENSION', receipt.error.detail));
  }
  const execution = executionReferenceOf(observation);
  return ok(
    Object.freeze({
      fabricVersion: 'sunrey.compute-ai-data-fabric.v1' as const,
      schemaId: observation.schemaId,
      factType: observation.factType,
      productiveCategory: observation.productiveCategory,
      claimType: observation.claimType,
      sourceClass: observation.sourceClass,
      execution,
      sourceQuantity: quantity,
      canonicalQuantity: receipt.value.targetQuantity,
      canonicalUnit: receipt.value.targetUnit,
      dimension: receipt.value.dimension,
      measurement: {
        schemaVersion: 1 as const,
        sourceQuantity: quantity,
        sourceUnit: 'token_inference',
        canonicalQuantity: receipt.value.targetQuantity,
        canonicalUnit: receipt.value.targetUnit,
        measurementDimension: receipt.value.dimension,
        semanticQualifier: TOKEN_INFERENCE_QUALIFIER,
        productiveCategory: 'AI_COMPUTE' as const,
        factType: 'AI_INFERENCE_USAGE' as const,
        claimType: 'USAGE' as const,
        normalizationReceiptId: receipt.value.receiptId,
        normalizationReceiptDigest: receiptDigestOf(receipt.value),
        normalizationConstitutionVersion: receipt.value.conversionVersion,
        measurementPeriod: {
          startUnix: observation.measurementStart,
          endUnix: observation.measurementEnd,
        },
        contextRefs: receipt.value.contextRefs,
        exact: true as const,
        roundingApplied: false as const,
        lossy: false as const,
        receipt: receipt.value,
        mappingId: null,
        mappingVersion: null,
      },
      receipt: receipt.value,
      tokenBreakdown,
      capacity: null,
      energyLineage: null,
      promptContentStored: false as const,
      modelOutputStored: false as const,
      credentialMaterialStored: false as const,
      tokenEqualsGpuTime: false as const,
      capacityEqualsRealizedOutput: false as const,
      realProviderContacted: false as const,
      computeFactAutoMintsMoonRey: COMPUTE_FACT_AUTO_MINTS_MOONREY,
    }),
  );
}

export function computeAdapterDoesNotMint(): false {
  return COMPUTE_FACT_AUTO_MINTS_MOONREY;
}

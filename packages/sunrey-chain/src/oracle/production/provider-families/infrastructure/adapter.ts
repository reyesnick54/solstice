import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { validateSourceFactClaimMapping } from '../../../source-taxonomy/validator.ts';
import { createProductiveEconomicEvent, identityRef } from '../../../../productive/policy-governance/attribution/index.ts';
import type { ProductiveEconomicEvent } from '../../../../productive/policy-governance/attribution/types.ts';
import { classifyInfrastructureIndependence, profileFor } from './profiles.ts';
import { infrastructureSchemaDrift } from './schemas.ts';
import {
  CAPACITY_EQUALS_REALIZED_USE,
  INFRASTRUCTURE_FABRIC_SCHEMA_VERSION,
  INFRASTRUCTURE_FACILITY_TIME_V2,
  INFRASTRUCTURE_PRODUCTION_ACTIVE,
  INFRASTRUCTURE_REAL_PROVIDER_CONTACTED,
  LEGACY_INFRASTRUCTURE_MACHINE_H_V1,
  defaultInfrastructureFabricPolicy,
  isInfrastructureClass,
  isInfrastructureFactType,
  isInfrastructureSourceClass,
  isInfrastructureUsageState,
  isRealizedInfrastructureState,
  type InfrastructureEvidenceRecord,
  type InfrastructureFabricPolicy,
  type InfrastructureIdentityRefs,
  type InfrastructureRefusal,
  type InfrastructureSourceRecord,
  type NormalizedInfrastructureObservation,
} from './types.ts';
import { deriveFacilityTime, parseIntegerMantissa, reproduceLegacyMachineH } from './units.ts';

export type InfrastructureIngestResult = {
  readonly observation: NormalizedInfrastructureObservation;
  readonly evidence: InfrastructureEvidenceRecord;
};

function refuse(code: InfrastructureRefusal['code'], detail: string): Result<never, InfrastructureRefusal> {
  return err({ code, detail });
}

function observationIdOf(record: InfrastructureSourceRecord): string {
  return `inobs_${createHash('sha256')
    .update(
      [
        record.identifier,
        record.sourceClass,
        record.factType,
        record.facilityUnits,
        record.measurementStartUnix,
        record.measurementEndUnix,
        record.identity.facilityId,
        record.unitSemantics,
      ].join('|'),
    )
    .digest('hex')
    .slice(0, 32)}`;
}

function identityRefsOf(record: InfrastructureSourceRecord): InfrastructureIdentityRefs {
  return Object.freeze({
    facilityRef: identityRef('facility', record.identity.facilityId),
    terminalRef: record.identity.terminalId ? identityRef('terminal', record.identity.terminalId) : null,
  });
}

export function ingestInfrastructureRecord(
  record: InfrastructureSourceRecord,
  nowUnix: bigint,
  policy: InfrastructureFabricPolicy = defaultInfrastructureFabricPolicy(),
  related: readonly InfrastructureSourceRecord[] = [],
): Result<InfrastructureIngestResult, InfrastructureRefusal> {
  if (policy.realNetworkCalls || policy.productionActive) {
    return refuse('PRODUCTION_ACTIVATION_FORBIDDEN', 'infrastructure fabric stays simulation-only');
  }
  if (!isInfrastructureSourceClass(record.sourceClass)) {
    return refuse('UNKNOWN_SOURCE_CLASS', `unknown source class ${record.sourceClass}`);
  }
  if (!isInfrastructureClass(record.infrastructureClass)) {
    return refuse('UNKNOWN_INFRASTRUCTURE_CLASS', `unknown infrastructure class ${record.infrastructureClass}`);
  }
  if (!isInfrastructureUsageState(record.usageState)) {
    return refuse('UNKNOWN_USAGE_STATE', `unknown usage state ${record.usageState}`);
  }
  if (record.factType === 'ENERGY_PRODUCTION' || record.factType === 'WATER_PRODUCTION') {
    return refuse(
      record.factType === 'ENERGY_PRODUCTION' ? 'ENERGY_INPUT_CLAIMED_AS_OUTPUT' : 'WATER_INPUT_CLAIMED_AS_OUTPUT',
      'infrastructure operators cannot claim upstream energy or water production',
    );
  }
  if (record.factType === 'LOGISTICS_CAPACITY' || record.factType === 'DELIVERY_COMPLETION') {
    return refuse('LOGISTICS_TRANSPORT_MERGED', 'physical transport remains the logistics family');
  }
  if (!isInfrastructureFactType(record.factType)) {
    return refuse('WRONG_FACT_TYPE', `infrastructure fabric does not ingest ${record.factType}`);
  }
  if (infrastructureSchemaDrift(record)) {
    return refuse('SCHEMA_DRIFT', `schema ${record.schemaId}@${record.schemaVersion} does not match ${record.sourceClass}`);
  }
  if (!record.identity.facilityId) {
    return refuse('MISSING_FACILITY_REF', 'infrastructure evidence requires facilityRef');
  }
  const start = parseIntegerMantissa(record.measurementStartUnix, 'FLOAT_DURATION_FORBIDDEN');
  const end = parseIntegerMantissa(record.measurementEndUnix, 'FLOAT_DURATION_FORBIDDEN');
  if (!start.ok) {
    return start;
  }
  if (!end.ok) {
    return end;
  }
  if (end.value <= start.value) {
    return refuse('MISSING_MEASUREMENT_WINDOW', 'measurement end must be after start');
  }
  const observedAt = parseIntegerMantissa(record.sourceTimestampUnix);
  if (!observedAt.ok) {
    return observedAt;
  }
  if (nowUnix - observedAt.value > BigInt(policy.maximumObservationAgeSeconds)) {
    return refuse('STALE_UTILIZATION', 'utilization evidence is older than the governed freshness window');
  }
  const durationSeconds = end.value - start.value;
  const facilityUnits = parseIntegerMantissa(record.facilityUnits);
  if (!facilityUnits.ok) {
    return facilityUnits;
  }
  const profile = profileFor(record.sourceClass);
  if (!profile.allowedFactTypes.includes(record.factType)) {
    return refuse('WRONG_FACT_TYPE', `${record.sourceClass} cannot emit ${record.factType}`);
  }
  const createsUsageEvent = record.factType === 'INFRASTRUCTURE_USAGE' && isRealizedInfrastructureState(record.usageState);
  const createsCapacityReference = record.factType === 'INFRASTRUCTURE_CAPACITY';
  if (record.factType === 'INFRASTRUCTURE_USAGE' && !createsUsageEvent) {
    if (record.usageState === 'MAINTENANCE' || record.usageState === 'DOWNTIME') {
      return refuse(
        'MAINTENANCE_IS_NOT_NEGATIVE_OUTPUT',
        'maintenance and downtime are operational context, not negative economic output',
      );
    }
    return refuse('CAPACITY_IS_NOT_USAGE', 'available or vacant infrastructure is not realized usage');
  }
  if (record.factType === 'INFRASTRUCTURE_CAPACITY' && isRealizedInfrastructureState(record.usageState)) {
    return refuse('CAPACITY_IS_NOT_USAGE', 'capacity remains a reference/eligibility state');
  }

  const independence = classifyInfrastructureIndependence({
    sourceClass: record.sourceClass,
    controllerId: record.controllerId,
    upstreamOrganizationId: record.upstreamOrganizationId,
    related: related.map((row) => ({
      controllerId: row.controllerId,
      upstreamOrganizationId: row.upstreamOrganizationId,
    })),
  });
  if (
    related.length > 0 &&
    independence !== 'INDEPENDENT_ORGANIZATION' &&
    related.some((row) => row.controllerId === record.controllerId) &&
    profile.mayBeIndependentOrganization
  ) {
    return refuse(
      'SAME_CONTROLLER_FAKE_QUORUM',
      'same-controller infrastructure endpoints are not independent quorum members',
    );
  }

  let sourceQuantity;
  let canonicalQuantity;
  let canonicalUnit: NormalizedInfrastructureObservation['canonicalUnit'];
  if (record.unitSemantics === LEGACY_INFRASTRUCTURE_MACHINE_H_V1) {
    if (!policy.allowLegacyMachineHReproduction) {
      return refuse('MACHINE_H_USED_FOR_FACILITY_HOUR', 'legacy machine_h reproduction is not enabled');
    }
    if (record.unit !== 'machine_h') {
      return refuse('WRONG_UNIT', 'legacy v1 infrastructure evidence must keep stored machine_h');
    }
    const reported = parseIntegerMantissa(record.numericValue);
    if (!reported.ok) {
      return reported;
    }
    const reproduced = reproduceLegacyMachineH(reported.value);
    if (!reproduced.ok) {
      return reproduced;
    }
    sourceQuantity = reproduced.value;
    canonicalQuantity = reproduced.value;
    canonicalUnit = 'machine_h';
  } else {
    if (record.unitSemantics !== INFRASTRUCTURE_FACILITY_TIME_V2) {
      return refuse('WRONG_UNIT', 'new infrastructure feeds must declare INFRASTRUCTURE_FACILITY_TIME_V2');
    }
    if (record.unit === 'machine_h') {
      return refuse('MACHINE_H_USED_FOR_FACILITY_HOUR', 'new feeds cannot use machine_h as facility-hour');
    }
    if (record.unit !== 'facility_hour') {
      return refuse('WRONG_UNIT', `new infrastructure usage uses facility_hour, not ${record.unit}`);
    }
    const derived = deriveFacilityTime({ facilityUnits: facilityUnits.value, durationSeconds });
    if (!derived.ok) {
      return derived;
    }
    const reported = parseIntegerMantissa(record.numericValue);
    if (!reported.ok) {
      return reported;
    }
    if (derived.value.mantissa !== reported.value) {
      return refuse(
        'FACILITY_TIME_INEXACT',
        `reported ${record.numericValue} facility-hour does not equal ${facilityUnits.value} × ${durationSeconds}s`,
      );
    }
    sourceQuantity = derived.value;
    canonicalQuantity = derived.value;
    canonicalUnit = 'facility_hour';
  }

  const observation: NormalizedInfrastructureObservation = Object.freeze({
    schemaVersion: INFRASTRUCTURE_FABRIC_SCHEMA_VERSION,
    observationId: observationIdOf(record),
    sourceClass: record.sourceClass,
    factType: record.factType,
    sourceCategory: 'infrastructure',
    productiveCategory: 'INFRASTRUCTURE',
    proposedClaimType: createsUsageEvent ? 'USAGE' : 'CAPACITY',
    usageState: record.usageState,
    infrastructureClass: record.infrastructureClass,
    unitSemantics: record.unitSemantics,
    sourceQuantity,
    canonicalQuantity,
    canonicalUnit,
    facilityUnits: facilityUnits.value,
    durationSeconds,
    identityRefs: identityRefsOf(record),
    controllerId: record.controllerId,
    upstreamOrganizationId: record.upstreamOrganizationId,
    operatorPartyId: record.operatorPartyId,
    independenceClass: independence,
    createsUsageEvent,
    createsCapacityReference,
    canCreateUsageClaim: createsUsageEvent,
    canMintMoonRey: false,
    canAutomaticallyProduceGpuv: CAPACITY_EQUALS_REALIZED_USE,
    legacyMachineHReinterpreted: false,
    productionActive: false,
  });
  const evidence: InfrastructureEvidenceRecord = Object.freeze({
    schemaVersion: INFRASTRUCTURE_FABRIC_SCHEMA_VERSION,
    fabricPolicyVersion: policy.policyVersion,
    observation,
    eventId: null,
    claimType: observation.proposedClaimType,
    automaticIssuance: false,
    verified: false,
    issued: false,
    certificationAuthorizesMoonRey: false,
    realProviderContacted: INFRASTRUCTURE_REAL_PROVIDER_CONTACTED,
    productionActive: INFRASTRUCTURE_PRODUCTION_ACTIVE,
  });
  return ok(Object.freeze({ observation, evidence }));
}

export function ingestInfrastructureRecords(
  records: readonly InfrastructureSourceRecord[],
  nowUnix: bigint,
  policy: InfrastructureFabricPolicy = defaultInfrastructureFabricPolicy(),
): Result<readonly InfrastructureIngestResult[], InfrastructureRefusal> {
  const accepted: InfrastructureIngestResult[] = [];
  for (const record of records) {
    const ingested = ingestInfrastructureRecord(record, nowUnix, policy, records.filter((row) => row !== record));
    if (!ingested.ok) {
      return ingested;
    }
    accepted.push(ingested.value);
  }
  return ok(Object.freeze(accepted));
}

export function identifyInfrastructureEvents(
  observations: readonly NormalizedInfrastructureObservation[],
): Result<readonly ProductiveEconomicEvent[], InfrastructureRefusal> {
  const usage = observations.filter((row) => row.createsUsageEvent);
  const grouped = new Map<string, NormalizedInfrastructureObservation[]>();
  for (const observation of usage) {
    const key = `${observation.identityRefs.facilityRef}|${observation.infrastructureClass}|${observation.durationSeconds}`;
    const rows = grouped.get(key) ?? [];
    rows.push(observation);
    grouped.set(key, rows);
  }
  const events: ProductiveEconomicEvent[] = [];
  for (const rows of grouped.values()) {
    const first = rows[0];
    if (!first) {
      continue;
    }
    const start = 1_700_000_000n;
    const end = start + first.durationSeconds;
    events.push(
      createProductiveEconomicEvent({
        eventClass: 'INFRASTRUCTURE_SERVICE_EVENT',
        evidence: {
          transformationRef: first.identityRefs.facilityRef,
          alternateViewGroupRef: first.identityRefs.facilityRef,
          physicalObjectRefs: Object.freeze([first.identityRefs.facilityRef]),
          sourceObjectRefs: Object.freeze([first.identityRefs.facilityRef]),
          inputLotRefs: Object.freeze([]),
          outputLotRefs: Object.freeze([]),
          serialAssetRefs: Object.freeze([]),
          measurementPeriod: Object.freeze({
            validFromUnixSeconds: start,
            validUntilUnixSeconds: end,
            epoch: 1,
          }),
          deliveryPeriod: Object.freeze({
            fromUnixSeconds: start,
            untilUnixSeconds: end,
          }),
          geographyId: first.identityRefs.facilityRef,
          jurisdiction: 'SIM',
          oracleFactRefs: Object.freeze(rows.map((row) => identityRef('obs', row.observationId))),
          sourceProvenanceRefs: Object.freeze([identityRef('src', first.sourceClass)]),
          upstreamEventRefs: Object.freeze([]),
          downstreamEventRefs: Object.freeze([]),
          canonicalMeasurementRefs: Object.freeze([
            identityRef('facility-time', `${first.canonicalQuantity.mantissa.toString()}:${first.canonicalUnit}`),
          ]),
          controllerRefs: Object.freeze([identityRef('ctl', first.controllerId)]),
          participantRefs: Object.freeze([identityRef('op', first.operatorPartyId)]),
          sourceSystemRefs: Object.freeze([identityRef('sys', first.sourceClass)]),
          lineageRoot: first.identityRefs.facilityRef,
          economicTransformationRef: first.identityRefs.facilityRef,
        },
      }),
    );
  }
  return ok(Object.freeze(events));
}

export function evaluateInfrastructureClaimPath(input: {
  readonly factType: string;
  readonly claimType: string;
  readonly sourceUnit?: string;
}): Result<{ readonly compatible: true }, InfrastructureRefusal> {
  if (input.factType === 'INFRASTRUCTURE_CAPACITY' && input.claimType === 'USAGE') {
    return refuse('CAPACITY_IS_NOT_USAGE', 'capacity cannot be claimed as realized usage');
  }
  if (input.factType === 'INFRASTRUCTURE_CAPACITY' && input.claimType === 'OUTPUT') {
    return refuse('CAPACITY_CANNOT_PRODUCE_GPUV', 'capacity cannot automatically produce GPUV');
  }
  const mapped = validateSourceFactClaimMapping({
    sourceCategory: 'infrastructure',
    factType: input.factType as 'INFRASTRUCTURE_USAGE',
    sourceUnit: (input.sourceUnit ?? 'facility_hour') as 'facility_hour',
    claimType: input.claimType as 'USAGE',
  });
  if (!mapped.ok) {
    return refuse('WRONG_FACT_TYPE', mapped.error.detail);
  }
  return ok(Object.freeze({ compatible: true as const }));
}

export function evaluateInfrastructureUtilization(input: {
  readonly actual: NormalizedInfrastructureObservation;
  readonly capacity: NormalizedInfrastructureObservation;
}): Result<{ readonly numerator: bigint; readonly denominator: bigint; readonly inventedDenominator: false }, InfrastructureRefusal> {
  if (input.actual.infrastructureClass !== input.capacity.infrastructureClass) {
    return refuse('UTILIZATION_DIMENSION_MISMATCH', 'facility-hours are not interchangeable across infrastructure classes');
  }
  if (input.actual.identityRefs.facilityRef !== input.capacity.identityRefs.facilityRef) {
    return refuse('UTILIZATION_DIMENSION_MISMATCH', 'utilization requires the same facility identity');
  }
  if (input.actual.canonicalUnit !== input.capacity.canonicalUnit) {
    return refuse('UTILIZATION_DIMENSION_MISMATCH', 'utilization requires a compatible dimension');
  }
  if (input.capacity.canonicalQuantity.mantissa === 0n) {
    return refuse('UTILIZATION_DENOMINATOR_INVENTED', 'utilization cannot invent a capacity denominator');
  }
  return ok(
    Object.freeze({
      numerator: input.actual.canonicalQuantity.mantissa,
      denominator: input.capacity.canonicalQuantity.mantissa,
      inventedDenominator: false as const,
    }),
  );
}

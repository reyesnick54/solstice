/**
 * Privacy-safe energy subject identity, device provenance, and
 * economic-event identity.
 *
 * Subjects are hashed references. Secrets and customer PII do not enter
 * oracle subjects. Multiple meter / plant / grid observations of the
 * same generated interval share one economic event identity.
 */

import { createHash } from 'node:crypto';

import { sha256Hex } from '../../../../../../security/src/hash.ts';
import type { DeviceProvenance } from '../../../types.ts';
import {
  createProductiveEconomicEvent,
  eventIdentityCannotAuthorizeIssuance,
  identityRef,
} from '../../../../productive/policy-governance/attribution/index.ts';
import type { ProductiveEconomicEvent } from '../../../../productive/policy-governance/attribution/types.ts';
import {
  type EnergyFlowChannel,
  type EnergyGeography,
  type EnergyObservationInput,
  type EnergySubjectKind,
  type EnergySubjectRef,
  type EnergyTimeWindow,
} from './types.ts';

export function canonicalEnergySubject(kind: EnergySubjectKind, sourceIdentity: string, displayLabel: string): EnergySubjectRef {
  return Object.freeze({
    kind,
    sourceIdentity,
    canonicalRef: sha256Hex(`energy.subject.${kind}.${sourceIdentity}`),
    displayLabel,
  });
}

export function energyObservationKey(input: {
  readonly meterRef: string;
  readonly registerId: string;
  readonly startUnix: bigint;
  readonly endUnix: bigint;
  readonly sourceObservationId: string;
  readonly unit: string;
  readonly quantityWh: bigint | null;
}): string {
  return sha256Hex(
    [
      'energy.obs',
      input.meterRef,
      input.registerId,
      input.startUnix.toString(),
      input.endUnix.toString(),
      input.sourceObservationId,
      input.unit,
      input.quantityWh?.toString() ?? '',
    ].join('|'),
  );
}

export function energyEventGroupRef(input: {
  readonly subject: EnergySubjectRef;
  readonly time: EnergyTimeWindow;
  readonly channel: EnergyFlowChannel;
}): string {
  return identityRef(
    'energy-event',
    `${input.subject.canonicalRef}:${input.time.measurementStartUnix.toString()}:${input.time.measurementEndUnix.toString()}:${input.channel}`,
  );
}

export function energyEventIdentity(input: {
  readonly subject: EnergySubjectRef;
  readonly time: EnergyTimeWindow;
  readonly geography: EnergyGeography;
  readonly channel: EnergyFlowChannel;
  readonly measurementRef: string | null;
}): ProductiveEconomicEvent {
  const group = energyEventGroupRef(input);
  return createProductiveEconomicEvent({
    eventClass: 'ENERGY_PRODUCTION_EVENT',
    evidence: {
      transformationRef: null,
      alternateViewGroupRef: group,
      physicalObjectRefs: Object.freeze([input.subject.canonicalRef]),
      sourceObjectRefs: Object.freeze([input.subject.canonicalRef]),
      inputLotRefs: Object.freeze([]),
      outputLotRefs: Object.freeze([group]),
      serialAssetRefs: Object.freeze([]),
      measurementPeriod: {
        validFromUnixSeconds: input.time.measurementStartUnix,
        validUntilUnixSeconds: input.time.measurementEndUnix,
        epoch: 0,
      },
      deliveryPeriod: {
        fromUnixSeconds: input.time.measurementStartUnix,
        untilUnixSeconds: input.time.measurementEndUnix,
      },
      geographyId: input.geography.gridZone || input.geography.locality,
      jurisdiction: input.geography.jurisdiction,
      oracleFactRefs: Object.freeze([]),
      sourceProvenanceRefs: Object.freeze([]),
      upstreamEventRefs: Object.freeze([]),
      downstreamEventRefs: Object.freeze([]),
      canonicalMeasurementRefs: Object.freeze(input.measurementRef ? [input.measurementRef] : []),
      controllerRefs: Object.freeze([]),
      participantRefs: Object.freeze([]),
      sourceSystemRefs: Object.freeze([]),
      lineageRoot: group,
      economicTransformationRef: null,
    },
  });
}

export function energyEventsShareIdentity(left: ProductiveEconomicEvent, right: ProductiveEconomicEvent): boolean {
  return left.eventId === right.eventId && left.eventFingerprint === right.eventFingerprint;
}

export function energyEventDoesNotMint(event: ProductiveEconomicEvent): false {
  return eventIdentityCannotAuthorizeIssuance(event);
}

export function retainDeviceProvenance(device: DeviceProvenance | null): DeviceProvenance | null {
  if (!device) {
    return null;
  }
  return Object.freeze({
    schemaVersion: 1,
    deviceId: device.deviceId,
    ownerController: device.ownerController,
    firmwareHash: device.firmwareHash,
    hardwareAttestation: device.hardwareAttestation,
    calibrationRecord: device.calibrationRecord,
    measurementSchema: device.measurementSchema,
  });
}

export function provenanceCommitment(material: unknown): string {
  return createHash('sha256').update(stable(material)).digest('hex');
}

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return `[${value.map(stable).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
}

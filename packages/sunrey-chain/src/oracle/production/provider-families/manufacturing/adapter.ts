/**
 * Read-only manufacturing fabric adapter.
 *
 * Observes economic evidence. Does not command industrial equipment,
 * contact a real factory, or mint MoonRey.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { oracleFactCreationNeverMintsMoonRey } from '../../eligibility.ts';
import { evaluateProductionEvidence } from './batches.ts';
import {
  bindObservationsToEvent,
  evaluateSourceIndependence,
  eventFromObservation,
  factTypesRemainDistinct,
  refuseIndependentCreditsForSameBatch,
} from './lineage.ts';
import { evaluateMachineOutput } from './machines.ts';
import { publicInternetIndustrialAccessForbidden, type ManufacturingGatewayProfile } from './profiles.ts';
import { linkQualityAttestation } from './quality.ts';
import { manufacturingFeedSchema, validateManufacturingPayload } from './schemas.ts';
import type { ResolvedDestination } from '../../security-policy.ts';
import {
  FORBIDDEN_INDUSTRIAL_CONTROL_METHODS,
  INDUSTRIAL_CONTROL_COMMANDS_AVAILABLE,
  MANUFACTURING_FACT_AUTO_MINTS,
  REAL_FACTORY_CONTACTED,
  type ManufacturingFactType,
  type ManufacturingObservation,
  type ManufacturingRejection,
  type ManufacturingSourceClass,
} from './types.ts';

export type AcceptedManufacturingObservation = {
  readonly observation: ManufacturingObservation;
  readonly periodQuantity: bigint;
  readonly eventId: string;
  readonly mintsMoonRey: false;
  readonly contactedRealFactory: false;
  readonly industrialControlInvoked: false;
};

export class ManufacturingDataFabric {
  readonly fabricVersion = 'sunrey.manufacturing-robotics-data-fabric.v1';
  readonly readOnly = true;
  readonly industrialControlCommandsAvailable = INDUSTRIAL_CONTROL_COMMANDS_AVAILABLE;
  readonly realFactoryContacted = REAL_FACTORY_CONTACTED;
  readonly productionActive = false;
  readonly autoMints = MANUFACTURING_FACT_AUTO_MINTS;

  private readonly accepted: AcceptedManufacturingObservation[] = [];

  ingest(observation: ManufacturingObservation): Result<AcceptedManufacturingObservation, ManufacturingRejection> {
    if (!factTypesRemainDistinct('MANUFACTURING_OUTPUT', 'AUTOMATED_MACHINE_OUTPUT', 'GOODS_OUTPUT')) {
      return err({
        code: 'FACT_TYPES_MUST_REMAIN_DISTINCT',
        detail: 'MANUFACTURING_OUTPUT, AUTOMATED_MACHINE_OUTPUT, and GOODS_OUTPUT stay distinct',
      });
    }
    if (observation.factType === 'GOODS_OUTPUT') {
      const event = eventFromObservation(observation);
      const accepted = Object.freeze({
        observation,
        periodQuantity: 0n,
        eventId: event.eventId,
        mintsMoonRey: false as const,
        contactedRealFactory: false as const,
        industrialControlInvoked: false as const,
      });
      this.accepted.push(accepted);
      return ok(accepted);
    }
    const schema = manufacturingFeedSchema(
      observation.sourceClass,
      observation.factType as ManufacturingFactType,
      observation.unit as 'units_produced' | 'kg' | 'tonne' | 'machine_h',
    );
    const payload = validateManufacturingPayload(observation, schema);
    if (!payload.ok) {
      return payload;
    }
    const evidence = evaluateProductionEvidence(observation);
    if (!evidence.ok) {
      return evidence;
    }
    const machine = evaluateMachineOutput(observation);
    if (!machine.ok) {
      return machine;
    }
    const quality = linkQualityAttestation(observation);
    if (!quality.ok) {
      return quality;
    }
    const event = eventFromObservation(observation);
    const accepted = Object.freeze({
      observation,
      periodQuantity: machine.value.periodQuantity,
      eventId: event.eventId,
      mintsMoonRey: false as const,
      contactedRealFactory: false as const,
      industrialControlInvoked: false as const,
    });
    this.accepted.push(accepted);
    return ok(accepted);
  }

  observations(): readonly AcceptedManufacturingObservation[] {
    return this.accepted.map((row) => Object.freeze({ ...row }));
  }

  bind(observations: readonly ManufacturingObservation[]) {
    return bindObservationsToEvent(observations);
  }

  refuseIndependentSameBatch(observations: readonly ManufacturingObservation[]) {
    return refuseIndependentCreditsForSameBatch(observations);
  }

  independence(observations: readonly ManufacturingObservation[]) {
    return evaluateSourceIndependence(observations);
  }

  enforcePrivateGateway(profile: ManufacturingGatewayProfile, destination: ResolvedDestination) {
    return publicInternetIndustrialAccessForbidden(profile, destination);
  }

  exposedIndustrialControlMethods(): readonly string[] {
    return FORBIDDEN_INDUSTRIAL_CONTROL_METHODS.filter((method) => method in this);
  }

  manufacturingFactCannotAutoMint(): true {
    return oracleFactCreationNeverMintsMoonRey() && this.autoMints === false;
  }
}

export function ingestManufacturingObservation(
  observation: ManufacturingObservation,
): Result<AcceptedManufacturingObservation, ManufacturingRejection> {
  return new ManufacturingDataFabric().ingest(observation);
}

export function noIndustrialControlMethodsExposed(fabric: ManufacturingDataFabric): boolean {
  return fabric.exposedIndustrialControlMethods().length === 0 && fabric.industrialControlCommandsAvailable === false;
}

export function noMachineSecretsStored(observation: ManufacturingObservation): boolean {
  return observation.rawPayloadPresent === false && observation.extras?.apiKey === undefined && observation.extras?.password === undefined;
}

export function sourceClassSupported(sourceClass: ManufacturingSourceClass): boolean {
  return [
    'MES',
    'ERP_PRODUCTION_LEDGER',
    'SCADA_READ_ONLY_GATEWAY',
    'PLC_READ_ONLY_TELEMETRY',
    'ROBOT_CONTROLLER_TELEMETRY',
    'MACHINE_DATA_HISTORIAN',
    'QUALITY_MANAGEMENT_SYSTEM',
    'WEIGH_SCALE',
    'VISION_INSPECTION_ATTESTATION',
    'WAREHOUSE_PRODUCTION_HANDOFF',
  ].includes(sourceClass);
}

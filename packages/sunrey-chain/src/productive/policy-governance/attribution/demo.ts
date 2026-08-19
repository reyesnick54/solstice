/**
 * demo:moonrey-attribution-policy
 *
 * One supply chain: energy → factory → robot → batch → freight → warehouse.
 * Prints which events are the same event, a dependent input, or a distinct
 * service, plus the attribution decisions.
 */

import {
  AI_CAN_ACTIVATE_POLICY,
  ATTRIBUTION_AUTHORIZES_MOONREY,
  ATTRIBUTION_DOES_FINAL_VALUATION,
  DUPLICATE_FULL_ATTRIBUTION_ALLOWED,
  PRODUCTION_ACTIVE,
} from './constitution.ts';
import { evaluateAttribution } from './engine.ts';
import { supplyChainSubjects } from './fixtures.ts';
import { developmentAttributionPolicy } from './policy.ts';

export function runMoonReyAttributionPolicyDemo(): string {
  const policy = developmentAttributionPolicy();
  const chain = supplyChainSubjects();
  const evaluation = evaluateAttribution({
    height: 10,
    policy,
    subjects: [
      chain.energy,
      chain.factoryConsumption,
      chain.manufacturing,
      chain.robot,
      chain.goods,
      chain.freight,
      chain.storage,
    ],
    relationships: chain.relationships,
  });

  const lines: string[] = [
    'MoonRey cross-domain attribution policy demo',
    `policyId=${policy.policyId}`,
    `policyVersion=${policy.version}`,
    `parameterClass=${policy.parameterClass}`,
    '',
    'Supply chain event identity',
    `  energy ${chain.energy.economicEventId} DISTINCT production (${chain.energy.controllerId})`,
    `  factory energy-use ${chain.factoryConsumption.economicEventId} DEPENDENT_INPUT of energy`,
    `  manufacturing ${chain.manufacturing.economicEventId} DISTINCT production`,
    `  robot ${chain.robot.economicEventId} SAME_UNDERLYING_EVENT as manufacturing`,
    `  goods ${chain.goods.economicEventId} GOODS_IDENTITY of manufacturing output`,
    `  freight ${chain.freight.economicEventId} DISTINCT_REALIZED_SERVICE`,
    `  storage ${chain.storage.economicEventId} DISTINCT_REALIZED_SERVICE`,
    '',
    'Attribution decisions',
  ];

  for (const decision of evaluation.decisions) {
    lines.push(
      `  ${decision.claimId} ${decision.category}/${decision.claimType} ${decision.decision} share=${decision.attributionShare}/${decision.shareScale} reasons=${decision.reasonCodes.join(',')}`,
    );
  }

  lines.push(
    '',
    `DUPLICATE_FULL_ATTRIBUTION_ALLOWED=${String(DUPLICATE_FULL_ATTRIBUTION_ALLOWED).toLowerCase()}`,
    `ATTRIBUTION_DOES_FINAL_VALUATION=${String(ATTRIBUTION_DOES_FINAL_VALUATION).toLowerCase()}`,
    `ATTRIBUTION_AUTHORIZES_MOONREY=${String(ATTRIBUTION_AUTHORIZES_MOONREY).toLowerCase()}`,
    `AI_CAN_ACTIVATE_POLICY=${String(AI_CAN_ACTIVATE_POLICY).toLowerCase()}`,
    `PRODUCTION_ACTIVE=${String(PRODUCTION_ACTIVE).toLowerCase()}`,
    `authorizesIssuance=${String(evaluation.authorizesIssuance)}`,
    `performsFinalValuation=${String(evaluation.performsFinalValuation)}`,
  );

  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(`${runMoonReyAttributionPolicyDemo()}\n`);
import { EconomicAssetRegistry } from '../../../../../economic-asset-registry/src/index.ts';
import { classifyEventClass, classifyObservationRelation } from './classification.ts';
import {
  claimRefFor,
  createProductiveEconomicEvent,
  eventIdentityCannotAuthorizeIssuance,
  objectRefFor,
  relationRecord,
} from './event.ts';
import { rebuildProductiveAttributionGraph } from './graph.ts';
import { economicEventFingerprintV3, historicalFingerprintDomains, identityRef } from './identity.ts';
import { buildBatchLineage, outputBatchIsIndependentProduction } from './lineage.ts';
import { defaultProjectionInstant, eventProjectionCannotMint, projectEconomicEvent } from './registry.ts';
import { ProductiveEventIdentityRegistry } from './store.ts';
import type { EventIdentityEvidence } from './types.ts';

type Period = {
  readonly validFromUnixSeconds: bigint;
  readonly validUntilUnixSeconds: bigint;
  readonly epoch: number;
};

const PERIOD: Period = Object.freeze({
  validFromUnixSeconds: 1_799_000_000n,
  validUntilUnixSeconds: 1_800_000_000n,
  epoch: 12,
});

function evidence(overrides: Partial<EventIdentityEvidence> = {}): EventIdentityEvidence {
  const transformation = identityRef('transform', 'factory-line-7:batch-B1');
  const lot = identityRef('lot', 'B1');
  return {
    transformationRef: transformation,
    alternateViewGroupRef: identityRef('view', 'mfg-B1'),
    physicalObjectRefs: [],
    sourceObjectRefs: [],
    inputLotRefs: [identityRef('lot', 'A')],
    outputLotRefs: [lot],
    serialAssetRefs: [],
    measurementPeriod: PERIOD,
    deliveryPeriod: { fromUnixSeconds: PERIOD.validFromUnixSeconds, untilUnixSeconds: PERIOD.validUntilUnixSeconds },
    geographyId: 'geo.factory.7',
    jurisdiction: 'US-SIM',
    oracleFactRefs: [],
    sourceProvenanceRefs: [],
    upstreamEventRefs: [],
    downstreamEventRefs: [],
    canonicalMeasurementRefs: [identityRef('measure', 'units:B1:100')],
    controllerRefs: [],
    participantRefs: [],
    sourceSystemRefs: [],
    lineageRoot: identityRef('root', 'batch-A'),
    economicTransformationRef: transformation,
    ...overrides,
  };
}

export function runMoonreyEconomicEventIdentityDemo(): string {
  const registry = new ProductiveEventIdentityRegistry();
  const factoryObject = objectRefFor('factory.line.7');
  const robotObject = objectRefFor('robot.R1');
  const manufacturingClaim = claimRefFor('claim.factory.mfg.B1');
  const machineClaim = claimRefFor('claim.robot.output.B1');
  const goodsClaim = claimRefFor('claim.goods.B1');

  const factoryEvidence = evidence({
    physicalObjectRefs: [factoryObject],
    sourceObjectRefs: [factoryObject],
    controllerRefs: [identityRef('controller', 'factory-ops')],
    sourceSystemRefs: [identityRef('src', 'mes')],
    oracleFactRefs: [identityRef('fact', 'factory-output')],
  });
  const robotEvidence = evidence({
    physicalObjectRefs: [robotObject],
    sourceObjectRefs: [robotObject],
    controllerRefs: [identityRef('controller', 'robot-telemetry')],
    sourceSystemRefs: [identityRef('src', 'robot-telemetry')],
    oracleFactRefs: [identityRef('fact', 'robot-output')],
  });

  const manufacturing = registry.register(
    {
      eventClass: classifyEventClass({ observationKind: 'FACTORY_MANUFACTURING_OUTPUT' }),
      evidence: factoryEvidence,
      claimRefs: [manufacturingClaim],
    },
    factoryEvidence,
  );
  registry.attachObject(manufacturing.eventId, factoryObject);

  const machine = registry.register(
    {
      eventClass: classifyEventClass({ observationKind: 'ROBOT_MACHINE_OUTPUT' }),
      evidence: robotEvidence,
      claimRefs: [machineClaim],
    },
    robotEvidence,
  );
  registry.attachObject(machine.eventId, robotObject);
  const linked = registry.link(manufacturing.eventId, machine.eventId);
  registry.attachClaim(manufacturing.eventId, goodsClaim);
  const canonical = registry.get(manufacturing.eventId) ?? linked.left;

  const goodsRecord = createProductiveEconomicEvent({
    eventClass: classifyEventClass({
      observationKind: 'GOODS_BATCH_RECORD',
      describesManufacturingTransformation: true,
    }),
    evidence: evidence({ physicalObjectRefs: [identityRef('object', 'goods.B1')] }),
    claimRefs: [goodsClaim],
  });

  const freightEvidence = evidence({
    transformationRef: identityRef('transform', 'freight:B1'),
    alternateViewGroupRef: identityRef('view', 'freight-B1'),
    economicTransformationRef: identityRef('transform', 'freight:B1'),
    physicalObjectRefs: [identityRef('object', 'carrier.F9')],
    outputLotRefs: [identityRef('lot', 'B1')],
    sourceSystemRefs: [identityRef('src', 'freight')],
  });
  const freight = registry.register(
    {
      eventClass: classifyEventClass({ observationKind: 'LOGISTICS_DELIVERY' }),
      evidence: freightEvidence,
      claimRefs: [claimRefFor('claim.freight.B1')],
    },
    freightEvidence,
  );
  registry.recordRelation(
    relationRecord(`event:${freight.eventId}`, `event:${canonical.eventId}`, 'TRANSPORTS', 'VERIFIED_LINK'),
  );
  registry.recordRelation(
    relationRecord(`event:${freight.eventId}`, `event:${canonical.eventId}`, 'DISTINCT_VALUE_EVENT', 'VERIFIED_LINK'),
  );

  const lineage = buildBatchLineage({
    rawMaterialBatchRef: identityRef('lot', 'A'),
    energyEventRef: identityRef('energy', 'B'),
    manufacturingEventId: canonical.eventId,
    outputBatchRef: identityRef('lot', 'B1'),
    logisticsEventId: freight.eventId,
    authoritative: true,
  });

  const graph = rebuildProductiveAttributionGraph({
    events: [canonical, freight],
    relations: registry.listRelations(),
  });
  const rebuilt = rebuildProductiveAttributionGraph({
    events: [canonical, freight],
    relations: registry.listRelations(),
  });

  const ear = new EconomicAssetRegistry();
  const projected = projectEconomicEvent(ear, canonical, defaultProjectionInstant());
  const mintAuthorized = projected.ok ? eventProjectionCannotMint(ear, projected.value) : false;

  const factoryRobot = classifyObservationRelation({
    fromKind: 'FACTORY_MANUFACTURING_OUTPUT',
    toKind: 'ROBOT_MACHINE_OUTPUT',
    sameUnderlyingEvent: true,
  });
  const freightRelation = classifyObservationRelation({
    fromKind: 'LOGISTICS_DELIVERY',
    toKind: 'GOODS_BATCH_RECORD',
    sameUnderlyingEvent: false,
  });

  const lines = [
    'MoonRey Canonical Productive Economic Event Identity',
    '',
    `Robot R1 manufactures batch B1`,
    `Factory manufacturing claim: ${manufacturingClaim}`,
    `Robot machine-output claim: ${machineClaim}`,
    `Goods record claim: ${goodsClaim}`,
    `Canonical manufacturing eventId: ${canonical.eventId}`,
    `Manufacturing + machine + goods share eventId: ${canonical.claimRefs.length === 3}`,
    `Factory/robot relation: ${factoryRobot.relation}`,
    `Goods record event class: ${goodsRecord.eventClass}`,
    `Freight eventId: ${freight.eventId}`,
    `Freight relation: ${freightRelation.relation} (distinct logistics service)`,
    `Output batch is independent production: ${String(outputBatchIsIndependentProduction(lineage))}`,
    `v3 fingerprint: ${economicEventFingerprintV3(factoryEvidence)}`,
    `v3 factory==robot: ${economicEventFingerprintV3(factoryEvidence) === economicEventFingerprintV3(robotEvidence)}`,
    `Graph rebuild deterministic: ${graph.projectionHash === rebuilt.projectionHash}`,
    `Historical domains: ${JSON.stringify(historicalFingerprintDomains())}`,
    '',
    `EVENT_IDENTITY_AUTHORIZES_MOONREY=${String(eventIdentityCannotAuthorizeIssuance(canonical) || mintAuthorized)}`,
    `RAW_INDUSTRIAL_DATA=${String(graph.containsRawIndustrialData)}`,
    `CROSS_OBJECT_IDENTITY_SUPPORTED=true`,
    `PRODUCTION_ACTIVE=${String(graph.productionActive)}`,
  ];
  return lines.join('\n');
}

const invoked = process.argv[1]?.includes('attribution/demo');
if (invoked) {
  console.log(runMoonreyEconomicEventIdentityDemo());
}

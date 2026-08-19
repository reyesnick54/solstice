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
}

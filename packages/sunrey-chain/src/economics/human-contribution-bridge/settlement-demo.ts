/**
 * Deterministic Chunk 112 demo.
 *
 * Human contribution → registry verification → engineering valuation
 * → simulation conversion policy → settlement authorization →
 * HumanEconomicEvidence → existing MonetaryIssuanceAuthority →
 * simulation SunRey issuance → canonical supply reconciliation.
 *
 * REFERENCE settlement value is not SunRey quantity.
 */

import { asUtcInstant } from '../../../../domain/src/time.ts';
import { fixtureContribution } from '../../../../human-economic-contribution/src/fixtures.ts';
import { DEFAULT_VERIFICATION_POLICY_VERSION } from '../../../../human-economic-contribution/src/fingerprint.ts';
import { HumanContributionRegistry } from '../../../../human-economic-contribution/src/registry.ts';
import {
  simulationValuationPolicy,
  valueVerifiedContribution,
} from '../../../../human-economic-contribution/src/valuation/index.ts';
import { nativeAssetConstitution } from '../constitution.ts';
import { emptyBook, expectedTotal, observedTotal, supplyReconciles } from '../supply.ts';
import {
  AI_AUTHORIZED,
  HumanContributionMonetaryBridge,
  PEVE_USED_AS_TOKEN_FORMULA,
  PRODUCTION_ACTIVATED,
  REFERENCE_VALUE_EQUALS_SUNREY_BY_DEFINITION,
  createValuationSettlementAuthorization,
  simulationConversionPolicy,
  type EngineValuationReference,
  type VerifiedHumanEconomicContribution,
} from './index.ts';

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }): T {
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

export function runHumanContributionSettlementDemo(): {
  readonly referenceSettlementValue: string;
  readonly sunreySimulationQuantity: string;
  readonly referenceValueEqualsSunReyByDefinition: false;
  readonly peveUsedAsFormula: false;
  readonly aiAuthorized: false;
  readonly productionActivated: false;
  readonly supplyReconciled: true;
} {
  const registry = new HumanContributionRegistry();
  const submitted = unwrap(
    registry.submit({
      ...fixtureContribution('COMMUNITY_CONTRIBUTION', 'chunk-112-settlement-demo'),
      measurementQuantity: 5n,
    }),
  );
  const verified = unwrap(
    registry.verify({
      contributionId: submitted.contributionId,
      verificationTimestamp: asUtcInstant('2026-08-19T12:15:00.000Z'),
      verificationPolicyVersion: DEFAULT_VERIFICATION_POLICY_VERSION,
    }),
  );
  if (verified.status !== 'VERIFIED' || !verified.verificationPolicyVersion || !verified.verifiedMeasurement) {
    throw new Error('demo contribution must be registry VERIFIED');
  }
  const jurisdictionPolicyRef = `policy.sim.jurisdiction.${verified.jurisdiction}`;
  const contribution: VerifiedHumanEconomicContribution = Object.freeze({
    contributionId: verified.contributionId,
    fingerprint: verified.fingerprint,
    contributionClass: 'COMMUNITY_CONTRIBUTION',
    verificationState: 'VERIFIED',
    verificationPolicyVersion: verified.verificationPolicyVersion,
    verificationEvidenceDigest: verified.evidenceDigest,
    measurementBasis: 'AUTHORIZED_EVENT_COUNT',
    measurementUnit: verified.measurementUnit,
    measurementPeriod: '2026-08',
    jurisdictionPolicyRef,
    containsRawPersonalData: false,
    pdvSourceExposed: false,
    cleanRoomSourceExposed: false,
    peveScoreUsedAsQuantity: false,
    humanWorthScore: false,
  });
  const valued = valueVerifiedContribution({
    contribution: {
      contributionId: contribution.contributionId,
      fingerprint: contribution.fingerprint,
      status: 'VERIFIED',
      verificationPolicyVersion: contribution.verificationPolicyVersion,
      measurementQuantity: verified.verifiedMeasurement.quantity,
      measurementUnit: contribution.measurementUnit,
      jurisdictionPolicyRef,
      containsRawPersonalData: false,
      peveScoreUsedAsValue: false,
      humanWorthScore: false,
    },
    policy: simulationValuationPolicy({ jurisdictionPolicyRef }),
    actor: 'GOVERNED_PROTOCOL_SIMULATION',
  });
  if (!valued.ok) {
    throw new Error(`demo valuation refused: ${valued.code}`);
  }
  const valuation = valued.result as EngineValuationReference;
  const conversionPolicy = simulationConversionPolicy({
    jurisdictionPolicyRef,
    inputDenomination: valuation.referenceDenomination,
  });
  const authorized = createValuationSettlementAuthorization({
    contribution,
    valuation,
    conversionPolicy,
    authorizedBy: 'GOVERNED_PROTOCOL_SIMULATION',
    authorizationId: 'hcesa.demo.settlement.1',
  });
  if (!authorized.ok) {
    throw new Error(`demo settlement authorization refused: ${authorized.code}`);
  }
  const constitution = nativeAssetConstitution('DEVELOPMENT_ACTIVE');
  const bridge = new HumanContributionMonetaryBridge({ constitution });
  const issued = bridge.attempt(
    {
      recipient: 'acct.human.settlement.demo.1',
      contribution,
      authorization: authorized.authorization,
      valuation,
      conversionPolicy,
      actorKind: 'GOVERNED_PROTOCOL_SIMULATION',
    },
    emptyBook('SUNREY_COIN', constitution.assets[0]!.policyVersion.versionId),
  );
  if (!issued.ok) {
    throw new Error(`demo issuance refused: ${issued.code}`);
  }
  if (
    !supplyReconciles(issued.book) ||
    expectedTotal(issued.book) !== observedTotal(issued.book) ||
    issued.book.issuedPostGenesis !== authorized.authorization.authorizedSunReyQuantity
  ) {
    throw new Error('demo supply failed to reconcile');
  }
  return {
    referenceSettlementValue: authorized.authorization.referenceValue.toString(),
    sunreySimulationQuantity: authorized.authorization.authorizedSunReyQuantity.toString(),
    referenceValueEqualsSunReyByDefinition: REFERENCE_VALUE_EQUALS_SUNREY_BY_DEFINITION,
    peveUsedAsFormula: PEVE_USED_AS_TOKEN_FORMULA,
    aiAuthorized: AI_AUTHORIZED,
    productionActivated: PRODUCTION_ACTIVATED,
    supplyReconciled: true,
  };
}

const report = runHumanContributionSettlementDemo();
console.log(JSON.stringify(report, null, 2));
console.log(`REFERENCE_SETTLEMENT_VALUE=${report.referenceSettlementValue}`);
console.log(`SUNREY_SIMULATION_QUANTITY=${report.sunreySimulationQuantity}`);
console.log('REFERENCE_VALUE_EQUALS_SUNREY_BY_DEFINITION=false');
console.log('PEVE_USED_AS_FORMULA=false');
console.log('AI_AUTHORIZED=false');
console.log('PRODUCTION_ACTIVATED=false');

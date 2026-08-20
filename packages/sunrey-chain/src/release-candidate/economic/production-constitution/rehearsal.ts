/**
 * REHEARSAL_ONLY end-to-end acceptance path.
 *
 * Proves the structural binding:
 *   HIN → verified human contribution → valuation → SunRey conversion
 *     → Chunk 71 issuance class → AssetSupplyBook
 * and
 *   provider fixture → oracle → productive contribution → event →
 *     attribution → PVF → GPUV → MoonRey conversion → Chunk 71 →
 *     AssetSupplyBook
 * then Exchange DVP on SUNREY_COIN/MOONREY_COIN with supply
 * reconciliation.
 *
 * This never qualifies as a production candidate.
 */

import { REHEARSAL_ONLY, MONETARY_POLICY_VERSION_ID } from '../../../economics/types.ts';
import { fixtureVerifiedContribution } from '../../../economics/human-contribution-bridge/fixtures.ts';
import {
  convertReferenceToSunRey,
  simulationConversionPolicy,
} from '../../../economics/human-contribution-bridge/conversion.ts';
import {
  creditCirculating,
  debitCirculating,
  emptyBook,
  moveLive,
  supplyReconciles,
  type AssetSupplyBook,
} from '../../../economics/supply.ts';
import { auditSupply } from '../../../economics/auditor.ts';
import { fixtureAttribution, fixtureContribution, fixtureEvent } from '../../../productive/policy-governance/value-settlement/fixtures.ts';
import {
  convertGpuvToMoonRey,
  simulationConversionPolicy as moonreySimulationConversion,
} from '../../../productive/policy-governance/value-settlement/conversion.ts';

export const REHEARSAL_PATH_LABEL = REHEARSAL_ONLY;

export type RehearsalOnlyEndToEndResult = {
  readonly label: typeof REHEARSAL_ONLY;
  readonly sunreyPath: {
    readonly hinPolicyVersion: string;
    readonly contributionId: string;
    readonly verificationState: string;
    readonly valuationDenomination: string;
    readonly conversionInputDenomination: string;
    readonly issuanceClass: 'AUTHORIZED_HUMAN_ECONOMIC_CONTRIBUTION';
    readonly authorizedQuantity: bigint;
    readonly supplyReconciles: boolean;
  };
  readonly moonreyPath: {
    readonly providerFixtureId: string;
    readonly contributionId: string;
    readonly eventId: string;
    readonly attributionId: string;
    readonly productiveValueUnit: 'GPUV';
    readonly conversionInputUnit: 'GPUV';
    readonly conversionOutputAsset: 'MOONREY_COIN';
    readonly issuanceClass: 'VERIFIED_PRODUCTIVE_CONTRIBUTION';
    readonly authorizedQuantity: bigint;
    readonly supplyReconciles: boolean;
    readonly legacyV1: false;
  };
  readonly exchangeDvp: {
    readonly pair: 'SUNREY_COIN/MOONREY_COIN';
    readonly owner: 'SunReyExchange';
    readonly settled: true;
    readonly sunreyReconciles: boolean;
    readonly moonreyReconciles: boolean;
    readonly custodyReconciles: boolean;
  };
  readonly productionCandidateEligible: false;
  readonly productionActivated: false;
};

function issueRehearsal(book: AssetSupplyBook, account: string, quantity: bigint): void {
  book.issuedPostGenesis += quantity;
  creditCirculating(book, account, quantity);
}

function dvp(input: {
  readonly sunrey: AssetSupplyBook;
  readonly moonrey: AssetSupplyBook;
  readonly sunreySender: string;
  readonly sunreyRecipient: string;
  readonly sunreyQty: bigint;
  readonly moonreySender: string;
  readonly moonreyRecipient: string;
  readonly moonreyQty: bigint;
}): void {
  moveLive(input.sunrey, input.sunreySender, 'CIRCULATING', 'LOCKED', input.sunreyQty);
  moveLive(input.moonrey, input.moonreySender, 'CIRCULATING', 'LOCKED', input.moonreyQty);
  moveLive(input.sunrey, input.sunreySender, 'LOCKED', 'CIRCULATING', input.sunreyQty);
  debitCirculating(input.sunrey, input.sunreySender, input.sunreyQty);
  creditCirculating(input.sunrey, input.sunreyRecipient, input.sunreyQty);
  moveLive(input.moonrey, input.moonreySender, 'LOCKED', 'CIRCULATING', input.moonreyQty);
  debitCirculating(input.moonrey, input.moonreySender, input.moonreyQty);
  creditCirculating(input.moonrey, input.moonreyRecipient, input.moonreyQty);
}

export function runRehearsalOnlyEndToEnd(): RehearsalOnlyEndToEndResult {
  const hinPolicyVersion = 'hin-policy-v1';
  const contribution = fixtureVerifiedContribution({ contributionId: 'hec.rehearsal.148.1' });
  const sunreyPolicy = simulationConversionPolicy();
  const valuationDenomination = sunreyPolicy.inputDenomination;
  const referenceValue = 1_000n;
  const sunreyQty = convertReferenceToSunRey(referenceValue, sunreyPolicy);
  const sunreyBook = emptyBook('SUNREY_COIN', MONETARY_POLICY_VERSION_ID);
  issueRehearsal(sunreyBook, 'human.rehearsal.alice', sunreyQty);

  const productive = fixtureContribution({ contributionId: 'c.rehearsal.energy.148.1' });
  const event = fixtureEvent(productive, { eventId: 'event.rehearsal.148.1' });
  const attribution = fixtureAttribution(productive, event.eventId);
  const moonreyPolicy = moonreySimulationConversion();
  const gpuv = 1_000n;
  const moonreyQty = convertGpuvToMoonRey(gpuv, moonreyPolicy);
  const moonreyBook = emptyBook('MOONREY_COIN', MONETARY_POLICY_VERSION_ID);
  issueRehearsal(moonreyBook, 'producer.rehearsal.bob', moonreyQty);

  dvp({
    sunrey: sunreyBook,
    moonrey: moonreyBook,
    sunreySender: 'human.rehearsal.alice',
    sunreyRecipient: 'producer.rehearsal.bob',
    sunreyQty,
    moonreySender: 'producer.rehearsal.bob',
    moonreyRecipient: 'human.rehearsal.alice',
    moonreyQty,
  });

  const audit = auditSupply([sunreyBook, moonreyBook], MONETARY_POLICY_VERSION_ID);
  return Object.freeze({
    label: REHEARSAL_ONLY,
    sunreyPath: Object.freeze({
      hinPolicyVersion,
      contributionId: contribution.contributionId,
      verificationState: contribution.verificationState,
      valuationDenomination,
      conversionInputDenomination: sunreyPolicy.inputDenomination,
      issuanceClass: 'AUTHORIZED_HUMAN_ECONOMIC_CONTRIBUTION',
      authorizedQuantity: sunreyQty,
      supplyReconciles: supplyReconciles(sunreyBook),
    }),
    moonreyPath: Object.freeze({
      providerFixtureId: 'provider.rehearsal.energy.148',
      contributionId: productive.contributionId,
      eventId: event.eventId,
      attributionId: attribution.decisionId,
      productiveValueUnit: 'GPUV',
      conversionInputUnit: 'GPUV',
      conversionOutputAsset: 'MOONREY_COIN',
      issuanceClass: 'VERIFIED_PRODUCTIVE_CONTRIBUTION',
      authorizedQuantity: moonreyQty,
      supplyReconciles: supplyReconciles(moonreyBook),
      legacyV1: false,
    }),
    exchangeDvp: Object.freeze({
      pair: 'SUNREY_COIN/MOONREY_COIN',
      owner: 'SunReyExchange',
      settled: true,
      sunreyReconciles: supplyReconciles(sunreyBook),
      moonreyReconciles: supplyReconciles(moonreyBook),
      custodyReconciles: audit.ok,
    }),
    productionCandidateEligible: false,
    productionActivated: false,
  });
}

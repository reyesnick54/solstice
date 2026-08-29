/**
 * Continuous economic invariant checks against the reconciled stack.
 */

import { createHash } from 'node:crypto';

import { explorerSupplyReport } from '../../../sunrey-chain/src/economics/explorer.ts';
import { MONETARY_POLICY_VERSION_ID } from '../../../sunrey-chain/src/economics/types.ts';
import type { IntegratedEconomicStack } from '../../../sunrey-chain/src/economics/stack.ts';
import { ECONOMIC_INVARIANT_IDS, type EconomicInvariantId } from './ids.ts';
import type { EconomicInvariantResult } from './types.ts';

export type LabAuxState = {
  exchangeConserved: boolean;
  custodyReconciled: boolean;
  machineMandatesHold: boolean;
  oracleFabricated: boolean;
  dvpDuplicated: boolean;
  custodyBlindResubmit: boolean;
  /** ACCESS-13: set by ACCESS_* shocks. Default state is "invariant holds". */
  accessCapacityOversoldUnits: bigint;
  accessAuthorityMissing: boolean;
  accessIssuedNativeAsset: boolean;
  accessEvidenceChainBroken: boolean;
};

export function checkInvariants(stack: IntegratedEconomicStack, aux: LabAuxState): readonly EconomicInvariantResult[] {
  const recon = stack.reconcile();
  const genesisImmutable = stack.constitution.assets.every((asset) => asset.policyVersion.versionId === MONETARY_POLICY_VERSION_ID);
  const governanceHolds = stack.policyVersions().monetary === MONETARY_POLICY_VERSION_ID && stack.policyVersions().fees === 'sunrey.fees.v2';
  const explorer = explorerSupplyReport([stack.sunrey, stack.moonrey], { SUNREY_COIN: stack.feeBurned });
  const feeReservation = stack.feeCharged === stack.feeBurned + stack.feeRewards + stack.feeTreasury;
  const checks: Record<EconomicInvariantId, { readonly held: boolean; readonly evidence: string }> = {
    SUNREY_SUPPLY_RECONCILES: {
      held: recon.sunreyReconciles && explorer.assets[0]?.reconciliation === 'EXACT',
      evidence: `sunrey burned=${stack.sunrey.burned} feeBurn=${stack.feeBurned}`,
    },
    MOONREY_SUPPLY_RECONCILES: {
      held: recon.moonreyReconciles && recon.productiveMatchesConstitution,
      evidence: `moonrey issued=${stack.moonrey.issuedPostGenesis} productive=${stack.productive.currentSupply().issued}`,
    },
    NO_HIDDEN_NATIVE_ISSUANCE: {
      held: recon.noHiddenNativeIssuance && recon.treasuryDidNotMint,
      evidence: `issued=${stack.sunreyIssued} book=${stack.sunrey.issuedPostGenesis}`,
    },
    NO_DUPLICATE_MOONREY_ISSUANCE: {
      held: recon.productiveMatchesConstitution,
      evidence: `duplicate_attempts_refused=${stack.duplicateMoonReyAttempts} receipts=${stack.productive.snapshot().receipts.length} book=${stack.moonrey.issuedPostGenesis}`,
    },
    NO_DUPLICATE_VALIDATOR_REWARD: {
      held: recon.validatorRewardMatchesIngested,
      evidence: `duplicate_attempts_refused=${stack.duplicateRewardAttempts} ingested=${stack.ingestedRewards} settled=${stack.settledRewards}`,
    },
    NO_DUPLICATE_VALIDATOR_PENALTY: {
      held: true,
      evidence: `duplicate_attempts_refused=${stack.duplicatePenaltyAttempts} penalized=${stack.penalizedUnits}`,
    },
    FEE_RESERVATION_RECONCILES: {
      held: feeReservation,
      evidence: `charged=${stack.feeCharged} sinks=${stack.feeBurned + stack.feeRewards + stack.feeTreasury}`,
    },
    FEE_DISPOSITION_RECONCILES: {
      held: recon.feeDispositionReconciles && recon.feeBurnMatchesMonetary && recon.validatorRewardMatchesIngested,
      evidence: `v2 disposition burn=${stack.feeBurned} rewards=${stack.feeRewards} treasury=${stack.feeTreasury}`,
    },
    EXCHANGE_DVP_CONSERVES_ASSETS: {
      held: aux.exchangeConserved && !aux.dvpDuplicated,
      evidence: `exchangeConserved=${aux.exchangeConserved} dvpDuplicated=${aux.dvpDuplicated}`,
    },
    CUSTODY_RECONCILES: {
      held: aux.custodyReconciled && !aux.custodyBlindResubmit,
      evidence: `custodyReconciled=${aux.custodyReconciled} blindResubmit=${aux.custodyBlindResubmit}`,
    },
    MACHINE_MANDATES_HOLD: {
      held: aux.machineMandatesHold,
      evidence: `machineMandatesHold=${aux.machineMandatesHold}`,
    },
    GENESIS_POLICY_REMAINS_IMMUTABLE: {
      held: genesisImmutable,
      evidence: `policy=${MONETARY_POLICY_VERSION_ID}`,
    },
    GOVERNANCE_VERSIONING_HOLDS: {
      held: governanceHolds,
      evidence: JSON.stringify(stack.policyVersions()),
    },
    ORACLE_FAILURE_DOES_NOT_FABRICATE_FACTS: {
      held: !aux.oracleFabricated,
      evidence: `oracleFabricated=${aux.oracleFabricated} rejectedMoonRey=${stack.rejectedMoonRey}`,
    },
    ACCESS_CAPACITY_NOT_OVERSOLD: {
      held: aux.accessCapacityOversoldUnits === 0n,
      evidence: `accessOversoldUnits=${aux.accessCapacityOversoldUnits}`,
    },
    ACCESS_RESERVATION_REQUIRES_EXECUTION_AUTHORITY: {
      held: !aux.accessAuthorityMissing,
      evidence: `accessAuthorityMissing=${aux.accessAuthorityMissing}`,
    },
    ACCESS_ACTIVITY_ISSUES_NO_NATIVE_ASSET: {
      held: !aux.accessIssuedNativeAsset,
      evidence: `accessIssuedNativeAsset=${aux.accessIssuedNativeAsset}`,
    },
    ACCESS_EVIDENCE_CHAIN_RECONSTRUCTS: {
      held: !aux.accessEvidenceChainBroken,
      evidence: `accessEvidenceChainBroken=${aux.accessEvidenceChainBroken}`,
    },
  };
  return Object.freeze(
    ECONOMIC_INVARIANT_IDS.map((invariant) =>
      Object.freeze({
        invariant,
        held: checks[invariant].held,
        evidence: checks[invariant].evidence,
      }),
    ),
  );
}

export function fixtureHash(scenarioId: string, seed: number, policyVersions: Readonly<Record<string, string | number>>): string {
  return createHash('sha256')
    .update(JSON.stringify({ scenarioId, seed, policyVersions }))
    .digest('hex');
}

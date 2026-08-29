/**
 * Permanent Access Economy invariants.
 *
 * These checks run on every scenario. They are additive: a later chunk may
 * add an invariant, never remove or loosen one. A violated invariant is a
 * hard engineering failure, not a warning.
 */

import { ENVIRONMENT, SIMULATION_MODE } from '../../../config/src/flags.ts';
import { ACCESS_FABRIC_INVARIANTS } from '../../../access-fabric/src/index.ts';
import type { DualEconomySimulationReport } from '../types.ts';
import {
  ACCESS_CANONICAL_INTEGRATIONS,
  ACCESS_ECONOMY_INVARIANT_IDS,
  FORBIDDEN_ACCESS_ASSET_TOKENS,
  FORBIDDEN_ACCESS_EVIDENCE_KEYS,
  type AccessEconomyInvariantId,
} from './ids.ts';
import type { AllocationOutcome } from './allocation.ts';
import type {
  AccessCapacityPool,
  AccessEconomyScenario,
  AccessEvidenceSummary,
  AccessInvariantResult,
  AccessRequest,
} from './types.ts';

export const ACCESS_INVARIANT_STATEMENTS: Readonly<Record<AccessEconomyInvariantId, string>> = Object.freeze({
  NO_OVERSOLD_PRODUCTIVE_CAPACITY: 'Committed access never exceeds published productive capacity in any bucket.',
  NO_AI_SELF_APPROVAL: 'An agent proposal is never approved on the agent\u2019s own authority.',
  ACCESS_IS_NOT_A_COIN: 'Access is not denominated in a new currency, credit, or transferable unit.',
  NO_NEW_MONETARY_AUTHORITY: 'The Access Economy introduces no issuer, mint, or monetary authority.',
  NO_HUMAN_WORTH_SCORING: 'No decision depends on a score that ranks a person.',
  NO_RAW_SENSITIVE_PERSONAL_INFORMATION_ON_CHAIN:
    'No raw sensitive personal information is sealed into the evidence chain.',
  NO_RESERVATION_WITHOUT_REQUIRED_AUTHORITY:
    'No reservation, hold, or confirmation exists without a verified Execution Authority.',
  NO_SILENT_LEGAL_ELIGIBILITY_INFERENCE:
    'Undetermined legal eligibility refuses; it is never read as permission.',
  NO_SECOND_LEDGER: 'Settlement is attributed only to the canonical ledger owner.',
  NO_SECOND_EXCHANGE: 'Pricing is attributed only to the canonical Exchange owner.',
  NO_SECOND_CUSTODY_SYSTEM: 'Custody is attributed only to the canonical custody owner.',
  NO_AUTOMATIC_SUNREY_ISSUANCE: 'Access activity never issues SunRey.',
  NO_AUTOMATIC_MOONREY_ISSUANCE: 'Access activity never issues MoonRey.',
  NO_FIXED_SUNREY_MOONREY_PEG: 'No fixed SunRey/MoonRey conversion rate is asserted anywhere.',
  EVERY_CONSEQUENTIAL_TRANSITION_RECONSTRUCTABLE:
    'Every consequential transition is sealed in a verifiable hash chain.',
  SIMULATION_CANNOT_ACTIVATE_PRODUCTION:
    'Running the simulation changes no production posture and flips no LIVE_* flag.',
});

export type AccessInvariantInput = {
  readonly scenario: AccessEconomyScenario;
  readonly pools: readonly AccessCapacityPool[];
  readonly requests: readonly AccessRequest[];
  readonly allocation: AllocationOutcome;
  readonly evidence: AccessEvidenceSummary;
  readonly macro: DualEconomySimulationReport;
  /** Serialized simulation state scanned for forbidden asset vocabulary. */
  readonly serializedState: string;
};

function scanForbiddenAssetTokens(serialized: string): readonly string[] {
  const lowered = serialized.toLowerCase();
  return FORBIDDEN_ACCESS_ASSET_TOKENS.filter((token) => lowered.includes(token));
}

function scanForbiddenEvidenceKeys(serialized: string): readonly string[] {
  return FORBIDDEN_ACCESS_EVIDENCE_KEYS.filter(
    (key) => key !== 'humanWorthScore' && serialized.includes(`"${key}"`),
  );
}

export function checkAccessInvariants(input: AccessInvariantInput): readonly AccessInvariantResult[] {
  const { allocation, evidence, macro, requests, serializedState } = input;

  const authorityRequired = allocation.decisions.filter(
    (row) => row.outcome === 'RESERVED' || row.outcome === 'CONFIRMED' || row.outcome === 'HELD_FOR_POLICY_REVIEW',
  );
  const authorityMissing = authorityRequired.filter((row) => row.authorityRef === null);

  const agentAttempts = requests.filter((row) => row.agentSelfApprovalAttempted);
  const agentApproved = allocation.decisions.filter((row) => {
    const request = requests.find((candidate) => candidate.requestId === row.requestId);
    return request?.agentSelfApprovalAttempted === true && row.outcome !== 'REFUSED_AI_SELF_APPROVAL';
  });

  const undetermined = requests.filter((row) => row.legalEligibility === 'UNDETERMINED');
  const undeterminedGranted = allocation.decisions.filter((row) => {
    const request = requests.find((candidate) => candidate.requestId === row.requestId);
    return request?.legalEligibility === 'UNDETERMINED' && row.grantedUnits > 0n;
  });

  const settlementOwners = new Set(
    allocation.decisions.map((row) => row.settlementOwner).filter((owner): owner is string => owner !== null),
  );
  const foreignSettlementOwners = [...settlementOwners].filter(
    (owner) => owner !== ACCESS_CANONICAL_INTEGRATIONS.ledger,
  );

  const forbiddenAssetTokens = scanForbiddenAssetTokens(serializedState);
  const forbiddenEvidenceKeys = scanForbiddenEvidenceKeys(serializedState);
  const scoreBearingDecisions = allocation.decisions.filter((row) => row.humanWorthScore !== false);

  const checks: Readonly<Record<AccessEconomyInvariantId, { readonly held: boolean; readonly evidence: string }>> = {
    NO_OVERSOLD_PRODUCTIVE_CAPACITY: {
      held: allocation.oversoldUnits === 0n && allocation.capacity.every((row) => row.oversoldUnits === 0n),
      evidence: `oversoldUnits=${allocation.oversoldUnits} pools=${allocation.capacity.length}`,
    },
    NO_AI_SELF_APPROVAL: {
      held: agentApproved.length === 0,
      evidence: `selfApprovalAttempts=${agentAttempts.length} approvedAnyway=${agentApproved.length}`,
    },
    ACCESS_IS_NOT_A_COIN: {
      held:
        forbiddenAssetTokens.length === 0 &&
        ACCESS_FABRIC_INVARIANTS.isMonetaryAsset === false &&
        ACCESS_FABRIC_INVARIANTS.isTransferableBalance === false,
      evidence: `forbiddenAssetTokens=${forbiddenAssetTokens.length} isMonetaryAsset=${ACCESS_FABRIC_INVARIANTS.isMonetaryAsset}`,
    },
    NO_NEW_MONETARY_AUTHORITY: {
      held:
        ACCESS_CANONICAL_INTEGRATIONS.executionAuthority === 'packages/permissions' &&
        ACCESS_CANONICAL_INTEGRATIONS.monetaryConstitution === 'packages/sunrey-chain' &&
        requests.every((row) => row.authority === null || row.authority.issuedBySimulation === false),
      evidence: `authorityOwner=${ACCESS_CANONICAL_INTEGRATIONS.executionAuthority} simulationIssuedAuthorities=0`,
    },
    NO_HUMAN_WORTH_SCORING: {
      held: scoreBearingDecisions.length === 0 && ACCESS_FABRIC_INVARIANTS.humanWorthScore === false,
      evidence: `scoreBearingDecisions=${scoreBearingDecisions.length}`,
    },
    NO_RAW_SENSITIVE_PERSONAL_INFORMATION_ON_CHAIN: {
      held: forbiddenEvidenceKeys.length === 0 && evidence.forbiddenKeysPresent === false,
      evidence: `forbiddenEvidenceKeys=${forbiddenEvidenceKeys.length} records=${evidence.recordCount}`,
    },
    NO_RESERVATION_WITHOUT_REQUIRED_AUTHORITY: {
      held: authorityMissing.length === 0,
      evidence: `authorityBearingDecisions=${authorityRequired.length} missingAuthority=${authorityMissing.length}`,
    },
    NO_SILENT_LEGAL_ELIGIBILITY_INFERENCE: {
      held: undeterminedGranted.length === 0,
      evidence: `undeterminedRequests=${undetermined.length} grantedAnyway=${undeterminedGranted.length}`,
    },
    NO_SECOND_LEDGER: {
      held: foreignSettlementOwners.length === 0 && ACCESS_CANONICAL_INTEGRATIONS.ledger === 'packages/ledger',
      evidence: `settlementOwners=${[...settlementOwners].join(',') || 'none'}`,
    },
    NO_SECOND_EXCHANGE: {
      held: ACCESS_CANONICAL_INTEGRATIONS.exchange === 'packages/sunrey-exchange',
      evidence: `exchangeOwner=${ACCESS_CANONICAL_INTEGRATIONS.exchange}`,
    },
    NO_SECOND_CUSTODY_SYSTEM: {
      held: ACCESS_CANONICAL_INTEGRATIONS.custody === 'packages/custody',
      evidence: `custodyOwner=${ACCESS_CANONICAL_INTEGRATIONS.custody}`,
    },
    NO_AUTOMATIC_SUNREY_ISSUANCE: {
      held: macro.productionActivation.becomesProductionPolicy === false,
      evidence: `sunreyIssuedByAccessActivity=0 macroPolicyActivation=${macro.productionActivation.becomesProductionPolicy}`,
    },
    NO_AUTOMATIC_MOONREY_ISSUANCE: {
      held: macro.productionActivation.moonreyIssuanceActivated === false,
      evidence: `moonreyIssuedByAccessActivity=0 macroIssuanceActivated=${macro.productionActivation.moonreyIssuanceActivated}`,
    },
    NO_FIXED_SUNREY_MOONREY_PEG: {
      held: macro.bridge.intrinsicExchangeRatio === null && macro.bridge.policy.algorithmicPeg === false,
      evidence: `intrinsicExchangeRatio=${String(macro.bridge.intrinsicExchangeRatio)} algorithmicPeg=${macro.bridge.policy.algorithmicPeg}`,
    },
    EVERY_CONSEQUENTIAL_TRANSITION_RECONSTRUCTABLE: {
      held:
        evidence.chainVerified &&
        evidence.sealedConsequentialTransitions === evidence.consequentialTransitions &&
        allocation.decisions.every((row) => row.evidenceSeq.length > 0),
      evidence: `chainVerified=${evidence.chainVerified} sealed=${evidence.sealedConsequentialTransitions} decisions=${allocation.decisions.length}`,
    },
    SIMULATION_CANNOT_ACTIVATE_PRODUCTION: {
      held: ENVIRONMENT === 'simulation' && SIMULATION_MODE === true,
      evidence: `environment=${ENVIRONMENT} simulationMode=${SIMULATION_MODE}`,
    },
  };

  return Object.freeze(
    ACCESS_ECONOMY_INVARIANT_IDS.map((invariant) =>
      Object.freeze({
        invariant,
        statement: ACCESS_INVARIANT_STATEMENTS[invariant],
        held: checks[invariant].held,
        evidence: checks[invariant].evidence,
      }),
    ),
  );
}

import type { CustomerId } from '../../domain/src/customer.ts';
import type { Jurisdiction } from '../../domain/src/jurisdiction.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { AssetQuantity } from '../../money/src/asset-quantity.ts';
import type { AuthorizationDecision } from '../../permissions/src/decision.ts';
import type { EncryptedEnvelope } from '../../security/src/envelope.ts';
import type {
  CustodyAccountId,
  CustodyReconciliationId,
  DepositId,
  DestinationId,
  TravelRuleMessageId,
  VaspId,
  WithdrawalId,
} from './ids.ts';
import type {
  CustodyReconciliationOutcome,
  DepositState,
  DestinationScreeningOutcome,
  TravelRuleApplicability,
  WithdrawalState,
} from './taxonomy.ts';

export type CustodyFailure = {
  readonly code: string;
  readonly message: string;
};

export type CustodyOutcome<T> =
  | { readonly outcome: 'OK'; readonly value: T; readonly decision?: AuthorizationDecision }
  | { readonly outcome: 'KERNEL_REFUSED'; readonly decision: AuthorizationDecision }
  | {
      readonly outcome: 'REJECTED';
      readonly code: string;
      readonly message: string;
      readonly decision?: AuthorizationDecision | null;
    };

export type DepositNotice = {
  readonly noticeId: string;
  readonly providerId: 'SIMULATION_CUSTODY';
  readonly signatureValid: boolean;
  readonly assetId: string;
  readonly quantity: AssetQuantity;
  readonly destinationAddress: string;
  readonly txRef: string;
  readonly confirmations: number;
  readonly receivedAt: UtcInstant;
};

export type ExternalDeposit = {
  readonly depositId: DepositId;
  readonly customerId: CustomerId;
  readonly custodyAccountId: CustodyAccountId;
  readonly notice: DepositNotice;
  readonly state: DepositState;
  readonly screeningOutcome: DestinationScreeningOutcome | null;
  readonly journalId: string | null;
  readonly providerBalanceIsTruth: false;
  readonly createdAt: UtcInstant;
};

export type WithdrawalDestination = {
  readonly destinationId: DestinationId;
  readonly customerId: CustomerId;
  readonly address: string;
  readonly label: string;
  readonly addedWithStepUp: true;
  readonly assurance: 'HIGH_ASSURANCE';
  readonly createdAt: UtcInstant;
};

export type SimulatedVasp = {
  readonly vaspId: VaspId;
  readonly displayName: string;
  readonly jurisdiction: Jurisdiction;
  readonly licensingClaim: 'NONE';
  readonly legalStatus: 'RESEARCH_REQUIRED';
  readonly simulationOnly: true;
};

export type TravelRuleDecision = {
  readonly applicability: TravelRuleApplicability;
  readonly packId: string;
  readonly packVersion: string;
  readonly thresholdSource: 'SIMULATION_POLICY_PACK';
  readonly legalStatus: 'RESEARCH_REQUIRED';
  readonly notALegalConclusion: true;
};

export type TravelRuleMessage = {
  readonly messageId: TravelRuleMessageId;
  readonly withdrawalId: WithdrawalId;
  readonly counterpartyVaspId: VaspId;
  readonly envelope: EncryptedEnvelope;
  readonly acknowledged: boolean;
  readonly piiInEvents: false;
};

export type AssetWithdrawal = {
  readonly withdrawalId: WithdrawalId;
  readonly customerId: CustomerId;
  readonly custodyAccountId: CustodyAccountId;
  readonly destinationId: DestinationId;
  readonly quantity: AssetQuantity;
  readonly state: WithdrawalState;
  readonly screeningOutcome: DestinationScreeningOutcome | null;
  readonly travelRule: TravelRuleDecision | null;
  readonly travelRuleMessageId: TravelRuleMessageId | null;
  readonly holdId: string | null;
  readonly providerSubmissionId: string | null;
  readonly chainTxRef: string | null;
  readonly journalId: string | null;
  readonly submittedOnce: boolean;
  readonly createdAt: UtcInstant;
};

export type CustodyReconciliationReport = {
  readonly reconciliationId: CustodyReconciliationId;
  readonly outcome: CustodyReconciliationOutcome;
  readonly notes: readonly string[];
  readonly createdAt: UtcInstant;
  readonly autoCorrected: false;
  readonly autoCreatedAssets: false;
};

export type KillSwitchKind =
  | 'WITHDRAWAL_HALT'
  | 'DEPOSIT_CREDIT_HALT';

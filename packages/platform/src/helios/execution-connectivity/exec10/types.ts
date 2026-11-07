import type { CustomerId, UtcInstant } from '@solstice/domain';
import type {
  GrowFinancingPostureFlag,
  HELIOS_EXEC10_SCHEMA,
  BuyingPowerValidationState,
  MarginEnablementGate,
  ShortEnablementGate,
} from './taxonomy.ts';

/** Ledger-anchored cash breakdown — no stored balance authority here. */
export type CashBalanceState = {
  readonly schemaVersion: typeof HELIOS_EXEC10_SCHEMA;
  readonly customerId: CustomerId;
  readonly brokerageAccountId: string;
  readonly currency: string;
  /** Total cash (settled + unsettled cash components). */
  readonly cashMinor: string;
  readonly settledCashMinor: string;
  readonly unsettledCashMinor: string;
  readonly reservedCashMinor: string;
  /** Executable cash for new long purchases under current posture. */
  readonly availableToTradeMinor: string;
  readonly availableToWithdrawMinor: string;
  readonly asOf: UtcInstant;
  readonly serverCalculated: true;
};

/** Provider-reported buying power remains informational until mandate and Risk validate. */
export type BuyingPowerState = {
  readonly schemaVersion: typeof HELIOS_EXEC10_SCHEMA;
  readonly customerId: CustomerId;
  readonly brokerageAccountId: string;
  readonly currency: string;
  readonly providerId: string;
  readonly brokerReportedAvailableMinor: string;
  readonly validationState: BuyingPowerValidationState;
  readonly executableBuyingPowerMinor: string;
  readonly limitingSource:
    | 'BROKER'
    | 'SUNREY_CAPITAL'
    | 'RISK'
    | 'CUSTOMER_MANDATE'
    | 'CASH_POSTURE'
    | 'RECONCILIATION';
  readonly asOf: UtcInstant;
};

export type MarginGateSnapshot = {
  readonly gate: MarginEnablementGate;
  readonly open: boolean;
};

export type MarginState = {
  readonly schemaVersion: typeof HELIOS_EXEC10_SCHEMA;
  readonly marginEnabled: false;
  readonly gates: readonly MarginGateSnapshot[];
  readonly brokerReportedExcessMinor: string | null;
  readonly ignoredForExecution: true;
  readonly asOf: UtcInstant;
};

export type ShortGateSnapshot = {
  readonly gate: ShortEnablementGate;
  readonly satisfied: boolean;
};

export type BorrowState = {
  readonly schemaVersion: typeof HELIOS_EXEC10_SCHEMA;
  readonly shortingEnabled: false;
  readonly borrowAvailable: false;
  readonly gates: readonly ShortGateSnapshot[];
  readonly asOf: UtcInstant;
};

export type FinancingAllocationCaps = {
  readonly brokerAvailableMinor: string;
  readonly sunreyCapitalAllocationMinor: string;
  readonly riskAllocationMinor: string;
  readonly customerMandateMinor: string;
};

export type FinancingState = {
  readonly schemaVersion: typeof HELIOS_EXEC10_SCHEMA;
  readonly customerId: CustomerId;
  readonly brokerageAccountId: string;
  readonly currency: string;
  readonly posture: readonly GrowFinancingPostureFlag[];
  readonly cash: CashBalanceState;
  readonly buyingPower: BuyingPowerState;
  readonly margin: MarginState;
  readonly borrow: BorrowState;
  readonly executableBuyingPowerMinor: string;
  readonly providerBuyingPowerInformationalOnly: true;
  readonly asOf: UtcInstant;
};

/**
 * EXEC01 — production-shaped external broker connectivity domain types.
 * Money fields use integer minor-unit strings; quantities use scaled unit strings.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  BrokerConnectivityState,
  HELIOS_EXEC01_CONNECTIVITY_AUTHORITY,
  HELIOS_EXEC01_CONNECTIVITY_SCHEMA,
} from './taxonomy.ts';

export type BrokerProviderId = string & { readonly __brand: 'BrokerProviderId' };

export type BrokerAccountId = string & { readonly __brand: 'BrokerAccountId' };

export type BrokerSessionId = string & { readonly __brand: 'BrokerSessionId' };

export type BrokerOrderRequestId = string & { readonly __brand: 'BrokerOrderRequestId' };

export type BrokerExecutionReportId = string & { readonly __brand: 'BrokerExecutionReportId' };

export type BrokerFillId = string & { readonly __brand: 'BrokerFillId' };

export type BrokerSettlementId = string & { readonly __brand: 'BrokerSettlementId' };

export type BrokerCorporateActionId = string & { readonly __brand: 'BrokerCorporateActionId' };

/** Canonical broker adapter contract. Does not issue Execution Authority. */
export interface BrokerProvider {
  readonly schema: typeof HELIOS_EXEC01_CONNECTIVITY_SCHEMA;
  readonly authority: typeof HELIOS_EXEC01_CONNECTIVITY_AUTHORITY;
  readonly providerId: BrokerProviderId;
  readonly connectivityState: BrokerConnectivityState;
  readonly environment: 'SIMULATION' | 'SANDBOX' | 'PAPER';
  readonly liveProviderConnected: false;
  readonly productionAuthorized: false;
  readonly grantsExecutionAuthority: false;
  readonly submitOrder(request: BrokerOrderRequest): BrokerSubmitOutcome;
  readonly cancelOrder(request: BrokerOrderRequest): BrokerCancelOutcome;
  readonly queryOrder(externalOperationId: string): BrokerQueryOutcome;
  readonly querySession(sessionId: BrokerSessionId): BrokerSessionSnapshot | null;
}

export type BrokerProviderRegistration = {
  readonly schema: typeof HELIOS_EXEC01_CONNECTIVITY_SCHEMA;
  readonly providerId: BrokerProviderId;
  readonly displayName: string;
  readonly connectivityState: BrokerConnectivityState;
  readonly supportedVenues: readonly string[];
  readonly supportedOrderTypes: readonly ('MARKET' | 'LIMIT')[];
  readonly credentialRef: string | null;
  readonly registeredAt: UtcInstant;
  readonly legalAuthorizationImplied: false;
  readonly liveProviderConnected: false;
};

export type BrokerAccount = {
  readonly schema: typeof HELIOS_EXEC01_CONNECTIVITY_SCHEMA;
  readonly brokerAccountId: BrokerAccountId;
  readonly customerId: string;
  readonly canonicalAccountId: string | null;
  readonly providerId: BrokerProviderId;
  readonly providerAccountRef: string;
  readonly baseCurrency: string;
  readonly connectivityState: BrokerConnectivityState;
  readonly openedAt: UtcInstant;
  readonly simulation: true;
  readonly productionAuthorized: false;
};

export type BrokerSession = {
  readonly schema: typeof HELIOS_EXEC01_CONNECTIVITY_SCHEMA;
  readonly sessionId: BrokerSessionId;
  readonly providerId: BrokerProviderId;
  readonly brokerAccountId: BrokerAccountId;
  readonly connectivityState: BrokerConnectivityState;
  readonly establishedAt: UtcInstant;
  readonly expiresAt: UtcInstant | null;
  readonly sessionTokenRef: string | null;
  readonly readOnly: boolean;
  readonly orderEntryEnabled: boolean;
  readonly liveProviderConnected: false;
};

export type BrokerOrderRequest = {
  readonly schema: typeof HELIOS_EXEC01_CONNECTIVITY_SCHEMA;
  readonly requestId: BrokerOrderRequestId;
  readonly externalOperationId: string;
  readonly brokerAccountId: BrokerAccountId;
  readonly providerId: BrokerProviderId;
  readonly instrumentId: string;
  readonly side: 'BUY' | 'SELL';
  readonly quantityUnits: string;
  readonly orderType: 'MARKET' | 'LIMIT';
  readonly limitPriceMinorUnits: string | null;
  readonly currency: string;
  readonly timeInForce: string;
  readonly idempotencyKey: string;
  readonly reservationId: string | null;
  readonly submittedAt: UtcInstant;
  readonly simulation: true;
  readonly liveSecuritiesExecution: false;
};

export type BrokerExecutionReport = {
  readonly schema: typeof HELIOS_EXEC01_CONNECTIVITY_SCHEMA;
  readonly reportId: BrokerExecutionReportId;
  readonly requestId: BrokerOrderRequestId;
  readonly providerOrderId: string;
  readonly status: 'ACKNOWLEDGED' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'REJECTED' | 'PENDING';
  readonly remainingQuantityUnits: string;
  readonly fills: readonly BrokerFill[];
  readonly evidenceRef: string | null;
  readonly reportedAt: UtcInstant;
  readonly simulation: true;
};

export type BrokerFill = {
  readonly schema: typeof HELIOS_EXEC01_CONNECTIVITY_SCHEMA;
  readonly fillId: BrokerFillId;
  readonly requestId: BrokerOrderRequestId;
  readonly providerFillId: string;
  readonly instrumentId: string;
  readonly quantityUnits: string;
  readonly priceMinorUnits: string;
  readonly notionalMinorUnits: string;
  readonly feeMinorUnits: string;
  readonly currency: string;
  readonly venue: string | null;
  readonly liquidityRole: 'MAKER' | 'TAKER' | null;
  readonly executedAt: UtcInstant;
  readonly simulation: true;
  readonly liveSecuritiesExecution: false;
};

export type BrokerPosition = {
  readonly schema: typeof HELIOS_EXEC01_CONNECTIVITY_SCHEMA;
  readonly brokerAccountId: BrokerAccountId;
  readonly instrumentId: string;
  readonly quantityUnits: string;
  readonly costBasisMinorUnits: string | null;
  readonly currency: string;
  readonly asOf: UtcInstant;
  readonly providerView: 'NOT_LEDGER_AUTHORITY';
  readonly simulation: true;
};

export type BrokerCashBalance = {
  readonly schema: typeof HELIOS_EXEC01_CONNECTIVITY_SCHEMA;
  readonly brokerAccountId: BrokerAccountId;
  readonly currency: string;
  readonly settledCashMinorUnits: string;
  readonly pendingCashMinorUnits: string;
  readonly asOf: UtcInstant;
  readonly simulation: true;
};

export type BrokerBuyingPower = {
  readonly schema: typeof HELIOS_EXEC01_CONNECTIVITY_SCHEMA;
  readonly brokerAccountId: BrokerAccountId;
  readonly currency: string;
  readonly cashMinorUnits: string;
  readonly reservedMinorUnits: string;
  readonly buyingPowerMinorUnits: string;
  readonly asOf: UtcInstant;
  readonly simulation: true;
};

export type BrokerSettlement = {
  readonly schema: typeof HELIOS_EXEC01_CONNECTIVITY_SCHEMA;
  readonly settlementId: BrokerSettlementId;
  readonly fillId: BrokerFillId;
  readonly brokerAccountId: BrokerAccountId;
  readonly assetLeg: { readonly instrumentId: string; readonly quantityUnits: string };
  readonly cashLeg: { readonly minorUnits: string; readonly currency: string };
  readonly expectedSettlementDate: UtcInstant;
  readonly actualSettlementDate: UtcInstant | null;
  readonly status: 'PENDING' | 'SETTLED' | 'FAILED';
  readonly custodyState: string | null;
  readonly ledgerJournalRef: string | null;
  readonly evidenceRef: string | null;
  readonly simulation: true;
};

export type BrokerCorporateAction = {
  readonly schema: typeof HELIOS_EXEC01_CONNECTIVITY_SCHEMA;
  readonly corporateActionId: BrokerCorporateActionId;
  readonly instrumentId: string;
  readonly actionKind: 'DIVIDEND' | 'SPLIT' | 'MERGER' | 'SPINOFF' | 'OTHER';
  readonly recordDate: UtcInstant;
  readonly payableDate: UtcInstant | null;
  readonly cashAmountMinorUnits: string | null;
  readonly newSharesPerOldShare: string | null;
  readonly currency: string | null;
  readonly providerRef: string;
  readonly simulation: true;
};

export type BrokerSessionSnapshot = {
  readonly session: BrokerSession;
  readonly cash: readonly BrokerCashBalance[];
  readonly buyingPower: BrokerBuyingPower | null;
  readonly positions: readonly BrokerPosition[];
};

export type BrokerSubmitOutcome =
  | { readonly outcome: 'ACKNOWLEDGED' | 'REJECTED' | 'PENDING'; readonly providerOrderId: string; readonly evidenceRef: string }
  | { readonly outcome: 'TIMEOUT'; readonly evidenceRef: string | null }
  | { readonly outcome: 'UNAVAILABLE'; readonly message: string };

export type BrokerCancelOutcome =
  | { readonly outcome: 'CANCEL_ACKNOWLEDGED' | 'CANCEL_REJECTED' | 'PENDING'; readonly evidenceRef: string }
  | { readonly outcome: 'UNAVAILABLE'; readonly message: string };

export type BrokerQueryOutcome =
  | {
      readonly found: true;
      readonly providerOrderId: string;
      readonly report: BrokerExecutionReport;
      readonly evidenceRef: string;
    }
  | { readonly found: false; readonly evidenceRef: string | null };

export type BrokerConnectivityEnvelope = {
  readonly schema: typeof HELIOS_EXEC01_CONNECTIVITY_SCHEMA;
  readonly provider: BrokerProviderRegistration;
  readonly account: BrokerAccount;
  readonly session: BrokerSession | null;
  readonly connectivityState: BrokerConnectivityState;
  readonly grantsExecutionAuthority: false;
  readonly liveInvestmentExecution: false;
};

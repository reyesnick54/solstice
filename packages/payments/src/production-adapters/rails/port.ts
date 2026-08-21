/**
 * Production payment-rail adapter contract.
 *
 * Extends the canonical RailAdapter. Simulation and future vendor
 * adapters implement this same surface. Adapters never post journals
 * or issue Execution Authority.
 */

import type { Money } from '../../../../money/src/money.ts';
import type {
  AuthorizedRailCommand,
  RailAdapter,
  RailCancelResult,
  RailQueryResponse,
  RailReturnMessage,
  RailSubmitResult,
  RailValidateRouteResponse,
} from '../../rail-port.ts';
import type { RailMessageReferences } from '../../rail-ids.ts';
import type { CanonicalRailStatus } from '../../rail-types.ts';
import type { AdapterHealth, NormalizedPaymentStatus, ProviderLifecycleState } from '../types.ts';
import type { PaymentRailProductKind } from './kinds.ts';
import type { NormalizedPaymentState } from './status.ts';

export type PaymentQuoteRouteInfo = {
  readonly kind: PaymentRailProductKind;
  readonly providerId: string;
  readonly estimatedSettlementClass: 'BATCH' | 'INSTANT' | 'CORRESPONDENT';
  readonly cancellationSupported: boolean;
  readonly liveConnected: false;
  readonly namedNetworkMembership: false;
};

export type RetrievedPaymentTransaction = {
  readonly found: boolean;
  readonly status: CanonicalRailStatus;
  readonly normalized: NormalizedPaymentStatus;
  readonly references: RailMessageReferences;
  readonly originalProviderStatus: string;
};

export type RetrievedPaymentReturn = {
  readonly found: boolean;
  readonly message: RailReturnMessage | null;
};

export type ProductionRailAdapter = RailAdapter & {
  readonly lifecycle: ProviderLifecycleState;
  readonly productKind: PaymentRailProductKind;
  readonly canPostLedger: false;
  readonly canIssueExecutionAuthority: false;
  quoteRoute(): PaymentQuoteRouteInfo;
  retrieveTransaction(paymentId: string): RetrievedPaymentTransaction;
  retrieveReturn(paymentId: string): RetrievedPaymentReturn;
  retrieveSettlementReference(paymentId: string): string | null;
  normalizeStatus(providerStatus: string): NormalizedPaymentState;
  productionHealth(): AdapterHealth;
};

export type ProductionRailSubmitResult = RailSubmitResult & {
  readonly normalized: NormalizedPaymentState;
};

export type ProductionRailQueryResponse = RailQueryResponse & {
  readonly normalized: NormalizedPaymentState;
};

export type ProductionRailSurface = {
  readonly validateRoute: RailAdapter['validateRoute'];
  readonly submitPayment: (command: AuthorizedRailCommand) => RailSubmitResult;
  readonly queryPayment: RailAdapter['queryPayment'];
  readonly cancelPayment: (request: Parameters<RailAdapter['cancelPayment']>[0]) => RailCancelResult;
  readonly quoteRoute: () => PaymentQuoteRouteInfo;
  readonly retrieveTransaction: (paymentId: string) => RetrievedPaymentTransaction;
  readonly retrieveReturn: (paymentId: string) => RetrievedPaymentReturn;
  readonly retrieveSettlementReference: (paymentId: string) => string | null;
};

export function assertRailAdapterSurface(adapter: ProductionRailAdapter): RailValidateRouteResponse | true {
  void adapter.capability;
  return true;
}

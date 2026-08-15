import type { Money } from '../../money/src/money.ts';
import type { ExecutionAuthority } from '../../permissions/src/execution-authority.ts';
import type { PaymentRoute, RouteHardConstraints, RouteRejection } from './route.ts';

/**
 * Optional treasury advisor used by the existing PaymentsService.
 * Defined here so packages/payments does not depend on packages/treasury.
 */
export type TreasuryAdvisorReserveInput = {
  readonly paymentId: string;
  readonly corridorId: string;
  readonly provider: string;
  readonly requiredLiquidity: Money;
  readonly authority: ExecutionAuthority;
  readonly idempotencyKey: string;
};

export type TreasuryRouteAdvice = {
  readonly chosen: PaymentRoute | null;
  readonly rejected: readonly RouteRejection[];
  readonly explanation: {
    readonly routingVersion: string;
    readonly selectedRouteId: string | null;
    readonly eligible: readonly string[];
    readonly rejected: readonly RouteRejection[];
    readonly whySelected: string;
  };
};

export type TreasuryAdvisor = {
  selectForPayment(
    candidates: readonly PaymentRoute[],
    constraints: RouteHardConstraints,
    facts: {
      readonly requiredLiquidity: Money;
      readonly destinationCountry: string;
      readonly sourceJurisdiction: string;
      readonly destinationJurisdiction: string;
      readonly sourceCurrency: string;
      readonly destinationCurrency: string;
      readonly acceptedQuoteRequired: boolean;
      readonly quoteAccepted: boolean;
      readonly customerAccountActive: boolean;
      readonly securityHold: boolean;
    },
  ): TreasuryRouteAdvice;
  rememberDecision(paymentId: string, explanation: TreasuryRouteAdvice['explanation']): void;
  reserveForPayment(
    input: TreasuryAdvisorReserveInput,
  ): { ok: true; reservationId: string } | { ok: false; code: string; message: string };
  onPaymentSettled(paymentId: string, authority: ExecutionAuthority): void;
  onPaymentFailed(paymentId: string, authority: ExecutionAuthority, reason: string): void;
  onSubmissionUnknown(paymentId: string): void;
};

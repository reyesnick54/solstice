import { Money } from '@solstice/domain';
import { LIVE_FLAGS, assertSimulationOnly } from '@solstice/kernel';

export const RAIL_IDS = ['domestic', 'sepa_like', 'swift_like', 'instant'] as const;
export type RailId = (typeof RAIL_IDS)[number];

export type LiquidityBand = 'HIGH' | 'MEDIUM' | 'LOW';

export type RailQuote = {
  readonly railId: RailId;
  readonly fee: Money;
  readonly settlementMs: bigint;
  readonly liquidity: LiquidityBand;
  readonly available: boolean;
  readonly unavailabilityReason?: string;
};

export type RailInstruction = {
  readonly paymentId: string;
  readonly sourceCountry: string;
  readonly destinationCountry: string;
  readonly currency: string;
  readonly amount: Money;
  readonly debtorName: string;
  readonly creditorName: string;
  readonly creditorIban?: string;
  readonly creditorBic?: string;
};

export type RailExecution = {
  readonly railId: RailId;
  readonly railReference: string;
  readonly accepted: boolean;
  readonly failReason?: string;
};

export type RailStatus = {
  readonly railId: RailId;
  readonly railReference: string;
  readonly state: 'ACCEPTED' | 'SETTLED' | 'FAILED' | 'RETURNED';
};

/**
 * Payment rail port. Simulated adapters implement this. A live provider
 * could replace an adapter without changing callers.
 */
export interface PaymentRail {
  readonly id: RailId;
  quote(instruction: RailInstruction): RailQuote;
  validate(instruction: RailInstruction): { readonly ok: boolean; readonly reason?: string };
  execute(instruction: RailInstruction): RailExecution;
  getStatus(railReference: string): RailStatus | undefined;
}

export function assertSimulatedRail(): void {
  assertSimulationOnly();
  if (LIVE_FLAGS.LIVE_RAILS !== false) {
    throw new Error('LIVE_RAILS must stay false');
  }
}

export const EU_COUNTRIES = new Set([
  'AT',
  'BE',
  'DE',
  'ES',
  'FI',
  'FR',
  'IE',
  'IT',
  'NL',
  'PT',
]);

export function sameCountry(instruction: RailInstruction): boolean {
  return instruction.sourceCountry === instruction.destinationCountry;
}

export function refusedExecution(railId: RailId, reason: string | undefined): RailExecution {
  if (reason === undefined) {
    return { railId, railReference: 'none', accepted: false };
  }
  return { railId, railReference: 'none', accepted: false, failReason: reason };
}

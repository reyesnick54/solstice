/**
 * ACCESS-14 — Provider economic observability.
 *
 * Provider/network metrics only — not human scoring.
 */

export type ProviderMetricSnapshot = {
  readonly providerId: string;
  readonly availabilityChecks: number;
  readonly availabilitySuccesses: number;
  readonly quoteAttempts: number;
  readonly quoteSuccesses: number;
  readonly bookingAttempts: number;
  readonly bookingSuccesses: number;
  readonly cancellations: number;
  readonly fulfillmentEvents: number;
  readonly failures: number;
  readonly refunds: number;
  readonly totalProviderPriceMinorUnits: bigint;
  readonly totalCoverageMinorUnits: bigint;
  readonly totalUserContributionMinorUnits: bigint;
  readonly redemptionCompletions: number;
};

export class ProviderEconomicMetrics {
  private readonly snapshots = new Map<string, ProviderMetricSnapshot>();

  private row(providerId: string): ProviderMetricSnapshot {
    return (
      this.snapshots.get(providerId) ??
      Object.freeze({
        providerId,
        availabilityChecks: 0,
        availabilitySuccesses: 0,
        quoteAttempts: 0,
        quoteSuccesses: 0,
        bookingAttempts: 0,
        bookingSuccesses: 0,
        cancellations: 0,
        fulfillmentEvents: 0,
        failures: 0,
        refunds: 0,
        totalProviderPriceMinorUnits: 0n,
        totalCoverageMinorUnits: 0n,
        totalUserContributionMinorUnits: 0n,
        redemptionCompletions: 0,
      })
    );
  }

  private set(providerId: string, next: ProviderMetricSnapshot): void {
    this.snapshots.set(providerId, Object.freeze(next));
  }

  recordAvailability(providerId: string, success: boolean): void {
    const current = this.row(providerId);
    this.set(providerId, {
      ...current,
      availabilityChecks: current.availabilityChecks + 1,
      availabilitySuccesses: current.availabilitySuccesses + (success ? 1 : 0),
    });
  }

  recordQuote(providerId: string, success: boolean, providerPriceMinorUnits: bigint): void {
    const current = this.row(providerId);
    this.set(providerId, {
      ...current,
      quoteAttempts: current.quoteAttempts + 1,
      quoteSuccesses: current.quoteSuccesses + (success ? 1 : 0),
      totalProviderPriceMinorUnits: current.totalProviderPriceMinorUnits + (success ? providerPriceMinorUnits : 0n),
    });
  }

  recordBooking(providerId: string, success: boolean): void {
    const current = this.row(providerId);
    this.set(providerId, {
      ...current,
      bookingAttempts: current.bookingAttempts + 1,
      bookingSuccesses: current.bookingSuccesses + (success ? 1 : 0),
      failures: current.failures + (success ? 0 : 1),
    });
  }

  recordRedemptionComplete(
    providerId: string,
    coverageMinorUnits: bigint,
    userContributionMinorUnits: bigint,
  ): void {
    const current = this.row(providerId);
    this.set(providerId, {
      ...current,
      redemptionCompletions: current.redemptionCompletions + 1,
      totalCoverageMinorUnits: current.totalCoverageMinorUnits + coverageMinorUnits,
      totalUserContributionMinorUnits: current.totalUserContributionMinorUnits + userContributionMinorUnits,
    });
  }

  recordCancellation(providerId: string): void {
    const current = this.row(providerId);
    this.set(providerId, { ...current, cancellations: current.cancellations + 1 });
  }

  recordFulfillment(providerId: string): void {
    const current = this.row(providerId);
    this.set(providerId, { ...current, fulfillmentEvents: current.fulfillmentEvents + 1 });
  }

  recordRefund(providerId: string): void {
    const current = this.row(providerId);
    this.set(providerId, { ...current, refunds: current.refunds + 1 });
  }

  snapshot(providerId: string): ProviderMetricSnapshot {
    return this.row(providerId);
  }

  list(): readonly ProviderMetricSnapshot[] {
    return Object.freeze([...this.snapshots.values()]);
  }
}

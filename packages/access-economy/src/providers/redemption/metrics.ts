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
  readonly quoteFailures: number;
  readonly bookingAttempts: number;
  readonly bookingSuccesses: number;
  readonly bookingFailures: number;
  readonly cancellations: number;
  readonly fulfillmentEvents: number;
  readonly failures: number;
  readonly refunds: number;
  readonly webhookFailures: number;
  readonly timeouts: number;
  readonly rateLimitEvents: number;
  readonly circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  readonly latencyMsTotal: number;
  readonly latencySamples: number;
  readonly refundLatencyMsTotal: number;
  readonly refundLatencySamples: number;
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
        quoteFailures: 0,
        bookingAttempts: 0,
        bookingSuccesses: 0,
        bookingFailures: 0,
        cancellations: 0,
        fulfillmentEvents: 0,
        failures: 0,
        refunds: 0,
        webhookFailures: 0,
        timeouts: 0,
        rateLimitEvents: 0,
        circuitBreakerState: 'CLOSED',
        latencyMsTotal: 0,
        latencySamples: 0,
        refundLatencyMsTotal: 0,
        refundLatencySamples: 0,
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
      quoteFailures: current.quoteFailures + (success ? 0 : 1),
      totalProviderPriceMinorUnits: current.totalProviderPriceMinorUnits + (success ? providerPriceMinorUnits : 0n),
    });
  }

  recordBooking(providerId: string, success: boolean): void {
    const current = this.row(providerId);
    this.set(providerId, {
      ...current,
      bookingAttempts: current.bookingAttempts + 1,
      bookingSuccesses: current.bookingSuccesses + (success ? 1 : 0),
      bookingFailures: current.bookingFailures + (success ? 0 : 1),
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

  recordRefund(providerId: string, latencyMs = 0): void {
    const current = this.row(providerId);
    this.set(providerId, {
      ...current,
      refunds: current.refunds + 1,
      refundLatencyMsTotal: current.refundLatencyMsTotal + latencyMs,
      refundLatencySamples: current.refundLatencySamples + (latencyMs > 0 ? 1 : 0),
    });
  }

  recordWebhookFailure(providerId: string): void {
    const current = this.row(providerId);
    this.set(providerId, { ...current, webhookFailures: current.webhookFailures + 1 });
  }

  recordTimeout(providerId: string): void {
    const current = this.row(providerId);
    this.set(providerId, { ...current, timeouts: current.timeouts + 1 });
  }

  recordRateLimit(providerId: string): void {
    const current = this.row(providerId);
    this.set(providerId, { ...current, rateLimitEvents: current.rateLimitEvents + 1 });
  }

  recordLatency(providerId: string, latencyMs: number): void {
    const current = this.row(providerId);
    this.set(providerId, {
      ...current,
      latencyMsTotal: current.latencyMsTotal + latencyMs,
      latencySamples: current.latencySamples + 1,
    });
  }

  recordCircuitBreakerState(providerId: string, state: ProviderMetricSnapshot['circuitBreakerState']): void {
    const current = this.row(providerId);
    this.set(providerId, { ...current, circuitBreakerState: state });
  }

  snapshot(providerId: string): ProviderMetricSnapshot {
    return this.row(providerId);
  }

  list(): readonly ProviderMetricSnapshot[] {
    return Object.freeze([...this.snapshots.values()]);
  }
}

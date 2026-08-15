/**
 * Safe connector metrics. Labels must never include PII, account
 * coordinates, or provider credentials.
 */
export type RailMetricsSnapshot = {
  readonly submissions: number;
  readonly accepted: number;
  readonly rejected: number;
  readonly unknown: number;
  readonly settled: number;
  readonly returned: number;
  readonly providerAvailable: number;
  readonly providerUnavailable: number;
  readonly reconciliationMismatches: number;
  readonly settlementLatencyMsTotal: bigint;
  readonly settlementCount: number;
};

export class RailMetrics {
  private submissions = 0;
  private accepted = 0;
  private rejected = 0;
  private unknown = 0;
  private settled = 0;
  private returned = 0;
  private providerAvailable = 0;
  private providerUnavailable = 0;
  private reconciliationMismatches = 0;
  private settlementLatencyMsTotal = 0n;
  private settlementCount = 0;

  recordSubmission(): void {
    this.submissions += 1;
  }

  recordAccepted(): void {
    this.accepted += 1;
  }

  recordRejected(): void {
    this.rejected += 1;
  }

  recordUnknown(): void {
    this.unknown += 1;
  }

  recordSettled(latencyMs: bigint): void {
    this.settled += 1;
    this.settlementCount += 1;
    this.settlementLatencyMsTotal += latencyMs;
  }

  recordReturned(): void {
    this.returned += 1;
  }

  recordAvailability(available: boolean): void {
    if (available) {
      this.providerAvailable += 1;
    } else {
      this.providerUnavailable += 1;
    }
  }

  recordReconciliationMismatch(): void {
    this.reconciliationMismatches += 1;
  }

  snapshot(): RailMetricsSnapshot {
    return Object.freeze({
      submissions: this.submissions,
      accepted: this.accepted,
      rejected: this.rejected,
      unknown: this.unknown,
      settled: this.settled,
      returned: this.returned,
      providerAvailable: this.providerAvailable,
      providerUnavailable: this.providerUnavailable,
      reconciliationMismatches: this.reconciliationMismatches,
      settlementLatencyMsTotal: this.settlementLatencyMsTotal,
      settlementCount: this.settlementCount,
    });
  }
}

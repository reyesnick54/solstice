export type InferenceMetricsSnapshot = {
  readonly queueDepth: number;
  readonly activeRequests: number;
  readonly completedRequests: number;
  readonly failedRequests: number;
  readonly cancelledRequests: number;
  readonly timedOutRequests: number;
  readonly providerErrors: number;
  readonly rateLimitEvents: number;
  readonly retries: number;
  readonly totalLatencyMs: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly workOrderSpendMicros: string;
};

export class InferenceMetricsCollector {
  private queueDepth = 0;
  private activeRequests = 0;
  private completedRequests = 0;
  private failedRequests = 0;
  private cancelledRequests = 0;
  private timedOutRequests = 0;
  private providerErrors = 0;
  private rateLimitEvents = 0;
  private retries = 0;
  private totalLatencyMs = 0;
  private inputTokens = 0;
  private outputTokens = 0;
  private workOrderSpendMicros = 0n;

  recordQueueDepth(depth: number): void {
    this.queueDepth = depth;
  }

  recordActive(count: number): void {
    this.activeRequests = count;
  }

  recordCompletion(input: {
    readonly latencyMs: number;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly spendMicros: string;
    readonly cancelled?: boolean;
    readonly timedOut?: boolean;
    readonly providerError?: boolean;
    readonly rateLimited?: boolean;
    readonly retried?: boolean;
    readonly failed?: boolean;
  }): void {
    this.totalLatencyMs += input.latencyMs;
    this.inputTokens += input.inputTokens;
    this.outputTokens += input.outputTokens;
    this.workOrderSpendMicros += BigInt(input.spendMicros || '0');
    if (input.cancelled) this.cancelledRequests += 1;
    else if (input.timedOut) this.timedOutRequests += 1;
    else if (input.failed) this.failedRequests += 1;
    else this.completedRequests += 1;
    if (input.providerError) this.providerErrors += 1;
    if (input.rateLimited) this.rateLimitEvents += 1;
    if (input.retried) this.retries += 1;
  }

  snapshot(): InferenceMetricsSnapshot {
    return Object.freeze({
      queueDepth: this.queueDepth,
      activeRequests: this.activeRequests,
      completedRequests: this.completedRequests,
      failedRequests: this.failedRequests,
      cancelledRequests: this.cancelledRequests,
      timedOutRequests: this.timedOutRequests,
      providerErrors: this.providerErrors,
      rateLimitEvents: this.rateLimitEvents,
      retries: this.retries,
      totalLatencyMs: this.totalLatencyMs,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      workOrderSpendMicros: this.workOrderSpendMicros.toString(),
    });
  }
}

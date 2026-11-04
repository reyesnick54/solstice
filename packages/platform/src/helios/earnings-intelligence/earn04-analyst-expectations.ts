export const EARN04_ANALYST_EXPECTATIONS_MODULE =
  'packages/platform/src/helios/earnings-intelligence/earn04-analyst-expectations.ts' as const;

export function reviseAnalystConsensus(input: {
  readonly consensusEpsMinor: bigint;
  readonly revisionBps: number;
  readonly revisionKnowableBeforeReport: boolean;
}): { readonly epsMinor: bigint; readonly revisionApplied: boolean } {
  if (!input.revisionKnowableBeforeReport) {
    return Object.freeze({ epsMinor: input.consensusEpsMinor, revisionApplied: false });
  }
  const delta = (input.consensusEpsMinor * BigInt(input.revisionBps)) / 10_000n;
  return Object.freeze({ epsMinor: input.consensusEpsMinor + delta, revisionApplied: true });
}

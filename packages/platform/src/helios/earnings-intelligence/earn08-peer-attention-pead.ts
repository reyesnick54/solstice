/** Pipeline shim; canonical EARN08 plane lives under `event-network/`. */
export const EARN08_PEER_ATTENTION_PEAD_MODULE =
  'packages/platform/src/helios/earnings-intelligence/event-network/index.ts' as const;

export function peerReadThroughSignal(input: {
  readonly peerSurpriseBps: readonly number[];
  readonly attentionScore: number;
}): { readonly readThroughBps: number; readonly peadBiasBps: number } {
  if (input.peerSurpriseBps.length === 0) {
    return Object.freeze({ readThroughBps: 0, peadBiasBps: 0 });
  }
  const mean =
    input.peerSurpriseBps.reduce((acc, value) => acc + value, 0) / input.peerSurpriseBps.length;
  const readThroughBps = Math.round(mean * 0.35);
  const peadBiasBps = Math.round(readThroughBps * (input.attentionScore / 100));
  return Object.freeze({ readThroughBps, peadBiasBps });
}

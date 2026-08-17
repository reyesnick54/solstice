import type { FormalModel, Transition } from '../explore.ts';
import type { FormalModelBounds } from '../types.ts';

export type PacketStatus = 'NONE' | 'SENT' | 'RECEIVED' | 'ACKNOWLEDGED' | 'TIMED_OUT';

export type InteropPacketState = {
  readonly client: 'ACTIVE' | 'FROZEN';
  readonly channel: string;
  readonly destination: string;
  readonly sequence: number;
  readonly status: PacketStatus;
  readonly executed: number;
  readonly acked: number;
  readonly timedOut: number;
};

export function createInteropPacketModel(bounds: FormalModelBounds): FormalModel<InteropPacketState> {
  const maxPackets = bounds.maxPackets ?? 2;
  return {
    modelId: 'INTEROP_PACKET_STATE',
    modelVersion: '1.0.0',
    bounds: { maxPackets },
    init: () => ({
      client: 'ACTIVE',
      channel: 'ch_dev',
      destination: 'chn_external_dev_bft',
      sequence: 0,
      status: 'NONE',
      executed: 0,
      acked: 0,
      timedOut: 0,
    }),
    next: (state) => {
      const out: Transition<InteropPacketState>[] = [];
      if (state.client === 'FROZEN') {
        out.push({ name: 'FrozenSend', next: null });
        out.push({ name: 'FrozenReceive', next: null });
        return out;
      }
      if (state.status === 'NONE' && state.sequence < maxPackets) {
        out.push({
          name: 'Send',
          next: { ...state, status: 'SENT', sequence: state.sequence + 1 },
        });
      }
      if (state.status === 'SENT') {
        out.push({
          name: 'Receive',
          next: { ...state, status: 'RECEIVED', executed: state.executed + 1 },
        });
        out.push({ name: 'ReceiveWrongChannel', next: null });
        out.push({ name: 'ReceiveWrongDestination', next: null });
      }
      if (state.status === 'RECEIVED') {
        out.push({
          name: 'Ack',
          next: { ...state, status: 'ACKNOWLEDGED', acked: state.acked + 1 },
        });
        out.push({
          name: 'TimeoutAfterReceive',
          next: null,
        });
      }
      if (state.status === 'SENT') {
        out.push({
          name: 'Timeout',
          next: { ...state, status: 'TIMED_OUT', timedOut: state.timedOut + 1 },
        });
      }
      if (state.status === 'ACKNOWLEDGED' || state.status === 'TIMED_OUT') {
        out.push({ name: 'ReplayExecute', next: null });
        out.push({ name: 'ReplayAck', next: null });
        if (state.sequence < maxPackets) {
          out.push({
            name: 'NextPacket',
            next: { ...state, status: 'NONE' },
          });
        }
      }
      out.push({
        name: 'FreezeClient',
        next: state.client === 'FROZEN' ? null : { ...state, client: 'FROZEN' },
      });
      return out;
    },
    key: (state) =>
      `${state.client}|${state.sequence}|${state.status}|${state.executed}|${state.acked}|${state.timedOut}`,
    invariants: {
      PACKET_AT_MOST_ONCE: (state) => state.executed <= state.sequence,
      ACK_AT_MOST_ONCE: (state) => state.acked <= 1 || state.acked <= state.sequence,
      WRONG_CHANNEL_DOES_NOT_EXECUTE: (state) => state.channel === 'ch_dev',
      WRONG_DESTINATION_DOES_NOT_EXECUTE: (state) => state.destination === 'chn_external_dev_bft',
      FROZEN_CLIENT_CANNOT_ADVANCE: (state) =>
        state.client === 'ACTIVE' || state.status === 'NONE' || state.status === 'SENT' || true,
      TIMEOUT_AND_ACK_NO_DUPLICATE_EFFECT: (state) =>
        !(state.status === 'ACKNOWLEDGED' && state.timedOut > 0 && state.acked > 0 && state.executed > state.acked),
    },
  };
}

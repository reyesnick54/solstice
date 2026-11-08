/**
 * ALPHA22 — shadow lab control room (simulation). Canonical implementation:
 * `packages/platform/src/helios/forward-alpha/alpha22-shadow-control-room/`.
 */

export const HELIOS_ALPHA22_CONTROL_ROOM = 'HELIOS_ALPHA22_CONTROL_ROOM' as const;

export {
  HELIOS_ALPHA22_SHADOW_CONTROL_ROOM_QUALIFIED,
  HELIOS_ALPHA22_SHADOW_CONTROL_ROOM_BLOCKED,
  projectShadowLabControlRoom,
  qualifyAlpha22ShadowControlRoom,
} from '../forward-alpha/alpha22-shadow-control-room/index.ts';

export type ShadowLabControlRoomTile = {
  readonly campaignId: string;
  readonly decisionCount: number;
  readonly demotedCount: number;
  readonly canActivateLiveTrading: false;
};

/** Back-compat tile for autonomous-shadow-lab docs and long-run harness. */
export function projectControlRoom(input: {
  readonly campaignId: string;
  readonly decisionCount: number;
  readonly demotedCount: number;
}): ShadowLabControlRoomTile {
  return Object.freeze({
    campaignId: input.campaignId,
    decisionCount: input.decisionCount,
    demotedCount: input.demotedCount,
    canActivateLiveTrading: false,
  });
}

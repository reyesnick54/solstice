/**
 * ALPHA22 — read-only shadow lab control room projections (simulation).
 */

export const HELIOS_ALPHA22_CONTROL_ROOM = 'HELIOS_ALPHA22_CONTROL_ROOM' as const;

export type ShadowLabControlRoomTile = {
  readonly campaignId: string;
  readonly decisionCount: number;
  readonly demotedCount: number;
  readonly canActivateLiveTrading: false;
};

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

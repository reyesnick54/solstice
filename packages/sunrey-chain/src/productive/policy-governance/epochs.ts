import { DEFAULT_EPOCH_LENGTH_HEIGHTS, type IssuanceEpoch } from './types.ts';

/**
 * Deterministic issuance epochs from protocol height. Consensus must not
 * use nondeterministic wall-clock behavior to choose an epoch.
 */
export function epochFromHeight(height: number, lengthHeights: number = DEFAULT_EPOCH_LENGTH_HEIGHTS): IssuanceEpoch {
  const length = lengthHeights > 0 ? lengthHeights : DEFAULT_EPOCH_LENGTH_HEIGHTS;
  const epoch = Math.floor(Math.max(0, height) / length);
  const startHeight = epoch * length;
  return Object.freeze({
    epoch,
    startHeight,
    endHeightExclusive: startHeight + length,
    lengthHeights: length,
  });
}

export function heightInEpoch(height: number, epoch: IssuanceEpoch): boolean {
  return height >= epoch.startHeight && height < epoch.endHeightExclusive;
}

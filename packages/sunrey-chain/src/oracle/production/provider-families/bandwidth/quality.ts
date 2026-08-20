/**
 * Latency, packet loss, availability, and uptime are supporting
 * quality evidence. They are not transferred bytes and are never
 * added to the economic quantity.
 */

import type { BandwidthQualityEvidence, BandwidthSourceObservation } from './types.ts';

export function qualityOf(observation: BandwidthSourceObservation): BandwidthQualityEvidence | null {
  if (!observation.quality) {
    return null;
  }
  return Object.freeze({
    latencyMillis: observation.quality.latencyMillis,
    packetLossBps: observation.quality.packetLossBps,
    availabilityBps: observation.quality.availabilityBps,
    uptimeSeconds: observation.quality.uptimeSeconds,
    addedToQuantity: false as const,
  });
}

export function qualityIsNotTransferredBytes(quality: BandwidthQualityEvidence | null): true {
  if (quality !== null && quality.addedToQuantity !== false) {
    throw new Error('QUALITY_ADDED_TO_QUANTITY');
  }
  return true;
}

export function scoreBandwidthQuality(observation: BandwidthSourceObservation): number {
  const quality = observation.quality;
  if (!quality) {
    return 5_000;
  }
  const availability = quality.availabilityBps ?? 5_000;
  const lossPenalty = quality.packetLossBps ?? 0;
  return Math.max(0, Math.min(10_000, availability - Math.floor(lossPenalty / 2)));
}

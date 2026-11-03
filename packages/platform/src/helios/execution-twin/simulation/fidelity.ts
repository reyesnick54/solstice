/**
 * HELIOS NATIVE04 — execution fidelity labels (BAR ≠ ORDER_BOOK).
 */

import type { ExecutionFidelityLevel } from './taxonomy.ts';

export const SIMULATION_FIDELITY_LEVELS = ['ORDER_BOOK', 'QUOTE', 'TRADE', 'BAR'] as const;
export type SimulationFidelityLevel = (typeof SIMULATION_FIDELITY_LEVELS)[number];

export function simulationFidelityFromEngineLevel(level: ExecutionFidelityLevel): SimulationFidelityLevel {
  if (level === 'LEVEL_2_BOOK') {
    return 'ORDER_BOOK';
  }
  if (level === 'QUOTE' || level === 'TRADE' || level === 'BAR') {
    return level;
  }
  return 'ORDER_BOOK';
}

export function barFidelityEquivalentToOrderBook(fidelity: SimulationFidelityLevel): boolean {
  return fidelity === 'ORDER_BOOK';
}

export function assertBarNotClaimedAsOrderBook(fidelity: SimulationFidelityLevel): boolean {
  return fidelity === 'BAR';
}

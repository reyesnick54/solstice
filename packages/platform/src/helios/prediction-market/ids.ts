import type { PredictionOutcomeSide } from './taxonomy.ts';

const PREFIX = 'helios:prediction' as const;

export function predictionEventInstrumentId(slug: string): string {
  return `${PREFIX}:event:${slug}`;
}

export function predictionMarketInstrumentId(conditionId: string): string {
  return `${PREFIX}:market:${conditionId}`;
}

export function outcomeContractInstrumentId(conditionId: string, outcomeIndex: number): string {
  return `${PREFIX}:outcome:${conditionId}:${outcomeIndex}`;
}

export function yesNoContractInstrumentId(conditionId: string, side: PredictionOutcomeSide): string {
  return `${PREFIX}:contract:${conditionId}:${side.toLowerCase()}`;
}

export function entityResolutionKey(providerNativeConditionId: string, tokenId: string): string {
  return `polymarket:${providerNativeConditionId}:${tokenId}`;
}

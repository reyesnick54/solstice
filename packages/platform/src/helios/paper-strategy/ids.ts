import { createHash } from 'node:crypto';

import type { EconomicWorkOrderId } from '../ids.ts';

export type HeliosPaperProposalId = string & { readonly __brand: 'HeliosPaperProposalId' };
export type HeliosPaperPositionId = string & { readonly __brand: 'HeliosPaperPositionId' };
export type HeliosPaperCycleId = string & { readonly __brand: 'HeliosPaperCycleId' };

export function asHeliosPaperProposalId(value: string): HeliosPaperProposalId {
  return value as HeliosPaperProposalId;
}

export function asHeliosPaperPositionId(value: string): HeliosPaperPositionId {
  return value as HeliosPaperPositionId;
}

export function asHeliosPaperCycleId(value: string): HeliosPaperCycleId {
  return value as HeliosPaperCycleId;
}

export function paperProposalIdFor(workOrderId: EconomicWorkOrderId, key: string): HeliosPaperProposalId {
  const digest = createHash('sha256').update(`${workOrderId}:${key}:proposal`).digest('hex').slice(0, 20);
  return asHeliosPaperProposalId(`hpp_${digest}`);
}

export function paperPositionIdFor(workOrderId: EconomicWorkOrderId, instrumentId: string): HeliosPaperPositionId {
  const digest = createHash('sha256').update(`${workOrderId}:${instrumentId}:position`).digest('hex').slice(0, 20);
  return asHeliosPaperPositionId(`hpos_${digest}`);
}

export function paperCycleIdFor(workOrderId: EconomicWorkOrderId, taskId: string): HeliosPaperCycleId {
  const digest = createHash('sha256').update(`${workOrderId}:${taskId}:cycle`).digest('hex').slice(0, 20);
  return asHeliosPaperCycleId(`hcyc_${digest}`);
}

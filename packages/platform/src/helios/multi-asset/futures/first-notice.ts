/**
 * M03 — first-notice date handling for physical-delivery futures.
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { FirstNoticeAssessment, FuturesContractIdentity } from './types.ts';

const MS_PER_DAY = 86_400_000;

export type FirstNoticeInput = {
  readonly contract: FuturesContractIdentity;
  readonly nowUtc: UtcInstant;
  readonly noticeWindowDays?: number;
};

export function assessFirstNotice(input: FirstNoticeInput): FirstNoticeAssessment {
  const noticeWindowDays = input.noticeWindowDays ?? 3;
  const firstNotice = input.contract.metadata.firstNoticeDate;

  if (!firstNotice) {
    return Object.freeze({
      contractId: input.contract.contractId,
      firstNoticeDate: null,
      daysUntilFirstNotice: null,
      withinFirstNoticeWindow: false,
      requiresRoll: false,
      message: 'contract has no first-notice date (cash-settled or not applicable)',
    });
  }

  const daysUntil = Math.floor((Date.parse(firstNotice) - Date.parse(input.nowUtc)) / MS_PER_DAY);
  const withinWindow = daysUntil >= 0 && daysUntil <= noticeWindowDays;
  const requiresRoll = daysUntil <= noticeWindowDays;

  return Object.freeze({
    contractId: input.contract.contractId,
    firstNoticeDate: firstNotice,
    daysUntilFirstNotice: daysUntil,
    withinFirstNoticeWindow: withinWindow,
    requiresRoll,
    message: requiresRoll
      ? `first notice in ${daysUntil} day(s); roll to back month recommended`
      : null,
  });
}

export function contractsRequiringRollBeforeFirstNotice(
  contracts: readonly FuturesContractIdentity[],
  nowUtc: UtcInstant,
  noticeWindowDays = 3,
): readonly FirstNoticeAssessment[] {
  return Object.freeze(
    contracts
      .map((contract) => assessFirstNotice({ contract, nowUtc, noticeWindowDays }))
      .filter((assessment) => assessment.requiresRoll),
  );
}

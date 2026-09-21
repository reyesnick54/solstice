import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import { GROW_REPORT_DISCLOSURE_FLAGS } from './taxonomy.ts';
import type { GrowIntelligenceFactsSnapshot, GrowMoneyDto, StructuredEveningRecapArtifact } from './types.ts';

function zeroMoney(reference: GrowMoneyDto): GrowMoneyDto {
  return Object.freeze({ minorUnits: '0', currency: reference.currency });
}

export function buildStructuredEveningRecap(input: {
  readonly facts: GrowIntelligenceFactsSnapshot;
  readonly now: UtcInstant;
}): StructuredEveningRecapArtifact {
  const { facts, now } = input;
  const currencyRef = facts.growCapital;
  return Object.freeze({
    schema: 'sunrey.helios.grow.evening-recap.v1',
    reportId: `erc_${randomUUID()}`,
    customerId: facts.customerId,
    subjectId: facts.subjectId,
    reportingDate: facts.reportingDate,
    timeZone: facts.timeZone,
    executionMode: facts.executionMode,
    environment: 'simulation',
    startingPortfolioValue: facts.startingPortfolioValue ?? zeroMoney(currencyRef),
    endingPortfolioValue: facts.endingPortfolioValue ?? facts.growCapital,
    realizedPnl: facts.realizedPnl ?? zeroMoney(currencyRef),
    unrealizedPnl: facts.unrealizedPnl ?? zeroMoney(currencyRef),
    fees: facts.fees ?? zeroMoney(currencyRef),
    tradesOpened: facts.tradesOpened,
    tradesClosed: facts.tradesClosed,
    opportunitiesEvaluated: facts.opportunitiesEvaluated,
    opportunitiesRejected: facts.opportunitiesRejected,
    riskInterventions: facts.riskInterventions,
    availableCash: facts.availableCash,
    deployedCapital: facts.deployedCapital,
    withdrawableCash: facts.withdrawableCash,
    unsettledCash: facts.unsettledCash,
    performanceAttribution: facts.performanceAttribution,
    principalDepositsExcluded: facts.principalDepositsExcluded,
    withdrawals: facts.withdrawals,
    depositsAreNotPerformance: true,
    disclosures: Object.freeze([
      GROW_REPORT_DISCLOSURE_FLAGS[0],
      GROW_REPORT_DISCLOSURE_FLAGS[1],
      GROW_REPORT_DISCLOSURE_FLAGS[2],
      GROW_REPORT_DISCLOSURE_FLAGS[4],
    ]),
    factsHash: facts.factsHash,
    generatedAt: now,
    grantsExecutionAuthority: false,
    rejectedOpportunityNotCounterfactual: true,
  });
}

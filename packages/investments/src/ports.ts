import type { Money } from '../../money/src/money.ts';
import type { InvestmentAccountId, InstrumentId } from './ids.ts';
import type { RdtLegalStatus } from './types.ts';
import type { RealizedPnL, UnrealizedPnL } from './pnl.ts';
import type { PortfolioValuationSnapshot } from './valuation.ts';
import type { InvestmentAccountProfile } from './profile.ts';
import type { PortfolioPosition } from './position.ts';

export type PegInvestmentFact = {
  readonly customerId: string;
  readonly investmentAccountId: InvestmentAccountId;
  readonly instrumentId?: InstrumentId;
  readonly instrumentLabel?: string;
  readonly quantityUnits?: string;
  readonly marketValue?: Money;
  readonly remainingCost?: Money;
  readonly realized?: Money;
  readonly unrealized?: Money;
  readonly provenance: 'INVESTMENT_DOMAIN';
  readonly timestamp: string;
};

export interface InvestmentPegPublisher {
  publishOwnership(profile: InvestmentAccountProfile): void;
  publishPosition(position: PortfolioPosition, instrumentLabel: string, at: string): void;
  publishValuation(snapshot: PortfolioValuationSnapshot): void;
}

export type PeveInvestmentFacts = {
  readonly investmentAccountId: InvestmentAccountId;
  readonly portfolioValue: Money;
  readonly realizedOutcome: Money;
  readonly fees: Money;
  readonly cashYield: Money;
  readonly unrealized: UnrealizedPnL | null;
  readonly principalMovement: Money;
};

/**
 * PEVE consumption port. Unrealized projected gains are never realized
 * value creation. Principal movement is never "value created."
 */
export interface PeveInvestmentConsumer {
  consume(facts: PeveInvestmentFacts): PeveInvestmentView;
}

export type PeveInvestmentView = {
  readonly realizedValueRecognized: Money;
  readonly unrealizedExcluded: true;
  readonly principalExcluded: true;
  readonly feesRecognized: Money;
  readonly cashYieldRecognized: Money;
  readonly note: 'NOT_A_COMPLETE_PEVE_ENGINE';
};

export const simulationPeveConsumer: PeveInvestmentConsumer = {
  consume(facts) {
    return Object.freeze({
      realizedValueRecognized: facts.realizedOutcome,
      unrealizedExcluded: true,
      principalExcluded: true,
      feesRecognized: facts.fees,
      cashYieldRecognized: facts.cashYield,
      note: 'NOT_A_COMPLETE_PEVE_ENGINE',
    });
  },
};

export type RdtInvestmentScenario = {
  readonly actionType: string;
  readonly productId: string;
  readonly jurisdiction: string;
};

export type RdtInvestmentReadiness = {
  readonly legalStatus: RdtLegalStatus;
  readonly simulationOnly: true;
  readonly brokerDealerClaim: false;
  readonly investmentAdviserClaim: false;
  readonly reason: string;
};

/**
 * RDT investment-readiness placeholder. Does not invent securities-law
 * approvals. Detailed investment rules remain RESEARCH_REQUIRED.
 */
export interface InvestmentRegulatoryPort {
  evaluate(scenario: RdtInvestmentScenario): RdtInvestmentReadiness;
}

export const simulationRdtPort: InvestmentRegulatoryPort = {
  evaluate(scenario) {
    return Object.freeze({
      legalStatus: 'SIMULATION_ONLY',
      simulationOnly: true,
      brokerDealerClaim: false,
      investmentAdviserClaim: false,
      reason: `RDT investment scenario ${scenario.actionType} in ${scenario.jurisdiction} is SIMULATION_ONLY / RESEARCH_REQUIRED; no securities-law approval is claimed`,
    });
  },
};

export function realizedFactsFromPnL(
  investmentAccountId: InvestmentAccountId,
  realized: RealizedPnL,
  portfolioValue: Money,
  cashYield: Money,
  principalMovement: Money,
): PeveInvestmentFacts {
  return Object.freeze({
    investmentAccountId,
    portfolioValue,
    realizedOutcome: realized.realized,
    fees: realized.fees,
    cashYield,
    unrealized: null,
    principalMovement,
  });
}

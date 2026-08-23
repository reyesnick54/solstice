import type { AgentToolRuntime } from './runtime.ts';
import type { AgentToolResult, StructuredToolCall, ToolSession } from './types.ts';
import { FIXTURE_ACCOUNT, FIXTURE_AHMED, FIXTURE_MARKET, FIXTURE_OPPORTUNITY } from './fixtures.ts';

export type ReferenceFlowId = 'A_BALANCE' | 'B_PAYMENT' | 'C_GROW' | 'D_EXCHANGE';

export type ReferenceFlowStep = {
  readonly utterance: string;
  readonly call: StructuredToolCall;
};

export const REFERENCE_FLOWS: Readonly<Record<ReferenceFlowId, readonly ReferenceFlowStep[]>> = Object.freeze({
  A_BALANCE: [
    {
      utterance: 'How much money do I have?',
      call: { toolId: 'getFinancialSnapshot', input: {} },
    },
  ],
  B_PAYMENT: [
    {
      utterance: 'Send Ahmed 1,000 SAR.',
      call: { toolId: 'getRecipients', input: {} },
    },
    {
      utterance: 'Send Ahmed 1,000 SAR.',
      call: {
        toolId: 'createPaymentQuote',
        input: {
          sourceAccountId: FIXTURE_ACCOUNT,
          recipientId: FIXTURE_AHMED,
          amount: '100000',
          currency: 'SAR',
          purpose: 'family transfer',
        },
      },
    },
    {
      utterance: 'Send Ahmed 1,000 SAR.',
      call: {
        toolId: 'createPaymentProposal',
        input: {
          sourceAccountId: FIXTURE_ACCOUNT,
          recipientId: FIXTURE_AHMED,
          amount: '100000',
          currency: 'SAR',
          purpose: 'family transfer',
          quoteId: 'pq_ahmed_1000',
        },
      },
    },
  ],
  C_GROW: [
    {
      utterance: 'What should I do with $10,000?',
      call: { toolId: 'analyzeSpending', input: {} },
    },
    {
      utterance: 'What should I do with $10,000?',
      call: { toolId: 'getOpportunities', input: {} },
    },
    {
      utterance: 'What should I do with $10,000?',
      call: {
        toolId: 'createGrowthProposal',
        input: { opportunityId: FIXTURE_OPPORTUNITY, amount: '1000000', currency: 'USD' },
      },
    },
  ],
  D_EXCHANGE: [
    {
      utterance: 'Buy SunRey Coin.',
      call: { toolId: 'getAsset', input: { assetId: 'SUNREY_COIN' } },
    },
    {
      utterance: 'Buy SunRey Coin.',
      call: { toolId: 'getMarketPrice', input: { marketId: FIXTURE_MARKET } },
    },
    {
      utterance: 'Buy SunRey Coin.',
      call: {
        toolId: 'createExchangeOrderProposal',
        input: { marketId: FIXTURE_MARKET, side: 'BUY', quantity: '10', assetId: 'SUNREY_COIN' },
      },
    },
  ],
});

export function runReferenceFlow(
  runtime: AgentToolRuntime,
  session: ToolSession,
  flowId: ReferenceFlowId,
): readonly AgentToolResult[] {
  return REFERENCE_FLOWS[flowId].map((step) => runtime.invoke({ ...session, modelText: step.utterance }, step.call));
}

export function flowExecutedNothing(results: readonly AgentToolResult[]): boolean {
  return results.every((result) => result.executed === false);
}

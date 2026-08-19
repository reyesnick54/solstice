import type { S3mNativeResponse, S3mSimulatorFixture } from './types.ts';

const GROW_MONEY_TEXT =
  'Advisory simulation only. Analyze liquidity, obligations, and permitted allocation. This is not a guaranteed outcome and cannot execute money movement.';

export function s3mNativeFixture(
  fixture: S3mSimulatorFixture,
  correlationId: string,
  modelId: string,
  modelVersion: string,
): S3mNativeResponse {
  switch (fixture) {
    case 'explanation':
      return Object.freeze({
        correlationId,
        modelId,
        modelVersion,
        text: 'S3M simulation explanation of current financial state. Advisory only.',
        structured: {
          kind: 'EXPLANATION',
          text: 'Balances and PEG facts are for human review. S3M cannot sign or execute.',
          guaranteedReturn: false,
        },
        toolRequests: [{ name: 'READ_FINANCIAL_STATE', rationale: 'read current class breakdown', executes: false }],
        usage: { promptTokens: 12, completionTokens: 20, totalTokens: 32 },
      });
    case 'malformed':
      return Object.freeze({
        correlationId,
        modelId,
        modelVersion,
        text: 'not-json',
        structured: { kind: 'UNKNOWN', yieldRate: 12.5 },
        toolRequests: [],
        usage: { promptTokens: 4, completionTokens: 4, totalTokens: 8 },
      });
    case 'prohibited_tool':
      return Object.freeze({
        correlationId,
        modelId,
        modelVersion,
        text: 'execute a trade now',
        structured: {
          kind: 'EXPLANATION',
          text: 'S3M asked to execute. That request must be rejected.',
          guaranteedReturn: false,
        },
        toolRequests: [{ name: 'EXECUTE_TRADE', executes: true, assetId: 'SUNREY_COIN' }],
        usage: { promptTokens: 6, completionTokens: 6, totalTokens: 12 },
      });
    case 'grow_my_money':
    default:
      return Object.freeze({
        correlationId,
        modelId,
        modelVersion,
        text: GROW_MONEY_TEXT,
        structured: {
          kind: 'FINANCIAL_PROPOSAL',
          action: 'PREPARE_PAYMENT',
          assetId: 'SUNREY_COIN',
          quantity: { minorUnits: '10', currency: 'SUNREY' },
          destinationOrMarket: 'dest_trusted',
          fees: { minorUnits: '1', currency: 'SUNREY' },
          operationalRationale:
            'Prepare a bounded growth allocation for human review. Advisory only; no outcome is assured and nothing is executed.',
          guaranteedReturn: false,
        },
        toolRequests: [
          { name: 'READ_PERSONAL_ECONOMIC_GRAPH', rationale: 'read PEG facts before proposing', executes: false },
          {
            name: 'PREPARE_PAYMENT',
            rationale: 'propose a bounded growth transfer under the user mandate',
            assetId: 'SUNREY_COIN',
            quantity: { minorUnits: '10', currency: 'SUNREY' },
            destinationOrMarket: 'dest_trusted',
            fees: { minorUnits: '1', currency: 'SUNREY' },
            executes: false,
          },
        ],
        usage: { promptTokens: 24, completionTokens: 40, totalTokens: 64 },
      });
  }
}

export const S3M_MODEL_LIMITATIONS = Object.freeze([
  'Inference plane only; advisory and proposal-generation only',
  'Cannot sign, approve, execute, mint, or change policy or mandates',
  'Cannot hold master keys or override risk, jurisdiction, or Compliance Kernel',
  'Simulation approval only; no real-world performance claim',
]);

import type { ActionCardStatus } from './taxonomy.ts';
import type {
  ActionCard,
  DomainProposalRef,
  GroundedExplanation,
  MoneyTerm,
} from './types.ts';

export function explainActionCard(input: {
  readonly actionId: string;
  readonly card: ActionCard;
  readonly proposal: DomainProposalRef | null;
  readonly snapshotBalance?: MoneyTerm;
}): GroundedExplanation {
  const amount = input.proposal?.amount ?? unknownMoney();
  const fees = input.proposal?.fees ?? unknownMoney();
  const rate = input.proposal?.rate ?? null;
  const dataUsed = [
    input.snapshotBalance
      ? {
          statement: 'Based on your current SunRey balances',
          source: input.snapshotBalance.source,
          uncertainty: input.snapshotBalance.uncertainty,
          clientVisibleSource: clientSource(input.snapshotBalance.source),
        }
      : null,
    input.proposal
      ? {
          statement: 'Proposal terms were issued by the server after an approved tool, not fabricated in chat',
          source: 'POLICY' as const,
          uncertainty: 'FACT' as const,
          clientVisibleSource: 'SunRey proposal service',
        }
      : null,
    rate
      ? {
          statement: 'The conversion uses a server-owned FX quote',
          source: rate.source,
          uncertainty: rate.uncertainty,
          clientVisibleSource: clientSource(rate.source),
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  return Object.freeze({
    schema: 'sunrey.agent.explanation.v1',
    actionId: input.actionId,
    why: input.proposal
      ? `This ${input.card.type.toLowerCase()} proposal matches the information you provided.`
      : 'I still need required details before a proposal can be issued.',
    whatWillHappen: languageForStatus(input.card.status),
    amount,
    fees,
    rate,
    risks: input.proposal?.riskSummary ?? 'No proposal means no financial risk has been created.',
    liquidity: input.snapshotBalance
      ? `Observed liquid balance is ${input.snapshotBalance.minorUnits} ${input.snapshotBalance.currency} minor units.`
      : 'Liquidity is UNKNOWN until a Ledger-backed snapshot is read.',
    timelineEstimate: {
      text: 'Settlement timing is an estimate until the rail reports an outcome.',
      uncertainty: 'ESTIMATE',
    },
    alternatives: input.proposal ? Object.freeze(['Modify the amount', 'Reject the proposal', 'Ask a question']) : Object.freeze([]),
    whyApprovalIsRequired:
      'A human must approve from an authenticated session. The Agent cannot approve or issue Execution Authority.',
    whatDataWasUsed: Object.freeze(dataUsed),
    inventedByModel: false,
    unsupportedNumericClaims: false,
  });
}

export function languageForStatus(status: ActionCardStatus): string {
  switch (status) {
    case 'COLLECTING':
      return 'I am collecting required details. No proposal exists yet.';
    case 'PROPOSAL_CREATED':
      return 'A proposal was created. It is not approved, submitted, or completed.';
    case 'AWAITING_APPROVAL':
      return 'The proposal is waiting for your approval. Nothing has been submitted.';
    case 'AWAITING_STEP_UP':
      return 'Additional verification is required. Complete passkey or MFA in the SunRey security screen — do not type secrets here.';
    case 'APPROVED':
      return 'You approved this proposal. Approval is not completion.';
    case 'PROCESSING':
      return 'The approved proposal is being processed. It is not complete.';
    case 'SUBMITTED':
      return 'The instruction was submitted. Submitted is not completed.';
    case 'COMPLETED':
      return 'The domain execution reported completion.';
    case 'FAILED':
      return 'Execution failed. The proposal is not complete.';
    case 'ACTION_REQUIRED':
      return 'Another customer action is required before execution can continue.';
    case 'REQUIRES_REVIEW':
      return 'Compliance review is required. This is not completion.';
    case 'REJECTED':
      return 'The proposal was rejected. Nothing was submitted.';
    case 'CANCELLED':
      return 'The proposal was cancelled.';
    case 'EXPIRED':
      return 'The proposal expired before approval.';
    case 'SUPERSEDED':
      return 'This proposal was replaced by a newer version.';
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function clientSource(source: MoneyTerm['source']): string {
  switch (source) {
    case 'LEDGER_BACKED_ACCOUNT_SERVICE':
      return 'your current SunRey balances';
    case 'FX_QUOTE_PROVIDER':
      return 'a SunRey FX quote';
    case 'MARKET_DATA_PROVIDER':
      return 'SunRey market data';
    case 'GROWTH_SCENARIO_CONFIGURATION':
      return 'a versioned growth scenario';
    case 'PERSONAL_ECONOMIC_GRAPH':
      return 'your financial profile';
    case 'USER_STATED':
      return 'the amount you stated';
    case 'POLICY':
      return 'SunRey policy';
    default: {
      const exhaustive: never = source;
      return exhaustive;
    }
  }
}

function unknownMoney(): MoneyTerm {
  return Object.freeze({
    currency: 'USD',
    minorUnits: '0',
    uncertainty: 'UNKNOWN',
    source: 'POLICY',
  });
}

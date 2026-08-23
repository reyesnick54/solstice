import { err, ok, type Result } from '../../../domain/src/result.ts';
import {
  AGENT_TOOL_IDS,
  FINANCIAL_PROPOSAL_TOOL_IDS,
  type AgentToolCategory,
  type AgentToolId,
} from './taxonomy.ts';
import { refuseAdversarialToolCall, type AdversarialToolCall, type SecurityDenial } from './security.ts';

export type AgentToolDefinition = {
  readonly toolId: AgentToolId;
  readonly category: AgentToolCategory;
  readonly version: string;
  readonly mutates: boolean;
  readonly createsProposal: boolean;
  readonly requiresHumanApproval: boolean;
  readonly executesFinancialAction: false;
};

export const AGENT_TOOL_CATALOG: readonly AgentToolDefinition[] = Object.freeze([
  def('get_financial_snapshot', 'ACCOUNT_READ', false, false, false),
  def('get_account_activity', 'ACCOUNT_READ', false, false, false),
  def('resolve_recipient', 'PAYMENT_READ', false, false, false),
  def('get_payment_quote', 'PAYMENT_READ', false, false, false),
  def('create_payment_proposal', 'PAYMENT_PROPOSAL', true, true, true),
  def('revise_payment_proposal', 'PAYMENT_PROPOSAL', true, true, true),
  def('get_fx_quote', 'FX_READ', false, false, false),
  def('create_fx_proposal', 'FX_PROPOSAL', true, true, true),
  def('get_peg_profile', 'GROWTH_READ', false, false, false),
  def('list_growth_opportunities', 'GROWTH_READ', false, false, false),
  def('create_growth_proposal', 'GROWTH_PROPOSAL', true, true, true),
  def('get_portfolio', 'PORTFOLIO_READ', false, false, false),
  def('explain_portfolio', 'PORTFOLIO_READ', false, false, false),
  def('get_exchange_market', 'EXCHANGE_READ', false, false, false),
  def('create_exchange_proposal', 'EXCHANGE_PROPOSAL', true, true, true),
  def('get_custody_status', 'CUSTODY_READ', false, false, false),
  def('get_compliance_boundary', 'COMPLIANCE_READ', false, false, false),
  def('create_action_card', 'PAYMENT_PROPOSAL', true, true, true),
  def('request_human_approval', 'ESCALATION', true, false, true),
  def('record_preference', 'MEMORY', true, false, false),
  def('open_escalation', 'ESCALATION', true, false, false),
  def('get_action_status', 'CONVERSATION', false, false, false),
]);

function def(
  toolId: AgentToolId,
  category: AgentToolCategory,
  mutates: boolean,
  createsProposal: boolean,
  requiresHumanApproval: boolean,
): AgentToolDefinition {
  return Object.freeze({
    toolId,
    category,
    version: '1',
    mutates,
    createsProposal,
    requiresHumanApproval,
    executesFinancialAction: false,
  });
}

export function toolById(toolId: string): AgentToolDefinition | undefined {
  return AGENT_TOOL_CATALOG.find((row) => row.toolId === toolId);
}

export function isFinancialProposalTool(toolId: string): boolean {
  return (FINANCIAL_PROPOSAL_TOOL_IDS as readonly string[]).includes(toolId);
}

export function isKnownTool(toolId: string): toolId is AgentToolId {
  return (AGENT_TOOL_IDS as readonly string[]).includes(toolId);
}

export type GroundedMoney = {
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly source: 'TOOL';
};

export type FinancialSnapshot = {
  readonly ownerUserId: string;
  readonly totalMinor: bigint;
  readonly currency: string;
  readonly classBreakdown: Readonly<Record<string, string>>;
  readonly asOf: string;
  readonly source: 'LEDGER_PROJECTION';
};

export type RecipientView = {
  readonly recipientId: string;
  readonly ownerUserId: string;
  readonly displayName: string;
  readonly currency: string;
};

export type QuoteView = {
  readonly quoteId: string;
  readonly ownerUserId: string;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly feeMinor: bigint;
  readonly fxRateMinorPerUnit: bigint | null;
  readonly expiresAtMs: number;
  readonly source: 'SANDBOX_QUOTE_ENGINE';
};

export type PegView = {
  readonly ownerUserId: string;
  readonly obligationsMinor: bigint;
  readonly reserveGapMinor: bigint;
  readonly opportunities: readonly { readonly opportunityId: string; readonly label: string }[];
  readonly source: 'PERSONAL_ECONOMIC_GRAPH';
};

export type PortfolioView = {
  readonly ownerUserId: string;
  readonly valueMinor: bigint;
  readonly currency: string;
  readonly holdings: readonly { readonly instrumentId: string; readonly quantityMinor: bigint }[];
  readonly source: 'PORTFOLIO_READ_MODEL';
};

export type ToolRuntimePorts = {
  readonly snapshot: (userId: string) => FinancialSnapshot | null;
  readonly recipient: (userId: string, query: string) => RecipientView | null;
  readonly paymentQuote: (userId: string, amountMinor: bigint, currency: string, recipientId: string) => QuoteView | null;
  readonly fxQuote: (userId: string, amountMinor: bigint, source: string, target: string) => QuoteView | null;
  readonly peg: (userId: string) => PegView | null;
  readonly portfolio: (userId: string) => PortfolioView | null;
  readonly exchangeMarket: (userId: string, marketId: string) => { readonly marketId: string; readonly state: string } | null;
  readonly custody: (userId: string) => { readonly status: string; readonly ownerUserId: string } | null;
};

export type ToolExecution = {
  readonly toolId: AgentToolId;
  readonly ok: boolean;
  readonly grounded: boolean;
  readonly unavailable: boolean;
  readonly detail: string;
  readonly data: unknown;
};

export function executeReadTool(input: {
  readonly toolId: AgentToolId;
  readonly ownerUserId: string;
  readonly ports: ToolRuntimePorts;
  readonly query?: string;
  readonly amountMinor?: bigint;
  readonly currency?: string;
  readonly recipientId?: string;
  readonly sourceCurrency?: string;
  readonly targetCurrency?: string;
  readonly marketId?: string;
}): Result<ToolExecution, SecurityDenial> {
  const adversarial: AdversarialToolCall = {
    name: input.toolId,
    ownerUserId: input.ownerUserId,
    ...(input.amountMinor !== undefined ? { amountMinor: input.amountMinor } : {}),
    ...(input.currency !== undefined ? { currency: input.currency } : {}),
    ...(input.recipientId !== undefined ? { recipientId: input.recipientId } : {}),
  };
  const refused = refuseAdversarialToolCall(adversarial);
  if (!refused.ok) {
    return refused;
  }
  switch (input.toolId) {
    case 'get_financial_snapshot': {
      const snapshot = input.ports.snapshot(input.ownerUserId);
      return snapshot
        ? ok(hit(input.toolId, snapshot, 'ledger-projected snapshot'))
        : ok(unavailable(input.toolId, 'financial snapshot is temporarily unavailable'));
    }
    case 'resolve_recipient': {
      const recipient = input.ports.recipient(input.ownerUserId, input.query ?? '');
      return recipient
        ? ok(hit(input.toolId, recipient, 'recipient resolved'))
        : ok(unavailable(input.toolId, 'recipient is unavailable or unknown'));
    }
    case 'get_payment_quote': {
      if (!input.amountMinor || !input.currency || !input.recipientId) {
        return ok(unavailable(input.toolId, 'quote inputs are incomplete'));
      }
      const quote = input.ports.paymentQuote(input.ownerUserId, input.amountMinor, input.currency, input.recipientId);
      return quote
        ? ok(hit(input.toolId, quote, 'sandbox payment quote'))
        : ok(unavailable(input.toolId, 'payment quote is temporarily unavailable'));
    }
    case 'get_fx_quote': {
      if (!input.amountMinor || !input.sourceCurrency || !input.targetCurrency) {
        return ok(unavailable(input.toolId, 'FX quote inputs are incomplete'));
      }
      const quote = input.ports.fxQuote(input.ownerUserId, input.amountMinor, input.sourceCurrency, input.targetCurrency);
      return quote
        ? ok(hit(input.toolId, quote, 'sandbox FX quote'))
        : ok(unavailable(input.toolId, 'FX quote is temporarily unavailable'));
    }
    case 'get_peg_profile':
    case 'list_growth_opportunities': {
      const peg = input.ports.peg(input.ownerUserId);
      return peg
        ? ok(hit(input.toolId, peg, 'PEG read; not a valuation or return'))
        : ok(unavailable(input.toolId, 'personal economic graph is temporarily unavailable'));
    }
    case 'get_portfolio':
    case 'explain_portfolio': {
      const portfolio = input.ports.portfolio(input.ownerUserId);
      return portfolio
        ? ok(hit(input.toolId, portfolio, 'portfolio read model'))
        : ok(unavailable(input.toolId, 'portfolio is temporarily unavailable'));
    }
    case 'get_exchange_market': {
      const market = input.ports.exchangeMarket(input.ownerUserId, input.marketId ?? 'mkt_sandbox');
      return market
        ? ok(hit(input.toolId, market, 'exchange market explanation'))
        : ok(unavailable(input.toolId, 'exchange market is temporarily unavailable'));
    }
    case 'get_custody_status': {
      const custody = input.ports.custody(input.ownerUserId);
      return custody
        ? ok(hit(input.toolId, custody, 'custody status'))
        : ok(unavailable(input.toolId, 'custody status is temporarily unavailable'));
    }
    case 'get_account_activity':
    case 'get_compliance_boundary':
    case 'get_action_status':
      return ok(hit(input.toolId, { ownerUserId: input.ownerUserId }, 'subject-scoped read'));
    default:
      return ok(unavailable(input.toolId, 'tool is not a read tool'));
  }
}

function hit(toolId: AgentToolId, data: unknown, detail: string): ToolExecution {
  return Object.freeze({ toolId, ok: true, grounded: true, unavailable: false, detail, data });
}

function unavailable(toolId: AgentToolId, detail: string): ToolExecution {
  return Object.freeze({ toolId, ok: false, grounded: true, unavailable: true, detail, data: null });
}

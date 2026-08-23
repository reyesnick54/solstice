import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import { contentHash } from '../ids.ts';
import type { ActionCardType } from './taxonomy.ts';
import type {
  ConversationCatalog,
  ConversationToolName,
  ConversationToolResult,
  DomainProposalRef,
  MoneyTerm,
  ResolvableEntity,
} from './types.ts';
import { parseAmountToMinorUnits } from './slots.ts';

export type ConversationDomainPorts = {
  catalog(subjectId: string): ConversationCatalog;
  invokeTool(name: ConversationToolName, subjectId: string, args: Readonly<Record<string, string>>): ConversationToolResult;
  createProposal(input: {
    readonly subjectId: string;
    readonly kind: ActionCardType;
    readonly slots: Readonly<Record<string, string>>;
    readonly now: UtcInstant;
  }): DomainProposalRef | { readonly ok: false; readonly code: string; readonly message: string };
  modifyProposal(input: {
    readonly subjectId: string;
    readonly proposalId: string;
    readonly amountRaw: string;
    readonly now: UtcInstant;
  }): DomainProposalRef | { readonly ok: false; readonly code: string; readonly message: string };
  execute(input: {
    readonly subjectId: string;
    readonly proposalId: string;
    readonly approvalId: string;
  }): { readonly ok: true; readonly status: 'PROCESSING' | 'SUBMITTED' | 'COMPLETED' | 'FAILED' | 'REQUIRES_REVIEW' } | { readonly ok: false; readonly code: string; readonly message: string };
  getProposal(proposalId: string): DomainProposalRef | undefined;
};

type StoredProposal = DomainProposalRef & { readonly subjectId: string; readonly approved: boolean };

export function createConversationSandbox(input: {
  readonly subjectId: string;
  readonly now?: UtcInstant;
} = { subjectId: 'cust_conversation' }): ConversationDomainPorts {
  const subjectId = input.subjectId;
  const catalog = fixtureCatalog(subjectId);
  const proposals = new Map<string, StoredProposal>();
  const quotes = new Map<string, MoneyTerm>();

  const create: ConversationDomainPorts['createProposal'] = (request) => {
    if (request.subjectId !== subjectId) {
      return { ok: false, code: 'RESOURCE_NOT_OWNED', message: 'Cannot create a proposal for another customer.' };
    }
    if (request.kind === 'EXCHANGE') {
      const asset = request.slots.asset ?? '';
      const eligible = catalog.assets.find(
        (item) => item.id === asset || item.assetId === asset || item.labels.includes(asset),
      );
      if (!eligible || eligible.eligible === false) {
        return { ok: false, code: 'ELIGIBILITY_REFUSED', message: 'You are not eligible for that exchange instrument.' };
      }
    }
    const amount = moneyFromSlots(request.slots, request.kind);
    const fees = feeFor(request.kind, amount);
    const rate = request.kind === 'FX' ? fxRate(request.slots, quotes) : undefined;
    const id = `prp_${contentHash({ subjectId, kind: request.kind, slots: request.slots, now: request.now }).slice(0, 20)}`;
    const proposal = proposalOf({
      proposalId: id,
      version: 1,
      kind: request.kind,
      subjectId,
      amount,
      fees,
      ...(rate !== undefined ? { rate } : {}),
      slots: request.slots,
      now: request.now,
      supersedes: null,
    });
    proposals.set(id, proposal);
    return proposal;
  };

  return {
    catalog: (id) => (id === subjectId ? catalog : emptyCatalog(id)),
    invokeTool(name, id, args) {
      if (id !== subjectId) {
        return tool(name, false, { code: 'RESOURCE_NOT_OWNED' }, 'POLICY', 'UNKNOWN');
      }
      switch (name) {
        case 'getFinancialSnapshot':
          return tool(name, true, { currency: 'USD', minorUnits: '2500000', source: 'LEDGER_BACKED_ACCOUNT_SERVICE' }, 'LEDGER_BACKED_ACCOUNT_SERVICE', 'FACT');
        case 'getGrowthOpportunities':
          return tool(name, true, { count: 2, items: ['idle-cash', 'reserve-gap'] }, 'PERSONAL_ECONOMIC_GRAPH', 'FACT');
        case 'getGrowthPlan':
          return tool(name, true, { planId: 'gpl_sandbox', guaranteedOutcome: false }, 'GROWTH_SCENARIO_CONFIGURATION', 'PROJECTION');
        case 'getGrowthScenarios':
          return tool(
            name,
            true,
            { conservative: 'PROJECTION', base: 'PROJECTION', upside: 'PROJECTION', achievementPromised: false },
            'GROWTH_SCENARIO_CONFIGURATION',
            'PROJECTION',
          );
        case 'getFxQuote': {
          const rate = fxRate(args, quotes);
          return tool(name, true, { quoteId: 'fxq_sandbox', rate: rate.minorUnits, currencyPair: `${args.sourceCurrency ?? 'USD'}/${args.destinationCurrency ?? 'SAR'}` }, 'FX_QUOTE_PROVIDER', 'FACT');
        }
        case 'getMarketData':
          return tool(name, true, { instrument: args.asset ?? 'SUNREY_COIN', priceMinorUnits: '100', currency: 'USD' }, 'MARKET_DATA_PROVIDER', 'FACT');
        case 'checkExchangeEligibility': {
          const eligible = catalog.assets.some(
            (item) =>
              (item.id === args.asset || item.assetId === args.asset || item.labels.includes(args.asset ?? '')) &&
              item.eligible !== false,
          );
          return tool(name, eligible, { eligible }, 'POLICY', 'FACT');
        }
        case 'getProposalStatus':
        case 'getExecutionStatus': {
          const found = proposals.get(args.proposalId ?? args.executionId ?? '');
          return tool(name, Boolean(found), { proposalId: found?.proposalId ?? null, version: found?.version ?? null }, 'POLICY', 'FACT');
        }
        default:
          return tool(name, true, { accepted: true }, 'POLICY', 'FACT');
      }
    },
    createProposal: create,
    modifyProposal(request) {
      const existing = proposals.get(request.proposalId);
      if (!existing || existing.subjectId !== request.subjectId) {
        return { ok: false, code: 'RESOURCE_NOT_OWNED', message: 'Proposal is not on this customer.' };
      }
      if (existing.approved) {
        return { ok: false, code: 'PROPOSAL_ALREADY_APPROVED', message: 'Approved terms cannot be mutated. A new version is required before approval only.' };
      }
      const minor = parseAmountToMinorUnits(request.amountRaw);
      if (!minor) {
        return { ok: false, code: 'SLOT_REQUIRED', message: 'I will not guess a replacement amount.' };
      }
      const amount: MoneyTerm = { ...existing.amount, minorUnits: minor, source: 'USER_STATED', uncertainty: 'FACT' };
      const next = proposalOf({
        proposalId: `prp_${contentHash({ prior: existing.proposalId, minor, now: request.now }).slice(0, 20)}`,
        version: existing.version + 1,
        kind: existing.kind,
        subjectId: existing.subjectId,
        amount,
        fees: feeFor(existing.kind, amount),
        ...(existing.rate !== undefined ? { rate: existing.rate } : {}),
        slots: { amount: request.amountRaw },
        now: request.now,
        supersedes: existing.proposalId,
      });
      proposals.set(existing.proposalId, { ...existing, proposalId: existing.proposalId });
      proposals.set(next.proposalId, next);
      return next;
    },
    execute(request) {
      const existing = proposals.get(request.proposalId);
      if (!existing || existing.subjectId !== request.subjectId) {
        return { ok: false, code: 'RESOURCE_NOT_OWNED', message: 'Cannot execute another customer\'s proposal.' };
      }
      if (!request.approvalId.startsWith('aap_')) {
        return { ok: false, code: 'APPROVAL_REQUIRES_HUMAN', message: 'Execution requires a human approval record.' };
      }
      existing.approved;
      proposals.set(existing.proposalId, { ...existing, approved: true });
      return { ok: true, status: 'COMPLETED' };
    },
    getProposal(id) {
      return proposals.get(id);
    },
  };
}

export function fixtureCatalog(subjectId: string): ConversationCatalog {
  const account = (id: string, labels: readonly string[], currency: string): ResolvableEntity =>
    Object.freeze({ id, kind: 'ACCOUNT', ownerSubjectId: subjectId, labels, currency });
  const person = (id: string, labels: readonly string[]): ResolvableEntity =>
    Object.freeze({ id, kind: 'BENEFICIARY', ownerSubjectId: subjectId, labels });
  return Object.freeze({
    subjectId,
    accounts: Object.freeze([
      account('acct_usd_checking', ['checking', 'my USD account'], 'USD'),
      account('acct_usd_savings', ['savings', 'my savings'], 'USD'),
      account('acct_sar_current', ['SAR account', 'riyals'], 'SAR'),
      account('acct_moonrey', ['MoonRey holdings', 'my MoonRey holdings'], 'MOONREY'),
    ]),
    beneficiaries: Object.freeze([
      person('bnf_ahmed', ['Ahmed']),
      person('bnf_mark_a', ['Mark', 'Mark Ali']),
      person('bnf_mark_b', ['Mark', 'Mark Ben']),
    ]),
    holdings: Object.freeze([
      Object.freeze({
        id: 'hld_moonrey',
        kind: 'HOLDING' as const,
        ownerSubjectId: subjectId,
        labels: Object.freeze(['my MoonRey holdings', 'MoonRey']),
        assetId: 'MOONREY_COIN',
        currency: 'MOONREY',
      }),
    ]),
    cards: Object.freeze([
      Object.freeze({ id: 'card_virtual', kind: 'CARD' as const, ownerSubjectId: subjectId, labels: Object.freeze(['virtual card']) }),
    ]),
    goals: Object.freeze([
      Object.freeze({ id: 'goal_reserve', kind: 'GOAL' as const, ownerSubjectId: subjectId, labels: Object.freeze(['emergency reserve']) }),
    ]),
    assets: Object.freeze([
      Object.freeze({
        id: 'ast_sunrey',
        kind: 'ASSET' as const,
        ownerSubjectId: subjectId,
        labels: Object.freeze(['SUNREY_COIN', 'SunRey Coin']),
        assetId: 'SUNREY_COIN',
        eligible: true,
      }),
      Object.freeze({
        id: 'ast_restricted',
        kind: 'ASSET' as const,
        ownerSubjectId: subjectId,
        labels: Object.freeze(['RESTRICTED_COIN']),
        assetId: 'RESTRICTED_COIN',
        eligible: false,
      }),
    ]),
  });
}

function emptyCatalog(subjectId: string): ConversationCatalog {
  return Object.freeze({
    subjectId,
    accounts: Object.freeze([]),
    beneficiaries: Object.freeze([]),
    holdings: Object.freeze([]),
    cards: Object.freeze([]),
    goals: Object.freeze([]),
    assets: Object.freeze([]),
  });
}

function moneyFromSlots(slots: Readonly<Record<string, string>>, kind: ActionCardType): MoneyTerm {
  const raw = slots.amount ?? '0';
  const minor = parseAmountToMinorUnits(raw) ?? '0';
  const currency = kind === 'FX' ? slots.sourceCurrency ?? slots.currency ?? 'USD' : slots.currency ?? 'USD';
  return Object.freeze({
    currency,
    minorUnits: minor,
    uncertainty: 'FACT',
    source: 'USER_STATED',
  });
}

function feeFor(kind: ActionCardType, amount: MoneyTerm): MoneyTerm {
  const fee = kind === 'PAYMENT' || kind === 'FX' || kind === 'EXCHANGE' ? '250' : '0';
  return Object.freeze({
    currency: amount.currency,
    minorUnits: fee,
    uncertainty: 'ESTIMATE',
    source: 'POLICY',
  });
}

function fxRate(slots: Readonly<Record<string, string>>, quotes: Map<string, MoneyTerm>): MoneyTerm {
  const pair = `${slots.sourceCurrency ?? 'USD'}/${slots.destinationCurrency ?? 'SAR'}`;
  const existing = quotes.get(pair);
  if (existing) {
    return existing;
  }
  const rate = Object.freeze({
    currency: slots.destinationCurrency ?? 'SAR',
    minorUnits: pair === 'USD/SAR' ? '375000' : '100000',
    uncertainty: 'FACT' as const,
    source: 'FX_QUOTE_PROVIDER' as const,
  });
  quotes.set(pair, rate);
  return rate;
}

function proposalOf(input: {
  readonly proposalId: string;
  readonly version: number;
  readonly kind: ActionCardType;
  readonly subjectId: string;
  readonly amount: MoneyTerm;
  readonly fees: MoneyTerm;
  readonly rate?: MoneyTerm;
  readonly slots: Readonly<Record<string, string>>;
  readonly now: UtcInstant;
  readonly supersedes: string | null;
}): StoredProposal {
  const expiry = asUtcInstant(new Date(Date.parse(input.now) + 30 * 60 * 1000).toISOString());
  const highImpact = BigInt(input.amount.minorUnits) >= 50_000n;
  return Object.freeze({
    proposalId: input.proposalId,
    version: input.version,
    kind: input.kind,
    contentHash: contentHash({
      kind: input.kind,
      amount: input.amount,
      fees: input.fees,
      rate: input.rate ?? null,
      slots: input.slots,
    }),
    supersedesProposalId: input.supersedes,
    serverIssued: true,
    clientFabricated: false,
    amount: input.amount,
    fees: input.fees,
    ...(input.rate !== undefined ? { rate: input.rate } : {}),
    destinationLabel: input.slots.recipient ?? input.slots.destination ?? input.slots.asset ?? input.kind,
    sourceLabel: input.slots.sourceAccount ?? 'source account',
    assetLabel: input.slots.asset ?? input.amount.currency,
    riskSummary:
      input.kind === 'GROWTH' || input.kind === 'INVESTMENT'
        ? 'Scenario bands are projections. Achievement is not promised.'
        : 'Simulation settlement only. Production money movement is disabled.',
    expiry,
    requiresStepUp: highImpact || input.kind === 'EXCHANGE' || input.kind === 'GROWTH' || input.kind === 'INVESTMENT',
    requiresAcknowledgements: highImpact,
    executionAuthorityId: null,
    subjectId: input.subjectId,
    approved: false,
  });
}

function tool(
  name: ConversationToolName,
  ok: boolean,
  value: Readonly<Record<string, unknown>>,
  source: ConversationToolResult['source'],
  uncertainty: ConversationToolResult['uncertainty'],
): ConversationToolResult {
  return Object.freeze({ tool: name, ok, value, mayExecute: false, source, uncertainty });
}

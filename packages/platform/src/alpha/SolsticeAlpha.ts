import { Money } from '../../../contracts/src/money.ts';
import { asAccountId, asCustomerId } from '../../../contracts/src/ids.ts';
import { asUtcInstant, type UtcInstant } from '../../../contracts/src/time.ts';
import type { InvestmentAccountPreconditions } from '../../../contracts/src/investment-types.ts';
import type { ExecutionAuthority } from '../authority/ExecutionAuthority.ts';
import type { AuthorityIssuer } from '../authority/ExecutionAuthority.ts';
import type { EvidenceVault } from '../evidence/EvidenceVault.ts';
import type { DomainEventLog } from '../events/DomainEventLog.ts';
import type { Clock } from '../clock.ts';
import { assertSimulationOnly } from '../flags/live.ts';
import {
  InvestmentLedger,
  openInvestmentAccount,
  sweepDepositToInvestmentCash,
  weeklyHarvest,
  type InvestmentAccount,
} from '../../../investments/src/index.ts';
import { missingFromPartial } from '../../../investments/src/preconditions.ts';
import { PortfolioEngine } from '../../../investments/src/portfolio.ts';
import type {
  ActionIntent,
  OpenInvestmentAccountPayload,
  SweepDepositPayload,
  WeeklyHarvestPayload,
} from '../kernel/ActionIntent.ts';
import { ActionType } from '../kernel/ActionIntent.ts';
import type { KernelDecision } from '../kernel/ComplianceKernel.ts';

export type AlphaServices = {
  readonly ledger: InvestmentLedger;
  readonly accounts: Map<string, InvestmentAccount>;
  readonly portfolios: Map<string, PortfolioEngine>;
  readonly depositAccountIds: Map<string, string>;
};

export function createAlphaServices(): AlphaServices {
  return {
    ledger: new InvestmentLedger(),
    accounts: new Map(),
    portfolios: new Map(),
    depositAccountIds: new Map(),
  };
}

export class SolsticeAlpha {
  readonly services: AlphaServices;
  private readonly authorityIssuer: AuthorityIssuer;
  private readonly evidence: EvidenceVault;
  private readonly events: DomainEventLog;
  private readonly clock: Clock;

  constructor(
    services: AlphaServices,
    authorityIssuer: AuthorityIssuer,
    evidence: EvidenceVault,
    events: DomainEventLog,
    clock: Clock,
  ) {
    this.services = services;
    this.authorityIssuer = authorityIssuer;
    this.evidence = evidence;
    this.events = events;
    this.clock = clock;
  }

  submit(intent: ActionIntent): KernelDecision {
    assertSimulationOnly();
    if (intent.actionType === ActionType.OPEN_INVESTMENT_ACCOUNT) {
      return this.openInvestment(intent as ActionIntent<OpenInvestmentAccountPayload>);
    }
    if (intent.actionType === ActionType.SWEEP_DEPOSIT_TO_INVESTMENT) {
      return this.sweep(intent as ActionIntent<SweepDepositPayload>);
    }
    if (intent.actionType === ActionType.WEEKLY_HARVEST) {
      return this.harvest(intent as ActionIntent<WeeklyHarvestPayload>);
    }
    const evidence = this.evidence.seal('INTENT_REFUSED', {
      actionType: intent.actionType,
      reason: 'unknown alpha actionType',
    });
    return {
      outcome: 'REFUSED',
      reason: `unknown actionType: ${intent.actionType}`,
      evidenceId: evidence.evidenceId,
    };
  }

  issueAuthority(
    actionType: string,
    accountId: string,
    amount: Money,
    idempotencyKey: string,
    now: UtcInstant,
  ): ExecutionAuthority {
    return this.authorityIssuer.issue({
      authorityId: `ea_${idempotencyKey}`,
      actionType,
      accountId,
      amount,
      idempotencyKey,
      issuedAt: now,
      expiresAt: asUtcInstant(new Date(Date.parse(now) + 60_000).toISOString()),
    });
  }

  private openInvestment(intent: ActionIntent<OpenInvestmentAccountPayload>): KernelDecision {
    const payload = intent.payload;
    const now = asUtcInstant(intent.requestedAt);
    const missing = missingFromPartial({
      agreement: payload.agreementVersion
        ? { version: payload.agreementVersion, acceptedAt: now }
        : undefined,
      riskProfile: payload.riskProfileCurrent
        ? { ceiling: 'MODERATE', assessedAt: now, current: true as const }
        : undefined,
      disclosure: payload.disclosureVersion
        ? { version: payload.disclosureVersion, acknowledgedAt: now, current: true as const }
        : undefined,
      transferAuthorization: payload.transferAuthorized
        ? {
            authorized: true as const,
            authorizedAt: now,
            scope: 'DEPOSIT_TO_INVESTMENT_SWEEP' as const,
          }
        : undefined,
    });
    if (missing) {
      const evidence = this.evidence.seal('INVESTMENT_ACCOUNT_REFUSED', {
        reason: missing,
        actionType: intent.actionType,
      });
      this.events.append('investment.account.refused', now, { reason: missing });
      return { outcome: 'REFUSED', reason: missing, evidenceId: evidence.evidenceId };
    }
    const preconditions: InvestmentAccountPreconditions = {
      agreement: { version: payload.agreementVersion!, acceptedAt: now },
      riskProfile: { ceiling: 'MODERATE', assessedAt: now, current: true },
      disclosure: { version: payload.disclosureVersion!, acknowledgedAt: now, current: true },
      transferAuthorization: {
        authorized: true,
        authorizedAt: now,
        scope: 'DEPOSIT_TO_INVESTMENT_SWEEP',
      },
    };
    const authority = this.issueAuthority(
      intent.actionType,
      payload.accountId,
      Money.zero('USD'),
      intent.idempotencyKey,
      now,
    );
    const opened = openInvestmentAccount(
      {
        id: asAccountId(payload.accountId),
        ownerId: asCustomerId(payload.ownerId),
        cashAccountId: asAccountId(payload.cashAccountId),
        securitiesAccountId: asAccountId(payload.securitiesAccountId),
        openedAt: now,
        ...preconditions,
      },
      authority,
    );
    if (!opened.ok) {
      const evidence = this.evidence.seal('INVESTMENT_ACCOUNT_REFUSED', {
        reason: opened.missing,
      });
      this.events.append('investment.account.refused', now, { reason: opened.missing });
      return { outcome: 'REFUSED', reason: opened.missing, evidenceId: evidence.evidenceId };
    }
    this.services.accounts.set(opened.account.id, opened.account);
    this.services.portfolios.set(
      opened.account.id,
      new PortfolioEngine(opened.account.id, opened.account.ownerId),
    );
    const evidence = this.evidence.seal('INVESTMENT_ACCOUNT_OPENED', {
      accountId: opened.account.id,
      authorityId: authority.authorityId,
    });
    this.events.append('investment.account.opened', now, { accountId: opened.account.id });
    return {
      outcome: 'ALLOWED',
      reason: `investment account ${opened.account.id} opened`,
      evidenceId: evidence.evidenceId,
    };
  }

  private sweep(intent: ActionIntent<SweepDepositPayload>): KernelDecision {
    const now = asUtcInstant(intent.requestedAt);
    const account = this.services.accounts.get(intent.payload.investmentAccountId);
    if (!account) {
      const evidence = this.evidence.seal('INVESTMENT_SWEEP_REFUSED', { reason: 'NO_ACCOUNT' });
      return { outcome: 'REFUSED', reason: 'investment account not found', evidenceId: evidence.evidenceId };
    }
    const authority = this.issueAuthority(
      intent.actionType,
      intent.payload.depositAccountId,
      intent.payload.amount,
      intent.idempotencyKey,
      now,
    );
    const result = sweepDepositToInvestmentCash(
      this.services.ledger,
      account,
      intent.payload.depositAccountId,
      intent.payload.amount,
      now,
      authority,
    );
    if (!result.ok) {
      const evidence = this.evidence.seal('INVESTMENT_SWEEP_REFUSED', { code: result.code });
      this.events.append('investment.sweep.refused', now, { code: result.code });
      return { outcome: 'REFUSED', reason: result.code, evidenceId: evidence.evidenceId };
    }
    const evidence = this.evidence.seal('INVESTMENT_SWEEP_POSTED', {
      journalId: result.journal.id,
      bridge: result.journal.classBridgeName,
    });
    this.events.append('investment.sweep.posted', now, { journalId: result.journal.id });
    return {
      outcome: 'ALLOWED',
      reason: `sweep posted via ${result.journal.classBridgeName}`,
      evidenceId: evidence.evidenceId,
    };
  }

  private harvest(intent: ActionIntent<WeeklyHarvestPayload>): KernelDecision {
    const now = asUtcInstant(intent.requestedAt);
    const account = this.services.accounts.get(intent.payload.investmentAccountId);
    const portfolio = this.services.portfolios.get(intent.payload.investmentAccountId);
    if (!account || !portfolio) {
      const evidence = this.evidence.seal('HARVEST_REFUSED', { reason: 'NO_ACCOUNT' });
      return { outcome: 'REFUSED', reason: 'investment account not found', evidenceId: evidence.evidenceId };
    }
    const realized = portfolio.realizedSettled();
    const authority = this.issueAuthority(
      intent.actionType,
      account.cashAccountId,
      realized.amount,
      intent.idempotencyKey,
      now,
    );
    const result = weeklyHarvest(
      this.services.ledger,
      account,
      intent.payload.depositAccountId,
      realized,
      intent.payload.share,
      now,
      authority,
    );
    if (!result.ok) {
      const evidence = this.evidence.seal('HARVEST_REFUSED', { code: result.code });
      this.events.append('harvest.refused', now, { code: result.code });
      return { outcome: 'REFUSED', reason: result.code, evidenceId: evidence.evidenceId };
    }
    portfolio.consumeRealizedSettled(result.swept);
    const evidence = this.evidence.seal('HARVEST_POSTED', {
      journalId: result.journal.id,
      swept: result.swept.toJSON(),
    });
    this.events.append('harvest.posted', now, { journalId: result.journal.id });
    return {
      outcome: 'ALLOWED',
      reason: `weekly harvest posted via ${result.journal.classBridgeName}`,
      evidenceId: evidence.evidenceId,
    };
  }
}

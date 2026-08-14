import type { ComplianceKernelPort } from '@solstice/compliance-kernel';
import { isErr } from '@solstice/domain';
import type { EvidenceVault } from '@solstice/evidence-vault';
import { assertSimulationOnly } from '@solstice/flags';
import {
  ActionType,
  isAllow,
  type ActionIntent,
  type AuthorizationDecision,
  type AuthorityIssuer,
  type Clock,
  type OpenAccountPayload,
} from '@solstice/permissions';

import { Account, accountOpenedV1, type AccountOpenedV1 } from './account.ts';
import {
  verifyExecutionAuthority,
  type AuthorityRejection,
} from './verify-authority.ts';

export type OpenAccountResult = {
  readonly decision: AuthorizationDecision;
  readonly account?: Account;
  readonly event?: AccountOpenedV1;
  readonly executionRejected?: AuthorityRejection;
  readonly replay: boolean;
};

/**
 * Accounts service. The only entry point that can open an account.
 *
 * It submits the intent to the Compliance Kernel. It does not evaluate
 * any proof, replicate any policy check, or short-circuit on any
 * condition. On ALLOW it verifies the Execution Authority, then constructs
 * the Account with that validated authority. On any other Kernel status
 * it creates no account and returns the Kernel decision unchanged.
 */
export class AccountsService {
  private readonly accounts = new Map<string, Account>();
  private readonly resultsByIntent = new Map<string, OpenAccountResult>();
  private readonly events: AccountOpenedV1[] = [];
  private readonly kernel: ComplianceKernelPort;
  private readonly issuer: AuthorityIssuer;
  private readonly evidence: EvidenceVault;
  private readonly clock: Clock;

  constructor(
    kernel: ComplianceKernelPort,
    issuer: AuthorityIssuer,
    evidence: EvidenceVault,
    clock: Clock,
  ) {
    this.kernel = kernel;
    this.issuer = issuer;
    this.evidence = evidence;
    this.clock = clock;
  }

  /**
   * Single entry point. Accepts an OPEN_ACCOUNT ActionIntent.
   */
  openAccount(intent: ActionIntent & { readonly executionAuthority?: never }): OpenAccountResult {
    assertSimulationOnly();

    const existing = this.resultsByIntent.get(intent.intentId);
    if (existing) {
      this.evidence.seal('ACCOUNT_OPEN_REPLAY', {
        intentId: intent.intentId,
        actionType: intent.actionType,
        status: existing.decision.status,
        accountId: existing.account?.id ?? null,
        replay: true,
      });
      return Object.freeze({ ...existing, replay: true });
    }

    const decision = this.kernel.submit(intent);

    if (!isAllow(decision)) {
      const result: OpenAccountResult = Object.freeze({
        decision,
        replay: false,
      });
      this.resultsByIntent.set(intent.intentId, result);
      this.evidence.seal('ACCOUNT_OPEN_REFUSED', {
        intentId: intent.intentId,
        actionType: intent.actionType,
        status: decision.status,
        reason: decision.reason,
        accountCreated: false,
      });
      return result;
    }

    const payload = intent.payload as OpenAccountPayload;
    const verified = verifyExecutionAuthority(
      decision.executionAuthority,
      {
        actionType: ActionType.OPEN_ACCOUNT,
        accountId: payload.accountId,
        intentId: intent.intentId,
      },
      this.issuer,
      this.clock,
    );

    if (isErr(verified)) {
      const result: OpenAccountResult = Object.freeze({
        decision,
        executionRejected: verified.error,
        replay: false,
      });
      this.resultsByIntent.set(intent.intentId, result);
      this.evidence.seal('ACCOUNT_OPEN_AUTHORITY_REJECTED', {
        intentId: intent.intentId,
        actionType: intent.actionType,
        status: decision.status,
        rejection: verified.error,
        accountCreated: false,
      });
      return result;
    }

    const account = Account.fromValidatedAuthority(
      verified.value,
      payload,
      this.clock.now().toISOString(),
    );
    this.accounts.set(account.id, account);
    const event = accountOpenedV1(account);
    this.events.push(event);

    const result: OpenAccountResult = Object.freeze({
      decision,
      account,
      event,
      replay: false,
    });
    this.resultsByIntent.set(intent.intentId, result);
    this.evidence.seal('ACCOUNT_OPENED', {
      intentId: intent.intentId,
      actionType: intent.actionType,
      status: decision.status,
      accountId: account.id,
      authorityId: account.openedByAuthorityId,
      eventType: event.eventType,
      schemaVersion: event.schemaVersion,
    });
    return result;
  }

  getAccount(accountId: string): Account | undefined {
    return this.accounts.get(accountId);
  }

  listAccounts(): readonly Account[] {
    return [...this.accounts.values()];
  }

  accountCount(): number {
    return this.accounts.size;
  }

  listEvents(): readonly AccountOpenedV1[] {
    return this.events.slice();
  }
}

import type { Clock } from '../../config/src/clock.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import { emptyUsage, recordUsage, rolloverUsage } from './budget.ts';
import { explainProposal } from './explain.ts';
import { evaluateAgentExchangePath, exchangeRefusal } from './exchange.ts';
import { ProposalGate, type KernelSubmitPort } from './gate.ts';
import {
  agentIdFor,
  approvalIdFor,
  asMandatePolicyVersion,
  asUserAgentId,
  asUserAgentMandateId,
  contentHash,
  mandateIdFor,
  proposalIdFor,
  receiptIdFor,
  revocationIdFor,
  safetyEventIdFor,
} from './ids.ts';
import { replayedApproval, signingIntentSummary } from './mobile.ts';
import { approvalSatisfied, detectPromptInjection, evaluateMandateForProposal } from './policy.ts';
import { InMemoryAgentMandateStore } from './store.ts';
import { EXECUTABLE_ACTION_CLASSES, isHighRiskAction } from './taxonomy.ts';
import type {
  AgentActivityReport,
  AgentApprovalRequirement,
  AgentBudget,
  AgentExecutionReceipt,
  AgentExplanation,
  AgentMandateUsage,
  AgentPermission,
  AgentSafetyEvent,
  AgentTransactionProposal,
  ExchangeEligibilityView,
  JurisdictionView,
  MandateOwner,
  MandateRefusal,
  RiskRestrictionView,
  SigningIntentSummary,
  UserAgent,
  UserAgentMandate,
  WalletAuthorizationView,
} from './types.ts';
import type { AgentActionClass, AgentApprovalClass, MandateMode, SafetyEventKind } from './taxonomy.ts';

export type CreateMandateInput = {
  readonly owner: MandateOwner;
  readonly agentLabel: string;
  readonly modelRef: string;
  readonly policyRef: string;
  readonly mode: MandateMode;
  readonly environment: 'simulation' | 'sandbox';
  readonly permissions: AgentPermission;
  readonly budget: AgentBudget;
  readonly approval: AgentApprovalRequirement;
  readonly expiry: UserAgentMandate['policy']['expiry'];
  readonly frequencyMaxPerPeriod: number;
  readonly riskPolicyId: string;
  readonly jurisdictionPackId: string | null;
  readonly delegatedSigningKeyId: string | null;
  readonly createdByActorId: string;
  readonly economicMandateRef?: string;
};

export type CreateProposalInput = {
  readonly mandateId: string;
  readonly intent: string;
  readonly reasonCode: string;
  readonly strategyRef: string | null;
  readonly assetId: string;
  readonly quantity: bigint;
  readonly destinationOrMarket: string;
  readonly fees: bigint;
  readonly expectedOutcomeClass: AgentTransactionProposal['expectedOutcomeClass'];
  readonly operationalRationale: string;
  readonly modelRef: string;
  readonly networkId: string;
};

export type ExecutionContext = {
  readonly wallet: WalletAuthorizationView;
  readonly networkId: string;
  readonly jurisdiction: JurisdictionView;
  readonly risk: RiskRestrictionView;
  readonly exchange?: ExchangeEligibilityView;
  readonly kernelStateHash: string;
  readonly humanApproved: boolean;
  readonly approvalNonce?: string;
  readonly approvalClassUsed?: AgentApprovalClass;
  readonly actorId: string;
  readonly signerIsAiIdentity: boolean;
  readonly usesMasterKey: boolean;
  readonly walletAuthorize?: () => { readonly ok: true } | MandateRefusal;
};

export class UserAgentMandateEngine {
  readonly store: InMemoryAgentMandateStore;
  readonly gate: ProposalGate;
  private readonly clock: Clock;

  constructor(input: { readonly clock: Clock; readonly kernel?: KernelSubmitPort | null }) {
    this.clock = input.clock;
    this.store = new InMemoryAgentMandateStore();
    this.gate = new ProposalGate(input.kernel ?? null);
  }

  createAgent(input: {
    readonly owner: MandateOwner;
    readonly label: string;
    readonly modelRef: string;
    readonly policyRef: string;
    readonly createdByActorId: string;
  }): Result<UserAgent, MandateRefusal> {
    if (!input.owner.ownerId || !input.owner.walletId || !input.owner.accountId) {
      return err({ ok: false, code: 'ORPHAN_AGENT', detail: 'every agent must belong to an explicit owner, wallet, and account' });
    }
    const agent: UserAgent = Object.freeze({
      agentId: agentIdFor(input.owner.ownerId, input.label),
      owner: input.owner,
      label: input.label,
      modelRef: input.modelRef,
      policyRef: input.policyRef,
      createdAt: this.clock.now(),
      status: 'ACTIVE',
      receivesMasterKey: false,
    });
    this.store.putAgent(agent);
    this.recordActivity(input.owner, 'MANDATE', `created agent ${agent.agentId}`, [agent.agentId]);
    return ok(agent);
  }

  createMandate(input: CreateMandateInput): Result<UserAgentMandate, MandateRefusal> {
    if (input.createdByActorId.startsWith('agent:')) {
      return err({ ok: false, code: 'SELF_EXPANSION_FORBIDDEN', detail: 'an agent cannot create or expand a mandate' });
    }
    if (!input.owner.ownerId || !input.owner.walletId || !input.owner.accountId) {
      return err({ ok: false, code: 'ORPHAN_AGENT', detail: 'mandate must bind user/wallet/account' });
    }
    if (input.permissions.allowWildcardAssets !== false) {
      return err({ ok: false, code: 'WILDCARD_ASSET_FORBIDDEN', detail: 'wildcard assets require explicit configuration and are refused by default' });
    }
    const existing = this.createAgent({
      owner: input.owner,
      label: input.agentLabel,
      modelRef: input.modelRef,
      policyRef: input.policyRef,
      createdByActorId: input.createdByActorId,
    });
    if (!existing.ok) {
      return existing;
    }
    const now = this.clock.now();
    const mandateId = mandateIdFor(input.owner.ownerId, existing.value.agentId, 1);
    const draft = {
      mandateId,
      agentId: existing.value.agentId,
      owner: input.owner,
      state: 'ACTIVE' as const,
      policy: Object.freeze({
        policyVersion: asMandatePolicyVersion(1),
        mode: input.mode,
        environment: input.environment,
        riskPolicyId: input.riskPolicyId,
        jurisdictionPackId: input.jurisdictionPackId,
        frequencyMaxPerPeriod: input.frequencyMaxPerPeriod,
        expiry: input.expiry,
        approval: input.approval,
        delegatedSigningKeyId: input.delegatedSigningKeyId,
        revocationPolicy: 'FUTURE_AUTHORIZATION_ONLY' as const,
        pendingAfterRevocation: 'INELIGIBLE' as const,
      }),
      permissions: Object.freeze({
        ...input.permissions,
        actionClasses: Object.freeze([...input.permissions.actionClasses]),
        assets: Object.freeze([...input.permissions.assets]),
        markets: Object.freeze([...input.permissions.markets]),
        destinations: Object.freeze([...input.permissions.destinations]),
        allowWildcardAssets: false as const,
      }),
      budget: Object.freeze({
        ...input.budget,
        perAsset: Object.freeze({ ...input.budget.perAsset }),
        perMarket: Object.freeze({ ...input.budget.perMarket }),
        perActionClass: Object.freeze({ ...input.budget.perActionClass }),
      }),
      createdByActorId: input.createdByActorId,
      createdAt: now,
      ...(input.economicMandateRef ? { economicMandateRef: input.economicMandateRef } : {}),
    };
    const mandate: UserAgentMandate = Object.freeze({
      ...draft,
      mandateHash: contentHash(draft),
    });
    this.store.putMandate(mandate);
    this.store.putUsage(emptyUsage(mandate.mandateId, now));
    this.recordActivity(input.owner, 'MANDATE', `created mandate ${mandate.mandateId}`, [mandate.mandateId]);
    return ok(mandate);
  }

  getMandate(mandateId: string): UserAgentMandate | undefined {
    return this.store.mandates.get(asUserAgentMandateId(mandateId));
  }

  getAgent(agentId: string): UserAgent | undefined {
    return this.store.agents.get(asUserAgentId(agentId));
  }

  createProposal(input: CreateProposalInput): Result<AgentTransactionProposal, MandateRefusal> {
    const mandate = this.getMandate(input.mandateId);
    if (!mandate) {
      return err({ ok: false, code: 'MANDATE_REVOKED', detail: 'mandate not found' });
    }
    if (detectPromptInjection(input.operationalRationale) || detectPromptInjection(input.reasonCode)) {
      this.safety(mandate, null, 'PROMPT_INJECTION_BLOCKED', 'prompt-injection attempt blocked');
      return err({ ok: false, code: 'PROMPT_INJECTION', detail: 'prompt-injection content cannot create a proposal' });
    }
    const now = this.clock.now();
    const draft = {
      mandateId: mandate.mandateId,
      mandateHash: mandate.mandateHash,
      policyVersion: mandate.policy.policyVersion,
      agentId: mandate.agentId,
      intent: input.intent,
      reasonCode: input.reasonCode,
      strategyRef: input.strategyRef,
      assetId: input.assetId,
      quantity: input.quantity,
      destinationOrMarket: input.destinationOrMarket,
      fees: input.fees,
      riskCheckIds: Object.freeze(['mandate-policy', mandate.policy.riskPolicyId]),
      expectedOutcomeClass: input.expectedOutcomeClass,
      modelRef: input.modelRef,
      operationalRationale: input.operationalRationale,
      guaranteedReturn: false as const,
      createdAt: now,
      walletId: mandate.owner.walletId,
      networkId: input.networkId,
    };
    const proposalHash = contentHash(draft);
    const proposal: AgentTransactionProposal = Object.freeze({
      ...draft,
      proposalId: proposalIdFor(mandate.mandateId, proposalHash),
      state: 'DRAFT',
      proposalHash,
    });
    const usage = this.usageOf(mandate);
    const check = evaluateMandateForProposal({
      mandate,
      usage,
      proposal,
      now,
      walletId: mandate.owner.walletId,
      networkId: input.networkId,
      jurisdictionAvailable: true,
    });
    if (!check.ok) {
      this.safety(mandate, proposal, check.code === 'SELF_EXPANSION_FORBIDDEN' ? 'SELF_EXPANSION_ATTEMPT' : 'MANDATE_LIMIT_REJECTION', check.detail);
      return err(check);
    }
    const pending = mandate.policy.approval.class === 'NO_ADDITIONAL_APPROVAL_WITHIN_MANDATE' ? 'APPROVED' : 'PENDING_APPROVAL';
    const stored = Object.freeze({ ...proposal, state: pending as AgentTransactionProposal['state'] });
    this.store.putProposal(stored);
    this.recordActivity(mandate.owner, 'PROPOSAL', `proposal ${stored.proposalId} ${stored.intent}`, [stored.proposalId]);
    return ok(stored);
  }

  approveProposal(input: {
    readonly proposalId: string;
    readonly actorId: string;
    readonly approvalClass: AgentApprovalClass;
    readonly nonce: string;
  }): Result<SigningIntentSummary, MandateRefusal> {
    const proposal = this.store.proposals.get(input.proposalId as AgentTransactionProposal['proposalId']);
    if (!proposal) {
      return err({ ok: false, code: 'APPROVAL_REQUIRED', detail: 'proposal not found' });
    }
    const mandate = this.getMandate(proposal.mandateId);
    if (!mandate || mandate.state === 'REVOKED') {
      if (proposal) {
        this.store.putProposal(Object.freeze({ ...proposal, state: 'INELIGIBLE' }));
      }
      return err({ ok: false, code: 'PENDING_INELIGIBLE_AFTER_REVOCATION', detail: 'revocation makes pending proposals ineligible' });
    }
    if (input.actorId.startsWith('agent:')) {
      return err({ ok: false, code: 'AI_CANNOT_SIGN', detail: 'AI identity cannot approve its own proposal' });
    }
    if (replayedApproval(input.nonce, this.store.usedApprovalNonces)) {
      return err({ ok: false, code: 'APPROVAL_REPLAY', detail: 'approval nonce already consumed' });
    }
    const satisfied = approvalSatisfied({
      mandate,
      proposal,
      humanApproved: true,
      approvalClassUsed: input.approvalClass,
    });
    if (!satisfied.ok) {
      return err(satisfied);
    }
    this.store.usedApprovalNonces.add(input.nonce);
    this.store.putProposal(Object.freeze({ ...proposal, state: 'APPROVED' }));
    const summary = signingIntentSummary(mandate, proposal, input.approvalClass);
    this.recordActivity(mandate.owner, 'APPROVAL', `approved ${proposal.proposalId}`, [approvalIdFor(proposal.proposalId, input.actorId, this.clock.now())]);
    return ok(summary);
  }

  requestExecution(proposalId: string, context: ExecutionContext): Result<AgentExecutionReceipt, MandateRefusal> {
    const proposal = this.store.proposals.get(proposalId as AgentTransactionProposal['proposalId']);
    if (!proposal) {
      return err({ ok: false, code: 'APPROVAL_REQUIRED', detail: 'proposal not found' });
    }
    const mandate = this.getMandate(proposal.mandateId);
    if (!mandate) {
      return err({ ok: false, code: 'MANDATE_REVOKED', detail: 'mandate not found' });
    }
    if (mandate.state === 'REVOKED') {
      this.store.putProposal(Object.freeze({ ...proposal, state: 'INELIGIBLE' }));
      this.safety(mandate, proposal, 'REVOKED_MANDATE_USED', 'revoked mandate cannot authorize');
      return err({ ok: false, code: 'PENDING_INELIGIBLE_AFTER_REVOCATION', detail: 'unexecuted pending proposals are ineligible after revocation' });
    }
    if (context.signerIsAiIdentity) {
      this.safety(mandate, proposal, 'AI_IDENTITY_SIGN_ATTEMPT', 'AI identity attempted to sign');
      return err({ ok: false, code: 'AI_CANNOT_SIGN', detail: 'AI identity alone cannot authorize' });
    }
    if (context.usesMasterKey) {
      return err({ ok: false, code: 'MASTER_KEY_FORBIDDEN', detail: 'agent never receives unrestricted master authority' });
    }
    if (context.wallet.walletId !== mandate.owner.walletId) {
      return err({ ok: false, code: 'WRONG_WALLET', detail: 'execution wallet does not match mandate' });
    }
    if (context.networkId !== proposal.networkId) {
      return err({ ok: false, code: 'WRONG_NETWORK', detail: 'execution network does not match proposal' });
    }
    if (mandate.policy.mode === 'SIMULATION_ONLY' && EXECUTABLE_ACTION_CLASSES.has(proposal.intent as AgentActionClass)) {
      return err({ ok: false, code: 'SIMULATION_CANNOT_SUBMIT', detail: 'SIMULATION_ONLY mandate cannot submit real transactions' });
    }
    if (mandate.policy.mode === 'PRODUCTION') {
      const ready =
        mandate.state === 'ACTIVE' &&
        context.wallet.masterKeyHeldByAgent === false &&
        context.jurisdiction.actionAvailable;
      if (!ready) {
        return err({ ok: false, code: 'PRODUCTION_PRECONDITIONS_UNMET', detail: 'production action requires real mandate, policy, capability, and eligibility' });
      }
    }
    const usage = this.usageOf(mandate);
    const check = evaluateMandateForProposal({
      mandate,
      usage,
      proposal,
      now: this.clock.now(),
      walletId: context.wallet.walletId,
      networkId: context.networkId,
      jurisdictionAvailable: context.jurisdiction.actionAvailable,
    });
    if (!check.ok) {
      this.safety(mandate, proposal, 'MANDATE_LIMIT_REJECTION', check.detail);
      return err(check);
    }
    if (isHighRiskAction(proposal.intent) && !context.humanApproved) {
      return err({ ok: false, code: 'HIGH_RISK_REQUIRES_HUMAN', detail: 'human-required action cannot execute without approval' });
    }
    const approval = approvalSatisfied({
      mandate,
      proposal,
      humanApproved: context.humanApproved || mandate.policy.approval.class === 'NO_ADDITIONAL_APPROVAL_WITHIN_MANDATE',
      approvalClassUsed: context.approvalClassUsed,
    });
    if (!approval.ok) {
      return err(approval);
    }
    if (context.approvalNonce && replayedApproval(context.approvalNonce, this.store.usedApprovalNonces)) {
      return err({ ok: false, code: 'APPROVAL_REPLAY', detail: 'replayed approval cannot authorize' });
    }
    if (!context.jurisdiction.actionAvailable) {
      return err({ ok: false, code: 'JURISDICTION_UNAVAILABLE', detail: 'jurisdiction pack does not permit this action' });
    }
    if (context.risk.restricted) {
      this.safety(mandate, proposal, 'COMPLIANCE_REJECTION', context.risk.reason ?? 'risk restricted');
      return err({ ok: false, code: 'RISK_RESTRICTED', detail: context.risk.reason ?? 'risk engine restricted the action' });
    }
    if (proposal.intent === 'EXECUTE_BOUNDED_EXCHANGE_ORDER') {
      const view =
        context.exchange ??
        evaluateAgentExchangePath({
          marketId: proposal.destinationOrMarket,
          approvedMarketIds: mandate.permissions.markets.map((item) => item.marketId),
          marketState: 'OPEN',
          quantity: proposal.quantity,
          notional: proposal.quantity,
          priceUnits: proposal.quantity,
          referenceUnits: proposal.quantity,
          participantEligible: true,
          accountRestricted: false,
          settlementHealthy: true,
        });
      const refused = exchangeRefusal(view);
      if (refused) {
        this.safety(
          mandate,
          proposal,
          view.refusal === 'MARKET_UNAVAILABLE' ? 'MARKET_UNAVAILABLE' : 'PRICE_PROTECTION_REJECTION',
          refused.detail,
        );
        return err(refused);
      }
    }
    if (proposal.intent === 'MANAGE_ALLOWED_PRODUCTIVE_SERVICE' && !mandate.permissions.destinations.some((item) => item.kind === 'MACHINE_SERVICE')) {
      return err({ ok: false, code: 'DESTINATION_NOT_PERMITTED', detail: 'machine commerce requires an approved machine/service identity' });
    }
    const request = this.gate.buildExecutionRequest({
      proposal,
      mandate,
      walletPolicyHash: context.wallet.policyHash,
      kernelStateHash: context.kernelStateHash,
      marketRestrictionHash: context.exchange?.restrictionHash ?? 'none',
      now: this.clock.now(),
    });
    if (EXECUTABLE_ACTION_CLASSES.has(proposal.intent as AgentActionClass) && mandate.policy.mode !== 'SIMULATION_ONLY') {
      const kernel = this.gate.submitToKernel({
        proposal,
        mandate,
        humanApproved: context.humanApproved || mandate.policy.approval.class === 'NO_ADDITIONAL_APPROVAL_WITHIN_MANDATE',
        actorId: context.actorId,
      });
      if (!kernel.ok) {
        this.safety(mandate, proposal, 'COMPLIANCE_REJECTION', kernel.detail);
        return err(kernel);
      }
      if (context.walletAuthorize) {
        const wallet = context.walletAuthorize();
        if (!wallet.ok) {
          this.safety(mandate, proposal, 'EXECUTION_FAILURE', wallet.detail);
          return err(wallet);
        }
      }
      this.store.putUsage(recordUsage(usage, proposal));
      const receipt = this.receipt(request.requestId, proposal, mandate, kernel.ok ? kernel.decision.status : null, 'AUTHORIZED', 'SUBMITTED', proposal.expectedOutcomeClass);
      this.store.putProposal(Object.freeze({ ...proposal, state: 'EXECUTED' }));
      this.store.receipts.push(receipt);
      this.recordActivity(mandate.owner, 'EXECUTION', `executed ${proposal.proposalId}`, [receipt.receiptId]);
      return ok(receipt);
    }
    const receipt = this.receipt(request.requestId, proposal, mandate, null, null, 'NOT_SUBMITTED', proposal.expectedOutcomeClass);
    this.store.receipts.push(receipt);
    this.recordActivity(mandate.owner, 'EXECUTION', `prepared ${proposal.proposalId}`, [receipt.receiptId]);
    return ok(receipt);
  }

  schedule(proposalId: string, context: ExecutionContext): Result<AgentExecutionReceipt, MandateRefusal> {
    const scheduled = this.requestExecution(proposalId, context);
    if (!scheduled.ok && scheduled.error.code === 'MANDATE_REVOKED') {
      return scheduled;
    }
    if (!scheduled.ok && scheduled.error.code === 'JURISDICTION_UNAVAILABLE') {
      return err({ ok: false, code: 'SCHEDULE_DOES_NOT_AUTHORIZE', detail: 'schedule does not override authorization or market/compliance state' });
    }
    return scheduled;
  }

  revokeMandate(input: { readonly mandateId: string; readonly actorId: string }): Result<UserAgentMandate, MandateRefusal> {
    return this.revoke({ scope: 'MANDATE', targetId: input.mandateId, actorId: input.actorId });
  }

  revokeAgent(input: { readonly agentId: string; readonly actorId: string }): Result<UserAgent, MandateRefusal> {
    const agent = this.getAgent(input.agentId);
    if (!agent) {
      return err({ ok: false, code: 'MANDATE_REVOKED', detail: 'agent not found' });
    }
    this.store.putAgent(Object.freeze({ ...agent, status: 'REVOKED' }));
    for (const mandate of this.store.mandates.values()) {
      if (mandate.agentId === agent.agentId) {
        this.revokeMandate({ mandateId: mandate.mandateId, actorId: input.actorId });
      }
    }
    this.store.revocations.push(
      Object.freeze({
        revocationId: revocationIdFor('AGENT', input.agentId, this.clock.now()),
        scope: 'AGENT',
        targetId: input.agentId,
        actorId: input.actorId,
        at: this.clock.now(),
        appliesToFutureAuthorization: true,
      }),
    );
    return ok(this.getAgent(input.agentId) ?? agent);
  }

  revokeActionClass(input: { readonly mandateId: string; readonly actionClass: AgentActionClass; readonly actorId: string }): Result<UserAgentMandate, MandateRefusal> {
    const mandate = this.getMandate(input.mandateId);
    if (!mandate) {
      return err({ ok: false, code: 'MANDATE_REVOKED', detail: 'mandate not found' });
    }
    const nextPerms = Object.freeze({
      ...mandate.permissions,
      actionClasses: Object.freeze(mandate.permissions.actionClasses.filter((item) => item !== input.actionClass)),
    });
    const nextDraft = { ...mandate, permissions: nextPerms };
    const next = Object.freeze({ ...nextDraft, mandateHash: contentHash({ ...nextDraft, mandateHash: undefined }) });
    this.store.putMandate(next);
    this.markPendingIneligible(next.mandateId);
    return ok(next);
  }

  revokeDelegatedKey(input: { readonly mandateId: string; readonly actorId: string }): Result<UserAgentMandate, MandateRefusal> {
    const mandate = this.getMandate(input.mandateId);
    if (!mandate) {
      return err({ ok: false, code: 'MANDATE_REVOKED', detail: 'mandate not found' });
    }
    const nextPolicy = Object.freeze({ ...mandate.policy, delegatedSigningKeyId: null });
    const nextDraft = { ...mandate, policy: nextPolicy };
    const next = Object.freeze({ ...nextDraft, mandateHash: contentHash({ ...nextDraft, mandateHash: undefined }) });
    this.store.putMandate(next);
    this.store.revocations.push(
      Object.freeze({
        revocationId: revocationIdFor('DELEGATED_KEY', input.mandateId, this.clock.now()),
        scope: 'DELEGATED_KEY',
        targetId: input.mandateId,
        actorId: input.actorId,
        at: this.clock.now(),
        appliesToFutureAuthorization: true,
      }),
    );
    return ok(next);
  }

  killAllForWallet(input: { readonly walletId: string; readonly actorId: string }): Result<readonly UserAgentMandate[], MandateRefusal> {
    const updated: UserAgentMandate[] = [];
    for (const mandate of this.store.mandatesForWallet(input.walletId)) {
      const result = this.revokeMandate({ mandateId: mandate.mandateId, actorId: input.actorId });
      if (result.ok) {
        updated.push(result.value);
      }
    }
    this.store.revocations.push(
      Object.freeze({
        revocationId: revocationIdFor('WALLET_KILL', input.walletId, this.clock.now()),
        scope: 'WALLET_KILL',
        targetId: input.walletId,
        actorId: input.actorId,
        at: this.clock.now(),
        appliesToFutureAuthorization: true,
      }),
    );
    return ok(Object.freeze(updated));
  }

  getProposal(proposalId: string): AgentTransactionProposal | undefined {
    return this.store.proposals.get(proposalId as AgentTransactionProposal['proposalId']);
  }

  listProposals(mandateId?: string): readonly AgentTransactionProposal[] {
    const all = [...this.store.proposals.values()];
    return mandateId ? all.filter((item) => item.mandateId === mandateId) : all;
  }

  activity(walletId: string): AgentActivityReport {
    return Object.freeze({
      ownerId: [...this.store.mandates.values()].find((item) => item.owner.walletId === walletId)?.owner.ownerId ?? walletId,
      walletId,
      generatedAt: this.clock.now(),
      entries: Object.freeze(this.store.activity.filter((item) => item.refs.includes(walletId) || item.summary.includes(walletId) || this.store.mandatesForWallet(walletId).some((mandate) => item.refs.includes(mandate.mandateId) || item.refs.includes(mandate.agentId)))),
    });
  }

  permissions(mandateId: string): AgentPermission | undefined {
    return this.getMandate(mandateId)?.permissions;
  }

  explain(proposalId: string): AgentExplanation | undefined {
    const proposal = this.getProposal(proposalId);
    const mandate = proposal ? this.getMandate(proposal.mandateId) : undefined;
    if (!proposal || !mandate) {
      return undefined;
    }
    return explainProposal(mandate, proposal);
  }

  simulate(input: CreateProposalInput): Result<AgentTransactionProposal, MandateRefusal> {
    const mandate = this.getMandate(input.mandateId);
    if (!mandate) {
      return err({ ok: false, code: 'MANDATE_REVOKED', detail: 'mandate not found' });
    }
    if (mandate.policy.mode !== 'SIMULATION_ONLY' && !input.expectedOutcomeClass.includes('SIMULATION')) {
      const simulated: CreateProposalInput = { ...input, expectedOutcomeClass: 'SIMULATION_EVALUATION' };
      return this.createProposal(simulated);
    }
    return this.createProposal(input);
  }

  portfolioView(mandateId: string, available: readonly string[]): readonly string[] {
    const mandate = this.getMandate(mandateId);
    if (!mandate) {
      return [];
    }
    const allowed = new Set(mandate.permissions.assets.map((item) => item.listedAssetId ?? item.assetId));
    return available.filter((item) => allowed.has(item));
  }

  humanInformationAccess(mandateId: string): boolean {
    const mandate = this.getMandate(mandateId);
    return mandate?.permissions.humanInformationAccess !== false;
  }

  audit(): readonly AgentSafetyEvent[] {
    return Object.freeze([...this.store.safety]);
  }

  private revoke(input: { readonly scope: 'MANDATE'; readonly targetId: string; readonly actorId: string }): Result<UserAgentMandate, MandateRefusal> {
    const mandate = this.getMandate(input.targetId);
    if (!mandate) {
      return err({ ok: false, code: 'MANDATE_REVOKED', detail: 'mandate not found' });
    }
    const next = Object.freeze({ ...mandate, state: 'REVOKED' as const });
    this.store.putMandate(next);
    this.markPendingIneligible(next.mandateId);
    this.store.revocations.push(
      Object.freeze({
        revocationId: revocationIdFor(input.scope, input.targetId, this.clock.now()),
        scope: input.scope,
        targetId: input.targetId,
        actorId: input.actorId,
        at: this.clock.now(),
        appliesToFutureAuthorization: true,
      }),
    );
    this.recordActivity(mandate.owner, 'REVOCATION', `revoked ${mandate.mandateId}`, [mandate.mandateId]);
    return ok(next);
  }

  private markPendingIneligible(mandateId: string): void {
    for (const proposal of this.store.proposals.values()) {
      if (proposal.mandateId === mandateId && proposal.state !== 'EXECUTED') {
        this.store.putProposal(Object.freeze({ ...proposal, state: 'INELIGIBLE' }));
      }
    }
  }

  private usageOf(mandate: UserAgentMandate): AgentMandateUsage {
    const current = this.store.usage.get(mandate.mandateId) ?? emptyUsage(mandate.mandateId, this.clock.now());
    return rolloverUsage(current, this.clock.now(), mandate.budget.periodHours);
  }

  private safety(
    mandate: UserAgentMandate,
    proposal: AgentTransactionProposal | null,
    kind: SafetyEventKind,
    detail: string,
  ): void {
    this.store.safety.push(
      Object.freeze({
        eventId: safetyEventIdFor(kind, mandate.mandateId, this.clock.now()),
        kind,
        mandateId: mandate.mandateId,
        proposalId: proposal?.proposalId ?? null,
        detail,
        increasesRiskAutomatically: false,
        at: this.clock.now(),
      }),
    );
    this.recordActivity(mandate.owner, 'SAFETY', `${kind}: ${detail}`, [mandate.mandateId]);
  }

  private receipt(
    requestId: AgentExecutionReceipt['requestId'],
    proposal: AgentTransactionProposal,
    mandate: UserAgentMandate,
    kernelDecision: string | null,
    walletAuthorization: string | null,
    finality: AgentExecutionReceipt['finality'],
    outcomeClass: AgentExecutionReceipt['outcomeClass'],
  ): AgentExecutionReceipt {
    return Object.freeze({
      receiptId: receiptIdFor(requestId, outcomeClass),
      requestId,
      proposalHash: proposal.proposalHash,
      mandateHash: mandate.mandateHash,
      approvalId: null,
      kernelDecision,
      walletAuthorization,
      transactionHash: finality === 'SUBMITTED' ? `tx_${proposal.proposalHash.slice(0, 16)}` : null,
      finality,
      outcomeClass,
      createdAt: this.clock.now(),
    });
  }

  private recordActivity(owner: MandateOwner, kind: AgentActivityReport['entries'][number]['kind'], summary: string, refs: readonly string[]): void {
    this.store.activity.push(
      Object.freeze({
        at: this.clock.now(),
        kind,
        summary,
        refs: Object.freeze([...refs, owner.walletId, owner.ownerId]),
      }),
    );
  }
}

import { createHash, randomUUID } from 'node:crypto';

import { type Clock } from '../../config/src/clock.ts';
import { LIVE_CRYPTO_ENABLED, LIVE_EXCHANGE_ENABLED } from '../../config/src/flags.ts';
import type { Customer, CustomerId } from '../../domain/src/customer.ts';
import type { Jurisdiction } from '../../domain/src/jurisdiction.ts';
import type { LegalEntity } from '../../domain/src/legal-entity.ts';
import type { Product } from '../../domain/src/product.ts';
import { isOk } from '../../domain/src/result.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../events/src/events.ts';
import {
  actionTypesFromCapabilities,
  isVerifiedActorContext,
  type IdentityAuthorityPort,
  type VerifiedActorContext,
} from '../../identity/src/index.ts';
import { openComplianceCase, type ComplianceCase } from '../../kernel/src/compliance/cases.ts';
import type { ComplianceKernel } from '../../kernel/src/kernel.ts';
import type { KernelFacts } from '../../kernel/src/proofs.ts';
import type { AssetQuantity } from '../../money/src/asset-quantity.ts';
import { asIntentId, type ActionIntent } from '../../permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../permissions/src/action-types.ts';
import type { AuthorizationDecision } from '../../permissions/src/decision.ts';
import type { AuthorityIssuer, ExecutionAuthority } from '../../permissions/src/execution-authority.ts';
import { validateIntentStructure } from '../../permissions/src/structural.ts';
import {
  newCustodyReconciliationId,
  newDepositId,
  newDestinationId,
  newTravelRuleMessageId,
  newWithdrawalId,
  type CustodyAccountId,
  type DepositId,
  type DestinationId,
  type WithdrawalId,
} from './ids.ts';
import type {
  CustodyProviderPort,
  CustomerAssetPort,
  DestinationRiskProvider,
  TravelRuleNetworkPort,
  TravelRuleProtectionPort,
} from './ports.ts';
import { CustodyStore } from './store.ts';
import { EVIDENCE_KIND_CUSTODY } from './taxonomy.ts';
import { evaluateTravelRuleApplicability, type TravelRulePack } from './travel-rule.ts';
import type {
  AssetWithdrawal,
  CustodyOutcome,
  CustodyReconciliationReport,
  DepositNotice,
  ExternalDeposit,
  KillSwitchKind,
  TravelRuleMessage,
  WithdrawalDestination,
} from './types.ts';

export type CustodyCatalog = {
  readonly customers: { get(id: Customer['id']): Customer | undefined };
  readonly products: { get(id: Product['id']): Product | undefined };
  readonly legalEntities: { get(id: LegalEntity['id']): LegalEntity | undefined };
};

export class CustodyService {
  private readonly kernel: ComplianceKernel;
  private readonly issuer: AuthorityIssuer;
  private readonly evidence: EvidenceVault;
  private readonly events: DomainEventLog;
  private readonly clock: Clock;
  private readonly identity: IdentityAuthorityPort;
  private readonly catalog: CustodyCatalog;
  private readonly assets: CustomerAssetPort;
  private readonly provider: CustodyProviderPort;
  private readonly destinationRisk: DestinationRiskProvider;
  private readonly travelNetwork: TravelRuleNetworkPort;
  private readonly protection: TravelRuleProtectionPort;
  private readonly pack: TravelRulePack;
  private readonly store = new CustodyStore();
  readonly cases: ComplianceCase[] = [];

  constructor(input: {
    readonly kernel: ComplianceKernel;
    readonly issuer: AuthorityIssuer;
    readonly evidence: EvidenceVault;
    readonly events: DomainEventLog;
    readonly clock: Clock;
    readonly identity: IdentityAuthorityPort;
    readonly catalog: CustodyCatalog;
    readonly assets: CustomerAssetPort;
    readonly provider: CustodyProviderPort;
    readonly destinationRisk: DestinationRiskProvider;
    readonly travelNetwork: TravelRuleNetworkPort;
    readonly protection: TravelRuleProtectionPort;
    readonly pack: TravelRulePack;
  }) {
    if (LIVE_EXCHANGE_ENABLED !== false || LIVE_CRYPTO_ENABLED !== false) {
      throw new Error('live custody and live crypto paths are forbidden');
    }
    if (input.provider.mode !== 'SIMULATION_ONLY' || input.travelNetwork.mode !== 'SIMULATION_ONLY') {
      throw new Error('only simulation custody and Travel Rule providers are permitted');
    }
    this.kernel = input.kernel;
    this.issuer = input.issuer;
    this.evidence = input.evidence;
    this.events = input.events;
    this.clock = input.clock;
    this.identity = input.identity;
    this.catalog = input.catalog;
    this.assets = input.assets;
    this.provider = input.provider;
    this.destinationRisk = input.destinationRisk;
    this.travelNetwork = input.travelNetwork;
    this.protection = input.protection;
    this.pack = input.pack;
  }

  registerAddress(address: string, customerId: string, custodyAccountId: CustodyAccountId): void {
    this.store.addressOwners.set(address, { customerId, custodyAccountId });
  }

  setKillSwitch(kind: KillSwitchKind, active: boolean, actorKind: 'HUMAN_OPERATOR' | 'AGENT' | 'AI'): CustodyOutcome<true> {
    if (actorKind !== 'HUMAN_OPERATOR') {
      return { outcome: 'REJECTED', code: 'AI_CANNOT_DISABLE_CONTROLS', message: 'only a human operator may change custody kill switches' };
    }
    this.store.killSwitches.set(kind, { active, reason: active ? 'human halt' : 'human resume' });
    this.seal(`kill_switch.${kind}`, { active, actorKind });
    return { outcome: 'OK', value: true };
  }

  ingestExternalDeposit(input: {
    readonly material: string;
    readonly signatureHex: string;
    readonly notice: DepositNotice;
  }): CustodyOutcome<ExternalDeposit> {
    if (this.store.notices.has(input.notice.noticeId)) {
      const existing = [...this.store.deposits.values()].find((deposit) => deposit.notice.noticeId === input.notice.noticeId);
      if (existing) {
        return { outcome: 'OK', value: existing };
      }
    }
    const auth = this.provider.ingestNotice(input.material, input.signatureHex);
    if (!auth.authentic || !input.notice.signatureValid) {
      return { outcome: 'REJECTED', code: 'UNAUTHENTICATED_NOTICE', message: 'provider notice signature failed' };
    }
    this.store.notices.add(input.notice.noticeId);
    const mapped = this.provider.mapAddress(input.notice.destinationAddress) ?? this.store.addressOwners.get(input.notice.destinationAddress);
    if (!mapped) {
      return { outcome: 'REJECTED', code: 'UNMAPPED_ADDRESS', message: 'deposit address is not mapped to a customer' };
    }
    const deposit: ExternalDeposit = Object.freeze({
      depositId: newDepositId(),
      customerId: mapped.customerId as CustomerId,
      custodyAccountId: mapped.custodyAccountId as CustodyAccountId,
      notice: input.notice,
      state: 'NOTICE_RECEIVED',
      screeningOutcome: null,
      journalId: null,
      providerBalanceIsTruth: false,
      createdAt: this.clock.now(),
    });
    this.store.putDeposit(deposit);
    this.emit('CustodyDepositNoticeReceived', deposit.depositId, {
      depositId: deposit.depositId,
      noticeId: input.notice.noticeId,
    });
    this.seal('deposit.notice', { depositId: deposit.depositId, noticeId: input.notice.noticeId });
    return { outcome: 'OK', value: deposit };
  }

  creditExternalDeposit(input: {
    readonly actorId: string;
    readonly depositId: DepositId;
  }): CustodyOutcome<ExternalDeposit> {
    if (this.store.killSwitches.get('DEPOSIT_CREDIT_HALT')?.active) {
      return { outcome: 'REJECTED', code: 'DEPOSIT_CREDIT_HALTED', message: 'deposit-credit kill switch is active' };
    }
    const current = this.store.deposits.get(input.depositId);
    if (!current) {
      return { outcome: 'REJECTED', code: 'UNKNOWN_DEPOSIT', message: 'deposit not found' };
    }
    if (current.journalId) {
      return { outcome: 'OK', value: current };
    }
    const normalized: ExternalDeposit = { ...current, state: 'NORMALIZED' };
    const mapped: ExternalDeposit = { ...normalized, state: 'ADDRESS_MAPPED' };
    const screen = this.destinationRisk.screen({
      address: current.notice.destinationAddress,
      customerId: current.customerId,
      assetId: current.notice.assetId,
    });
    const screened: ExternalDeposit = { ...mapped, state: 'SCREENED', screeningOutcome: screen.outcome };
    if (screen.outcome === 'BLOCK') {
      const blocked = Object.freeze({ ...screened, state: 'BLOCKED' as const });
      this.store.putDeposit(blocked);
      this.openCase('SANCTIONS_REVIEW', ['DESTINATION_BLOCK'], current.customerId);
      return { outcome: 'REJECTED', code: 'DEPOSIT_SCREEN_BLOCK', message: screen.reason };
    }
    if (current.notice.confirmations < 1) {
      const waiting = Object.freeze({ ...screened, state: 'AWAITING_FINALITY' as const });
      this.store.putDeposit(waiting);
      return { outcome: 'REJECTED', code: 'AWAITING_FINALITY', message: 'deposit is not final' };
    }
    const finalized: ExternalDeposit = { ...screened, state: 'FINAL' };
    const policyChecked: ExternalDeposit = { ...finalized, state: 'POLICY_CHECKED' };
    const intent = this.intent(input.actorId, ACTION_TYPES.CREDIT_EXTERNAL_DEPOSIT, {
      accountId: current.custodyAccountId,
      customerId: current.customerId,
      depositId: current.depositId,
      amount: current.notice.quantity,
    });
    const gated = this.authorizeIntent(intent, current.customerId);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const authorized: ExternalDeposit = { ...policyChecked, state: 'AUTHORIZED' };
    const credited = this.assets.credit(current.customerId, current.notice.quantity);
    if (!credited.ok) {
      return { outcome: 'REJECTED', code: credited.error.code, message: credited.error.message };
    }
    const complete: ExternalDeposit = Object.freeze({
      ...authorized,
      state: 'CREDITED',
      journalId: credited.value.journalId,
    });
    this.store.putDeposit(complete);
    this.emit('CustodyDepositCredited', complete.depositId, {
      depositId: complete.depositId,
      journalId: complete.journalId,
    });
    this.seal('deposit.credited', {
      depositId: complete.depositId,
      journalId: complete.journalId,
      intentId: intent.id,
      providerDidNotCredit: true,
    });
    return { outcome: 'OK', value: complete, decision: gated.decision };
  }

  addDestination(input: {
    readonly actor: VerifiedActorContext;
    readonly customerId: CustomerId;
    readonly address: string;
    readonly label: string;
  }): CustodyOutcome<WithdrawalDestination> {
    if (!isVerifiedActorContext(input.actor)) {
      return { outcome: 'REJECTED', code: 'ACTOR_UNVERIFIED', message: 'destination requires a verified ActorContext' };
    }
    if (input.actor.authenticationAssurance !== 'HIGH_ASSURANCE') {
      return { outcome: 'REJECTED', code: 'STEP_UP_REQUIRED', message: 'destination add requires step-up HIGH_ASSURANCE' };
    }
    if (!input.actor.authorizedCapabilities.includes('ADD_WITHDRAWAL_DESTINATION')) {
      return { outcome: 'REJECTED', code: 'CAPABILITY_MISSING', message: 'ADD_WITHDRAWAL_DESTINATION is not granted' };
    }
    const intent = this.intent(input.actor.actorId, ACTION_TYPES.ADD_WITHDRAWAL_DESTINATION, {
      accountId: input.customerId,
      customerId: input.customerId,
      addressHash: hashAddress(input.address),
    });
    const gated = this.authorizeIntent(intent, input.customerId);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const destination: WithdrawalDestination = Object.freeze({
      destinationId: newDestinationId(),
      customerId: input.customerId,
      address: input.address,
      label: input.label,
      addedWithStepUp: true,
      assurance: 'HIGH_ASSURANCE',
      createdAt: this.clock.now(),
    });
    this.store.putDestination(destination);
    this.emit('CustodyDestinationAdded', destination.destinationId, {
      destinationId: destination.destinationId,
      addressHash: hashAddress(input.address),
    });
    this.seal('destination.added', { destinationId: destination.destinationId, intentId: intent.id });
    return { outcome: 'OK', value: destination, decision: gated.decision };
  }

  initiateWithdrawal(input: {
    readonly actor: VerifiedActorContext;
    readonly customerId: CustomerId;
    readonly custodyAccountId: CustodyAccountId;
    readonly destinationId: DestinationId;
    readonly quantity: AssetQuantity;
    readonly timeoutAfterBroadcast?: boolean;
  }): CustodyOutcome<AssetWithdrawal> {
    if (this.store.killSwitches.get('WITHDRAWAL_HALT')?.active) {
      return { outcome: 'REJECTED', code: 'WITHDRAWAL_HALTED', message: 'withdrawal kill switch is active' };
    }
    if (!isVerifiedActorContext(input.actor)) {
      return { outcome: 'REJECTED', code: 'ACTOR_UNVERIFIED', message: 'withdrawal requires a verified ActorContext' };
    }
    const destination = this.store.destinations.get(input.destinationId);
    if (!destination || destination.customerId !== input.customerId) {
      return { outcome: 'REJECTED', code: 'UNKNOWN_DESTINATION', message: 'destination not found for customer' };
    }
    const available = this.assets.position(input.customerId).available;
    if (available.scaledUnits < input.quantity.scaledUnits) {
      return { outcome: 'REJECTED', code: 'INSUFFICIENT_ASSET', message: 'withdrawal exceeds owned available asset' };
    }
    const screen = this.destinationRisk.screen({
      address: destination.address,
      customerId: input.customerId,
      assetId: input.quantity.assetId,
    });
    if (screen.outcome === 'BLOCK') {
      this.openCase('SANCTIONS_REVIEW', ['DESTINATION_BLOCK'], input.customerId);
      this.emit('CustodyWithdrawalBlocked', input.destinationId, {
        destinationId: input.destinationId,
        reason: 'DESTINATION_BLOCK',
      });
      return { outcome: 'REJECTED', code: 'DESTINATION_BLOCK', message: screen.reason };
    }
    const vasp = this.travelNetwork.discoverCounterparty(destination.address);
    const customer = this.catalog.customers.get(input.customerId);
    const travel = evaluateTravelRuleApplicability({
      pack: this.pack,
      originatorJurisdiction: customer?.jurisdiction ?? ('GB' as Jurisdiction),
      quantity: input.quantity,
      counterpartyIsVasp: vasp !== null,
    });
    if (travel.applicability === 'REQUIRED_BY_PACK' && !vasp) {
      return { outcome: 'REJECTED', code: 'TRAVEL_RULE_COUNTERPARTY_UNKNOWN', message: 'required Travel Rule counterparty was not discovered' };
    }
    const intent = this.intent(input.actor.actorId, ACTION_TYPES.INITIATE_ASSET_WITHDRAWAL, {
      accountId: input.custodyAccountId,
      customerId: input.customerId,
      destinationId: input.destinationId,
      amount: input.quantity,
    });
    const gated = this.authorizeIntent(intent, input.customerId);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const held = this.assets.placeHold(input.custodyAccountId, input.quantity);
    if (!held.ok) {
      return { outcome: 'REJECTED', code: held.error.code, message: held.error.message };
    }
    const withdrawalId = newWithdrawalId();
    let message: TravelRuleMessage | null = null;
    if (travel.applicability === 'REQUIRED_BY_PACK' && vasp) {
      const envelope = this.protection.seal(
        Buffer.from(
          JSON.stringify({
            originatorRef: input.customerId,
            beneficiaryRef: hashAddress(destination.address),
            vaspId: vasp.vaspId,
            amount: input.quantity.scaledUnits.toString(),
          }),
        ),
      );
      const messageId = newTravelRuleMessageId();
      message = Object.freeze({
        messageId,
        withdrawalId,
        counterpartyVaspId: vasp.vaspId,
        envelope,
        acknowledged: this.travelNetwork.submit({
          messageId,
          withdrawalId,
          counterpartyVaspId: vasp.vaspId,
          envelope,
          acknowledged: false,
          piiInEvents: false,
        }).acknowledged,
        piiInEvents: false,
      });
    }
    const submitted = this.provider.submitWithdrawal({
      withdrawalId,
      destination: destination.address,
      amount: input.quantity,
      ...(input.timeoutAfterBroadcast === true ? { timeout: true } : {}),
    });
    if (submitted.kind === 'SUBMISSION_UNKNOWN') {
      const unknown: AssetWithdrawal = Object.freeze({
        withdrawalId,
        customerId: input.customerId,
        custodyAccountId: input.custodyAccountId,
        destinationId: input.destinationId,
        quantity: input.quantity,
        state: 'SUBMISSION_UNKNOWN',
        screeningOutcome: screen.outcome,
        travelRule: travel,
        travelRuleMessageId: message?.messageId ?? null,
        holdId: held.value.holdId,
        providerSubmissionId: submitted.submissionId,
        chainTxRef: null,
        journalId: null,
        submittedOnce: true,
        createdAt: this.clock.now(),
      });
      if (message) {
        this.store.putMessage({ ...message, withdrawalId });
      }
      this.store.putWithdrawal(unknown);
      this.emit('CustodyWithdrawalUnknown', unknown.withdrawalId, {
        withdrawalId: unknown.withdrawalId,
        state: 'SUBMISSION_UNKNOWN',
      });
      this.seal('withdrawal.unknown', { withdrawalId: unknown.withdrawalId, intentId: intent.id, noResubmit: true });
      return { outcome: 'OK', value: unknown, decision: gated.decision };
    }
    const debited = this.assets.debitHeld(held.value.holdId, input.quantity);
    if (!debited.ok) {
      return { outcome: 'REJECTED', code: debited.error.code, message: debited.error.message };
    }
    const settled: AssetWithdrawal = Object.freeze({
      withdrawalId,
      customerId: input.customerId,
      custodyAccountId: input.custodyAccountId,
      destinationId: input.destinationId,
      quantity: input.quantity,
      state: 'SETTLED',
      screeningOutcome: screen.outcome,
      travelRule: travel,
      travelRuleMessageId: message?.messageId ?? null,
      holdId: held.value.holdId,
      providerSubmissionId: submitted.submissionId,
      chainTxRef: submitted.txRef,
      journalId: debited.value.journalId,
      submittedOnce: true,
      createdAt: this.clock.now(),
    });
    if (message) {
      this.store.putMessage({ ...message, withdrawalId });
    }
    this.store.putWithdrawal(settled);
    this.emit('CustodyWithdrawalSettled', settled.withdrawalId, {
      withdrawalId: settled.withdrawalId,
      journalId: settled.journalId,
    });
    this.seal('withdrawal.settled', { withdrawalId: settled.withdrawalId, intentId: intent.id });
    return { outcome: 'OK', value: settled, decision: gated.decision };
  }

  queryAndReconcileWithdrawal(withdrawalId: WithdrawalId): CustodyOutcome<AssetWithdrawal> {
    const current = this.store.withdrawals.get(withdrawalId);
    if (!current) {
      return { outcome: 'REJECTED', code: 'UNKNOWN_WITHDRAWAL', message: 'withdrawal not found' };
    }
    if (current.state !== 'SUBMISSION_UNKNOWN') {
      return { outcome: 'OK', value: current };
    }
    if (!current.providerSubmissionId) {
      this.seal('withdrawal.query_pending', { withdrawalId, noResubmit: true });
      return { outcome: 'OK', value: current };
    }
    const queried = this.provider.queryWithdrawal(current.providerSubmissionId);
    if (queried.kind !== 'FINALIZED') {
      this.seal('withdrawal.query_pending', { withdrawalId, noResubmit: true });
      return { outcome: 'OK', value: current };
    }
    if (!current.holdId) {
      return { outcome: 'REJECTED', code: 'HOLD_MISSING', message: 'unknown withdrawal has no hold to settle' };
    }
    const debited = this.assets.debitHeld(current.holdId, current.quantity);
    if (!debited.ok) {
      return { outcome: 'REJECTED', code: debited.error.code, message: debited.error.message };
    }
    const settled: AssetWithdrawal = Object.freeze({
      ...current,
      state: 'MATCHED',
      chainTxRef: queried.txRef,
      journalId: debited.value.journalId,
      submittedOnce: true,
    });
    this.store.putWithdrawal(settled);
    this.emit('CustodyWithdrawalSettled', settled.withdrawalId, {
      withdrawalId: settled.withdrawalId,
      journalId: settled.journalId,
      recovered: true,
    });
    this.seal('withdrawal.reconciled', { withdrawalId: settled.withdrawalId, noDuplicate: true });
    return { outcome: 'OK', value: settled };
  }

  reconcile(): CustodyReconciliationReport {
    const notes: string[] = [];
    let outcome: CustodyReconciliationReport['outcome'] = 'MATCHED';
    for (const deposit of this.store.deposits.values()) {
      if (deposit.state === 'CREDITED' && !deposit.journalId) {
        outcome = 'DEPOSIT_CREDIT_MISMATCH';
        notes.push(`deposit ${deposit.depositId} credited without journal`);
      }
    }
    for (const withdrawal of this.store.withdrawals.values()) {
      if ((withdrawal.state === 'SETTLED' || withdrawal.state === 'MATCHED') && !withdrawal.journalId) {
        outcome = 'WITHDRAWAL_CHAIN_MISMATCH';
        notes.push(`withdrawal ${withdrawal.withdrawalId} settled without journal`);
      }
      if (withdrawal.state === 'SUBMISSION_UNKNOWN') {
        outcome = 'INVESTIGATION_REQUIRED';
        notes.push(`withdrawal ${withdrawal.withdrawalId} remains SUBMISSION_UNKNOWN`);
      }
    }
    const report: CustodyReconciliationReport = Object.freeze({
      reconciliationId: newCustodyReconciliationId(),
      outcome,
      notes,
      createdAt: this.clock.now(),
      autoCorrected: false,
      autoCreatedAssets: false,
    });
    this.store.reconciliations.push(report);
    this.seal('reconciliation', { outcome, autoCorrected: false, autoCreatedAssets: false });
    return report;
  }

  getDeposit(id: DepositId): ExternalDeposit | undefined {
    return this.store.deposits.get(id);
  }
  getWithdrawal(id: WithdrawalId): AssetWithdrawal | undefined {
    return this.store.withdrawals.get(id);
  }
  getDestination(id: DestinationId): WithdrawalDestination | undefined {
    return this.store.destinations.get(id);
  }
  travelMessage(id: TravelRuleMessage['messageId']): TravelRuleMessage | undefined {
    return this.store.travelMessages.get(id);
  }

  private openCase(caseType: 'SANCTIONS_REVIEW' | 'AML_ALERT' | 'TRANSACTION_MONITORING_ALERT', reasons: readonly string[], subjectRef: string): void {
    this.cases.push(
      openComplianceCase({
        caseType,
        reasonCodes: reasons,
        originRefs: ['custody'],
        subjectRef,
        jurisdiction: 'GB',
        createdAt: this.clock.now(),
      }),
    );
  }

  private intent(actorId: string, actionType: string, payload: Record<string, unknown>): ActionIntent {
    return {
      id: asIntentId(`intent_${randomUUID()}`),
      actionType,
      payload,
      idempotencyKey: `custody.${actionType}.${payload.depositId ?? payload.destinationId ?? payload.accountId ?? randomUUID()}`,
      actorId,
      requestedAt: this.clock.now(),
      purpose: 'CUSTOMER_DIGITAL_ASSET',
    };
  }

  private authorizeIntent(
    intent: ActionIntent,
    customerId: Customer['id'],
  ):
    | { readonly outcome: 'ALLOWED'; readonly decision: AuthorizationDecision; readonly authority: ExecutionAuthority }
    | { readonly outcome: 'REFUSED'; readonly result: CustodyOutcome<never> } {
    const customer = this.catalog.customers.get(customerId);
    const product = this.catalog.products.get('prod_digital_usd_gb' as Product['id']);
    const legalEntity = product ? this.catalog.legalEntities.get(product.legalEntityId) : undefined;
    const resolved = this.identity.resolveActorContext(intent.actorId);
    const facts: KernelFacts = {
      actor: {
        id: intent.actorId,
        capabilities: resolved.ok ? actionTypesFromCapabilities(resolved.value.authorizedCapabilities) : [],
      },
      identity: this.identity.identityFactsFor(intent.actorId),
      ...(customer ? { customer } : {}),
      ...(legalEntity ? { legalEntity } : {}),
      ...(product ? { product, jurisdiction: product.jurisdiction } : {}),
    };
    const decision = this.kernel.submit(intent, facts);
    this.emit('KernelDecisionRecorded', intent.id, {
      intentId: intent.id,
      actionType: intent.actionType,
      status: decision.status,
    });
    if (decision.status !== 'ALLOW') {
      this.seal(`${intent.actionType}_KERNEL_REFUSED`, { intentId: intent.id, status: decision.status });
      return { outcome: 'REFUSED', result: { outcome: 'KERNEL_REFUSED', decision } };
    }
    const structural = validateIntentStructure(intent, {
      products: { get: (id) => this.catalog.products.get(id), list: () => [] },
      legalEntities: this.catalog.legalEntities,
      accounts: { get: () => undefined },
    });
    if (!isOk(structural)) {
      return {
        outcome: 'REFUSED',
        result: { outcome: 'REJECTED', code: structural.error.code, message: structural.error.message, decision },
      };
    }
    if (!decision.executionAuthority) {
      return {
        outcome: 'REFUSED',
        result: { outcome: 'REJECTED', code: 'MISSING_EXECUTION_AUTHORITY', message: 'ALLOW without authority', decision },
      };
    }
    const verified = this.issuer.verify(
      decision.executionAuthority,
      {
        actionType: intent.actionType,
        accountId: String((intent.payload as { accountId?: string }).accountId ?? intent.id),
        intentId: intent.id,
      },
      this.clock,
    );
    if (!isOk(verified)) {
      return {
        outcome: 'REFUSED',
        result: { outcome: 'REJECTED', code: verified.error.code, message: verified.error.message, decision },
      };
    }
    return { outcome: 'ALLOWED', decision, authority: verified.value };
  }

  private emit(eventType: string, aggregateId: string, payload: Record<string, unknown>): void {
    this.events.append({
      eventType: eventType as never,
      schemaVersion: 1,
      occurredAt: this.clock.now(),
      payload,
    } as never);
    void aggregateId;
  }

  private seal(kind: string, payload: Record<string, unknown>): void {
    this.evidence.seal(`${EVIDENCE_KIND_CUSTODY}:${kind}`, payload);
  }
}

function hashAddress(address: string): string {
  return createHash('sha256').update(address).digest('hex');
}

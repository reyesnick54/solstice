import { randomUUID } from 'node:crypto';

import { type Clock } from '../../config/src/clock.ts';
import type { Customer } from '../../domain/src/customer.ts';
import type { LegalEntity } from '../../domain/src/legal-entity.ts';
import type { Product } from '../../domain/src/product.ts';
import { err, isOk, ok, type Result } from '../../domain/src/result.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../events/src/events.ts';
import { actionTypesFromCapabilities, type IdentityAuthorityPort } from '../../identity/src/index.ts';
import type { ComplianceKernel } from '../../kernel/src/kernel.ts';
import type { KernelFacts } from '../../kernel/src/proofs.ts';
import {
  SIMULATED_FUNDING_TO_DIGITAL_ASSET_CUSTODY,
  type Journal,
} from '../../ledger/src/types.ts';
import type { Ledger } from '../../ledger/src/journal.ts';
import { AssetQuantity } from '../../money/src/asset-quantity.ts';
import { ledgerScaledUnits } from '../../money/src/ledger-amount.ts';
import { asIntentId, type ActionIntent } from '../../permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../permissions/src/action-types.ts';
import type { AuthorizationDecision } from '../../permissions/src/decision.ts';
import type { AuthorityIssuer, ExecutionAuthority } from '../../permissions/src/execution-authority.ts';
import { validateIntentStructure } from '../../permissions/src/structural.ts';
import type { CleanRoomComputationReceipt, ContributionComputationReference } from '../../clean-room/src/types.ts';
import type { ConsentService } from '../../consent/src/service.ts';
import { computeRewardAmount, replayKey } from './formula.ts';
import {
  custodyBookId,
  newBurnRecordId,
  newCoinHoldId,
  newContributionVectorId,
  newEligibilityId,
  newIssuanceProposalId,
  newIssuanceRecordId,
  newReconciliationSnapshotId,
  newTransferRecordId,
  SUNREY_BURN_BOOK,
  SUNREY_COIN_ASSET_ID,
  SUNREY_COIN_FORMULA_V1,
  SUNREY_ISSUANCE_BOOK,
  SUNREY_TREASURY_BOOK,
  type SupplyPolicyId,
} from './ids.ts';
import { SunReyCoinStore } from './store.ts';
import {
  EVIDENCE_KIND_SUNREY_COIN,
  GROWTH_CLASSIFICATION,
  SUNREY_COIN_DISPLAY_NAME,
} from './taxonomy.ts';
import type {
  AuthorizedContributionVector,
  BurnRecord,
  CoinHold,
  ContributionFactors,
  EligibilityRecord,
  FutureChainAdapter,
  IssuanceRecord,
  ReconciliationSnapshot,
  SunReyCoinAsset,
  SunReyCoinFailure,
  SunReyCoinIssuanceProposal,
  SunReyCoinPosition,
  SunReyCoinSupplyPolicy,
  SupplySnapshot,
  TransferRecord,
} from './types.ts';

export type SunReyCoinCatalog = {
  readonly customers: { get(id: Customer['id']): Customer | undefined };
  readonly products: { get(id: Product['id']): Product | undefined };
  readonly legalEntities: { get(id: LegalEntity['id']): LegalEntity | undefined };
};

export type SunReyCoinOutcome<T> =
  | { readonly outcome: 'OK'; readonly value: T; readonly decision?: AuthorizationDecision }
  | { readonly outcome: 'KERNEL_REFUSED'; readonly decision: AuthorizationDecision }
  | {
      readonly outcome: 'REJECTED';
      readonly code: string;
      readonly message: string;
      readonly decision?: AuthorizationDecision | null;
    };

export type EvaluateInput = {
  readonly subjectId: string;
  readonly customerId: Customer['id'];
  readonly receipt: CleanRoomComputationReceipt;
  readonly contribution: ContributionComputationReference;
  readonly actor: { readonly id: string };
  readonly peveFormulaRef?: string;
  readonly irrelevantIdentityTraits?: Readonly<Record<string, string>>;
};

export class SunReyCoinService {
  private readonly kernel: ComplianceKernel;
  private readonly issuer: AuthorityIssuer;
  private readonly evidence: EvidenceVault;
  private readonly events: DomainEventLog;
  private readonly clock: Clock;
  private readonly identity: IdentityAuthorityPort;
  private readonly ledger: Ledger;
  private readonly consent: ConsentService;
  private readonly catalog: SunReyCoinCatalog;
  private readonly store = new SunReyCoinStore();
  readonly asset: SunReyCoinAsset;
  readonly policy: SunReyCoinSupplyPolicy;
  readonly chainAdapter: FutureChainAdapter = Object.freeze({
    implemented: false,
    chain: 'NOT_IMPLEMENTED',
    wallets: 'NOT_IMPLEMENTED',
    addresses: 'NOT_IMPLEMENTED',
    keys: 'NOT_IMPLEMENTED',
  });

  constructor(input: {
    readonly kernel: ComplianceKernel;
    readonly issuer: AuthorityIssuer;
    readonly evidence: EvidenceVault;
    readonly events: DomainEventLog;
    readonly clock: Clock;
    readonly identity: IdentityAuthorityPort;
    readonly ledger: Ledger;
    readonly consent: ConsentService;
    readonly catalog: SunReyCoinCatalog;
  }) {
    this.kernel = input.kernel;
    this.issuer = input.issuer;
    this.evidence = input.evidence;
    this.events = input.events;
    this.clock = input.clock;
    this.identity = input.identity;
    this.ledger = input.ledger;
    this.consent = input.consent;
    this.catalog = input.catalog;
    this.policy = Object.freeze({
      policyId: 'sunrey-coin-supply-v1' as SupplyPolicyId,
      version: 1,
      legalState: 'ENGINEERING_SIMULATION',
      issuanceEnabled: true,
      transferEnabled: true,
      burnEnabled: true,
      simulationOnly: true,
      perEventLimitScaled: 10_000_000n,
      perPeriodLimitScaled: 100_000_000n,
      simulationCapScaled: 1_000_000_000n,
      formulaRef: SUNREY_COIN_FORMULA_V1,
      roundingMode: 'FLOOR',
      createdAt: this.clock.now(),
    });
    this.asset = Object.freeze({
      assetId: SUNREY_COIN_ASSET_ID,
      displayName: SUNREY_COIN_DISPLAY_NAME,
      precision: 6,
      class: 'SIMULATION_NETWORK_UTILITY',
      status: 'ENGINEERING_SIMULATION',
      simulationEnabled: true,
      liveEnabled: false,
      tickerStatus: 'NOT_ASSIGNED',
      supplyPolicyId: this.policy.policyId,
      legalClassification: 'UNCLASSIFIED_SIMULATION',
      createdAt: this.clock.now(),
    });
    this.registerSystemBooks();
  }

  growthClassification(): typeof GROWTH_CLASSIFICATION {
    return GROWTH_CLASSIFICATION;
  }

  evaluateContribution(input: EvaluateInput): Result<AuthorizedContributionVector, SunReyCoinFailure> {
    void input.irrelevantIdentityTraits;
    if (!this.policy.issuanceEnabled) {
      return this.recordIneligible(input, 'POLICY_DISABLED', 'issuance is disabled by supply policy');
    }
    if (
      !input.receipt.receiptId ||
      !input.receipt.jobId ||
      !input.receipt.purposeId ||
      !input.contribution.contributionId
    ) {
      return this.recordIneligible(input, 'INSUFFICIENT_EVIDENCE', 'receipt or contribution reference is incomplete');
    }
    if (input.contribution.subjectId !== input.subjectId) {
      return this.recordIneligible(input, 'INELIGIBLE', 'contribution subject does not match');
    }
    const consentState = this.consentStateFor(input.actor, input.subjectId, input.receipt);
    if (consentState === 'REVOKED' || consentState === 'EXPIRED' || consentState === 'MISSING') {
      return this.recordIneligible(input, 'INELIGIBLE', 'consent is not active for future use');
    }
    const key = replayKey({
      receiptId: input.receipt.receiptId,
      subjectId: input.subjectId,
      jobId: input.receipt.jobId,
      purposeId: input.receipt.purposeId,
      contributionId: input.contribution.contributionId,
      formulaVersion: SUNREY_COIN_FORMULA_V1,
    });
    if (this.store.issuedReplay.has(key) || this.store.byReplay.has(key)) {
      return this.recordIneligible(input, 'DUPLICATE', 'replay key already evaluated or issued', key);
    }
    const factors = factorsFromContribution(input.receipt, input.contribution);
    const amount = computeRewardAmount(factors);
    if (amount.scaledUnits === 0n) {
      return this.recordIneligible(input, 'INELIGIBLE', 'formula produced a zero reward');
    }
    if (amount.scaledUnits > this.policy.perEventLimitScaled) {
      return this.recordIneligible(input, 'REVIEW_REQUIRED', 'per-event simulation limit exceeded');
    }
    const vector: AuthorizedContributionVector = Object.freeze({
      vectorId: newContributionVectorId(),
      subjectId: input.subjectId,
      receiptId: input.receipt.receiptId,
      contributionId: input.contribution.contributionId,
      jobId: input.receipt.jobId,
      purposeId: input.receipt.purposeId,
      purposeVersion: input.receipt.purposeVersion,
      consentRefs: Object.freeze([...input.receipt.consentRefs]),
      formulaVersion: SUNREY_COIN_FORMULA_V1,
      peveFormulaRef: input.peveFormulaRef ?? null,
      factors,
      replayKey: key,
      eligibility: 'ELIGIBLE_SIMULATION',
      amount,
      createdAt: this.clock.now(),
      humanWorthAssigned: false,
    });
    this.store.putVector(vector);
    this.store.putEligibility({
      eligibilityId: newEligibilityId(),
      vectorId: vector.vectorId,
      state: 'ELIGIBLE_SIMULATION',
      reason: 'authorized contribution qualifies for simulation issuance',
      createdAt: this.clock.now(),
    });
    this.emit('SunReyCoinContributionEvaluated', vector.vectorId, {
      vectorId: vector.vectorId,
      subjectId: vector.subjectId,
      receiptId: vector.receiptId,
      eligibility: vector.eligibility,
      scaledUnits: vector.amount.scaledUnits.toString(),
    });
    this.seal('contribution.evaluated', {
      vectorId: vector.vectorId,
      receiptId: vector.receiptId,
      formulaVersion: vector.formulaVersion,
      posted: false,
    });
    return ok(vector);
  }

  proposeIssuance(
    actor: { readonly id: string },
    vectorId: string,
  ): Result<SunReyCoinIssuanceProposal, SunReyCoinFailure> {
    const vector = this.store.vectors.get(vectorId);
    if (!vector) {
      return err({ code: 'VECTOR_NOT_FOUND', message: 'contribution vector does not exist' });
    }
    if (vector.eligibility !== 'ELIGIBLE_SIMULATION') {
      return err({ code: vector.eligibility, message: 'vector is not eligible for issuance' });
    }
    const journalsBefore = this.ledger.journalCount();
    const proposal: SunReyCoinIssuanceProposal = Object.freeze({
      proposalId: newIssuanceProposalId(),
      vectorId: vector.vectorId,
      subjectId: vector.subjectId,
      custodyAccountId: this.ensureCustody(vector.subjectId),
      amount: vector.amount,
      financialEffect: false,
      createdAt: this.clock.now(),
    });
    this.store.putProposal(proposal);
    if (this.ledger.journalCount() !== journalsBefore) {
      throw new Error('issuance proposal must have zero financial effect');
    }
    this.emit('SunReyCoinIssuanceProposed', proposal.proposalId, {
      proposalId: proposal.proposalId,
      vectorId: proposal.vectorId,
      subjectId: proposal.subjectId,
      financialEffect: false,
    });
    this.seal('issuance.proposed', {
      proposalId: proposal.proposalId,
      posted: false,
      actorId: actor.id,
    });
    return ok(proposal);
  }

  issue(
    actorId: string,
    proposalId: string,
    customerId: Customer['id'],
  ): SunReyCoinOutcome<IssuanceRecord> {
    const proposal = this.store.proposals.get(proposalId);
    if (!proposal) {
      return { outcome: 'REJECTED', code: 'PROPOSAL_NOT_FOUND', message: 'issuance proposal does not exist' };
    }
    const vector = this.store.vectors.get(proposal.vectorId);
    if (!vector) {
      return { outcome: 'REJECTED', code: 'VECTOR_NOT_FOUND', message: 'contribution vector does not exist' };
    }
    if (this.store.issuedReplay.has(vector.replayKey)) {
      return { outcome: 'REJECTED', code: 'DUPLICATE', message: 'this receipt has already been issued' };
    }
    this.ensureCustody(proposal.subjectId);
    const intent = this.intent(actorId, ACTION_TYPES.ISSUE_SUNREY_COIN, {
      accountId: proposal.custodyAccountId,
      proposalId: proposal.proposalId,
      receiptId: vector.receiptId,
      contributionId: vector.contributionId,
      amount: proposal.amount,
    });
    const gated = this.authorize(intent, customerId);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const journal = this.ledger.postJournal({
      idempotencyKey: intent.idempotencyKey,
      executionAuthority: gated.authority,
      actionType: intent.actionType,
      classBridge: SIMULATED_FUNDING_TO_DIGITAL_ASSET_CUSTODY,
      memo: 'SunRey Coin simulation issuance',
      postings: [
        {
          accountId: SUNREY_ISSUANCE_BOOK,
          direction: 'DEBIT',
          amount: proposal.amount,
        },
        {
          accountId: proposal.custodyAccountId,
          direction: 'CREDIT',
          amount: proposal.amount,
        },
      ],
    });
    const record: IssuanceRecord = Object.freeze({
      issuanceId: newIssuanceRecordId(),
      proposalId: proposal.proposalId,
      journalId: journal.id,
      executionAuthorityId: gated.authority.authorityId,
      intentId: intent.id,
      createdAt: this.clock.now(),
    });
    this.store.putIssuance(record, vector.replayKey);
    this.emit('SunReyCoinIssued', record.issuanceId, {
      issuanceId: record.issuanceId,
      journalId: journal.id,
      subjectId: proposal.subjectId,
      scaledUnits: proposal.amount.scaledUnits.toString(),
    });
    this.seal('issued', {
      issuanceId: record.issuanceId,
      journalId: journal.id,
      intentId: intent.id,
      executionAuthorityId: gated.authority.authorityId,
      posted: true,
    });
    return { outcome: 'OK', value: record, decision: gated.decision };
  }

  transfer(
    actorId: string,
    customerId: Customer['id'],
    sourceOwnerId: string,
    destinationOwnerId: string,
    amount: AssetQuantity,
  ): SunReyCoinOutcome<TransferRecord> {
    if (!this.policy.transferEnabled) {
      return { outcome: 'REJECTED', code: 'POLICY_DISABLED', message: 'transfers are disabled' };
    }
    if (sourceOwnerId === destinationOwnerId) {
      return { outcome: 'REJECTED', code: 'SAME_OWNER', message: 'source and destination must differ' };
    }
    if (amount.assetId !== SUNREY_COIN_ASSET_ID || !amount.isPositive()) {
      return { outcome: 'REJECTED', code: 'INVALID_AMOUNT', message: 'transfer requires a positive SunRey Coin quantity' };
    }
    const source = this.ensureCustody(sourceOwnerId);
    const destination = this.ensureCustody(destinationOwnerId);
    const available = this.position(sourceOwnerId).available;
    if (available.scaledUnits < amount.scaledUnits) {
      return { outcome: 'REJECTED', code: 'INSUFFICIENT_POSITION', message: 'source available position is insufficient' };
    }
    const supplyBefore = this.supply();
    const intent = this.intent(actorId, ACTION_TYPES.TRANSFER_SUNREY_COIN, {
      accountId: source,
      destinationAccountId: destination,
      amount,
    });
    const gated = this.authorize(intent, customerId);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const journal = this.ledger.postJournal({
      idempotencyKey: intent.idempotencyKey,
      executionAuthority: gated.authority,
      actionType: intent.actionType,
      memo: 'SunRey Coin simulation transfer',
      postings: [
        { accountId: source, direction: 'DEBIT', amount },
        { accountId: destination, direction: 'CREDIT', amount },
      ],
    });
    const supplyAfter = this.supply();
    if (supplyAfter.circulating.scaledUnits !== supplyBefore.circulating.scaledUnits) {
      throw new Error('SunRey Coin transfer posted a journal that changed circulating supply');
    }
    const record: TransferRecord = Object.freeze({
      transferId: newTransferRecordId(),
      journalId: journal.id,
      sourceAccountId: source,
      destinationAccountId: destination,
      amount,
      createdAt: this.clock.now(),
    });
    this.store.putTransfer(record);
    this.emit('SunReyCoinTransferCompleted', record.transferId, {
      transferId: record.transferId,
      journalId: journal.id,
      scaledUnits: amount.scaledUnits.toString(),
    });
    this.seal('transfer.completed', { transferId: record.transferId, journalId: journal.id, posted: true });
    return { outcome: 'OK', value: record, decision: gated.decision };
  }

  burn(
    actorId: string,
    customerId: Customer['id'],
    ownerId: string,
    amount: AssetQuantity,
  ): SunReyCoinOutcome<BurnRecord> {
    if (!this.policy.burnEnabled) {
      return { outcome: 'REJECTED', code: 'POLICY_DISABLED', message: 'burns are disabled' };
    }
    const source = this.ensureCustody(ownerId);
    const available = this.position(ownerId).available;
    if (available.scaledUnits < amount.scaledUnits) {
      return { outcome: 'REJECTED', code: 'INSUFFICIENT_POSITION', message: 'burn exceeds available position' };
    }
    const intent = this.intent(actorId, ACTION_TYPES.BURN_SUNREY_COIN, {
      accountId: source,
      amount,
    });
    const gated = this.authorize(intent, customerId);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const journal = this.ledger.postJournal({
      idempotencyKey: intent.idempotencyKey,
      executionAuthority: gated.authority,
      actionType: intent.actionType,
      classBridge: SIMULATED_FUNDING_TO_DIGITAL_ASSET_CUSTODY,
      memo: 'SunRey Coin simulation burn',
      postings: [
        { accountId: source, direction: 'DEBIT', amount },
        { accountId: SUNREY_BURN_BOOK, direction: 'CREDIT', amount },
      ],
    });
    const record: BurnRecord = Object.freeze({
      burnId: newBurnRecordId(),
      journalId: journal.id,
      sourceAccountId: source,
      amount,
      createdAt: this.clock.now(),
    });
    this.store.putBurn(record);
    this.emit('SunReyCoinBurned', record.burnId, {
      burnId: record.burnId,
      journalId: journal.id,
      scaledUnits: amount.scaledUnits.toString(),
    });
    this.seal('burned', { burnId: record.burnId, journalId: journal.id, posted: true });
    return { outcome: 'OK', value: record, decision: gated.decision };
  }

  placeSimulationHold(accountId: string, amount: AssetQuantity): Result<CoinHold, SunReyCoinFailure> {
    const hold: CoinHold = Object.freeze({
      holdId: newCoinHoldId(),
      accountId,
      amount,
      state: 'ACTIVE',
      createdAt: this.clock.now(),
      closedAt: null,
    });
    this.store.putHold(hold);
    return ok(hold);
  }

  releaseSimulationHold(holdId: string): Result<CoinHold, SunReyCoinFailure> {
    const existing = this.store.holds.get(holdId);
    if (!existing) {
      return err({ code: 'HOLD_NOT_FOUND', message: 'hold does not exist' });
    }
    const released: CoinHold = Object.freeze({
      ...existing,
      state: 'RELEASED',
      closedAt: this.clock.now(),
    });
    this.store.putHold(released);
    return ok(released);
  }

  position(ownerId: string): SunReyCoinPosition {
    const accountId = custodyBookId(ownerId);
    const net = this.netFor(accountId);
    const held = [...this.store.holds.values()]
      .filter((hold) => hold.accountId === accountId && hold.state === 'ACTIVE')
      .reduce((sum, hold) => sum + hold.amount.scaledUnits, 0n);
    const availableUnits = net - held;
    return Object.freeze({
      ownerId,
      accountId,
      assetId: SUNREY_COIN_ASSET_ID,
      available: AssetQuantity.fromScaledUnits(availableUnits < 0n ? 0n : availableUnits, SUNREY_COIN_ASSET_ID),
      held: AssetQuantity.fromScaledUnits(held, SUNREY_COIN_ASSET_ID),
      pending: AssetQuantity.zero(SUNREY_COIN_ASSET_ID),
      settled: AssetQuantity.fromScaledUnits(net, SUNREY_COIN_ASSET_ID),
      marketPrice: 'UNAVAILABLE',
    });
  }

  supply(): SupplySnapshot {
    const issued = this.netFor(SUNREY_ISSUANCE_BOOK);
    const burned = this.netFor(SUNREY_BURN_BOOK);
    let holdings = 0n;
    for (const account of this.ledger.accounts.list()) {
      if (account.accountClass === 'DIGITAL_ASSET_CUSTODY' && account.currency === SUNREY_COIN_ASSET_ID) {
        holdings += this.netFor(account.id);
      }
    }
    return Object.freeze({
      issued: AssetQuantity.fromScaledUnits(issued, SUNREY_COIN_ASSET_ID),
      burned: AssetQuantity.fromScaledUnits(burned, SUNREY_COIN_ASSET_ID),
      holdings: AssetQuantity.fromScaledUnits(holdings, SUNREY_COIN_ASSET_ID),
      circulating: AssetQuantity.fromScaledUnits(issued - burned, SUNREY_COIN_ASSET_ID),
    });
  }

  reconcile(): ReconciliationSnapshot {
    const snapshot = this.supply();
    const matched = snapshot.circulating.scaledUnits === snapshot.holdings.scaledUnits;
    const outcome = matched ? 'MATCHED' : 'SUPPLY_MISMATCH';
    const record: ReconciliationSnapshot = Object.freeze({
      snapshotId: newReconciliationSnapshotId(),
      issued: snapshot.issued,
      burned: snapshot.burned,
      holdings: snapshot.holdings,
      outcome,
      createdAt: this.clock.now(),
    });
    this.store.putReconciliation(record);
    if (matched) {
      this.emit('SunReyCoinSupplyReconciled', record.snapshotId, {
        snapshotId: record.snapshotId,
        outcome,
        issued: snapshot.issued.scaledUnits.toString(),
        burned: snapshot.burned.scaledUnits.toString(),
        holdings: snapshot.holdings.scaledUnits.toString(),
      });
    } else {
      this.emit('SunReyCoinReconciliationMismatch', record.snapshotId, {
        snapshotId: record.snapshotId,
        outcome,
        issued: snapshot.issued.scaledUnits.toString(),
        holdings: snapshot.holdings.scaledUnits.toString(),
      });
    }
    this.seal('supply.reconciled', { snapshotId: record.snapshotId, outcome, autoCorrected: false });
    return record;
  }

  listVectors(): readonly AuthorizedContributionVector[] {
    return [...this.store.vectors.values()];
  }

  listJournals(): readonly Journal[] {
    return this.ledger.listJournals();
  }

  private recordIneligible(
    input: EvaluateInput,
    state: EligibilityRecord['state'],
    reason: string,
    key?: string,
  ): Result<AuthorizedContributionVector, SunReyCoinFailure> {
    const eligibility: EligibilityRecord = {
      eligibilityId: newEligibilityId(),
      vectorId: newContributionVectorId(),
      state,
      reason,
      createdAt: this.clock.now(),
    };
    this.store.putEligibility(eligibility);
    this.emit('SunReyCoinContributionEvaluated', eligibility.eligibilityId, {
      subjectId: input.subjectId,
      receiptId: input.receipt.receiptId,
      eligibility: state,
      replayKey: key,
    });
    return err({ code: state, message: reason });
  }

  private consentStateFor(
    actor: unknown,
    subjectId: string,
    receipt: CleanRoomComputationReceipt,
  ): 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'MISSING' {
    if (receipt.consentRefs.length === 0) {
      return 'MISSING';
    }
    const listed = this.consent.listMyConsents(actor, subjectId);
    if (!listed.ok) {
      return 'MISSING';
    }
    const byId = new Map(listed.value.map((row) => [row.consentId, row]));
    let sawMatch = false;
    let sawActive = false;
    let sawRevoked = false;
    let sawExpired = false;
    for (const ref of receipt.consentRefs) {
      const current = byId.get(ref.consentId);
      if (!current) {
        continue;
      }
      sawMatch = true;
      if (current.state === 'REVOKED') {
        sawRevoked = true;
      } else if (current.state === 'EXPIRED') {
        sawExpired = true;
      } else if (current.state === 'ACTIVE') {
        sawActive = true;
      }
    }
    if (!sawMatch) {
      return 'MISSING';
    }
    if (sawActive) {
      return 'ACTIVE';
    }
    if (sawRevoked) {
      return 'REVOKED';
    }
    if (sawExpired) {
      return 'EXPIRED';
    }
    return 'MISSING';
  }

  private registerSystemBooks(): void {
    for (const book of [
      { id: SUNREY_ISSUANCE_BOOK, name: 'SunRey Coin issuance (simulation system book)' },
      { id: SUNREY_TREASURY_BOOK, name: 'SunRey Coin treasury (simulation system book)' },
      { id: SUNREY_BURN_BOOK, name: 'SunRey Coin burn (simulation system book)' },
    ]) {
      this.ledger.accounts.registerSystemAccount({
        id: book.id,
        name: book.name,
        accountClass: 'SIMULATED_FUNDING_SOURCE',
        currency: SUNREY_COIN_ASSET_ID,
      });
    }
  }

  private ensureCustody(ownerId: string): string {
    const id = custodyBookId(ownerId);
    this.ledger.accounts.registerSystemAccount({
      id,
      name: `SunRey Coin custody for ${ownerId}`,
      accountClass: 'DIGITAL_ASSET_CUSTODY',
      currency: SUNREY_COIN_ASSET_ID,
      ownerId,
    });
    return id;
  }

  private netFor(accountId: string): bigint {
    let net = 0n;
    for (const posting of this.ledger.listPostingsForAccount(accountId)) {
      const units = ledgerScaledUnits(posting.amount);
      net += posting.direction === 'CREDIT' ? units : -units;
    }
    return accountId === SUNREY_ISSUANCE_BOOK || accountId === SUNREY_BURN_BOOK ? (net < 0n ? -net : net) : net;
  }

  private intent(
    actorId: string,
    actionType: string,
    payload: Record<string, unknown>,
  ): ActionIntent {
    return {
      id: asIntentId(`intent_${randomUUID()}`),
      actionType,
      payload,
      idempotencyKey: `sunrey.${actionType}.${randomUUID()}`,
      actorId,
      requestedAt: this.clock.now(),
      purpose: 'CUSTOMER_DIGITAL_ASSET',
    };
  }

  private authorize(
    intent: ActionIntent,
    customerId: Customer['id'],
  ):
    | { readonly outcome: 'ALLOWED'; readonly decision: AuthorizationDecision; readonly authority: ExecutionAuthority }
    | { readonly outcome: 'REFUSED'; readonly result: SunReyCoinOutcome<never> } {
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
      evidenceRecordId: decision.evidenceRecordId,
      executionAuthorityId: decision.executionAuthority?.authorityId ?? null,
    });
    if (decision.status !== 'ALLOW') {
      this.seal(`${intent.actionType}_KERNEL_REFUSED`, { intentId: intent.id, status: decision.status, posted: false });
      return { outcome: 'REFUSED', result: { outcome: 'KERNEL_REFUSED', decision } };
    }
    const structural = validateIntentStructure(intent, {
      products: this.catalog.products,
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
    this.evidence.seal(`${EVIDENCE_KIND_SUNREY_COIN}:${kind}`, payload);
  }
}

function factorsFromContribution(
  receipt: CleanRoomComputationReceipt,
  contribution: ContributionComputationReference,
): ContributionFactors {
  const provenance =
    contribution.provenanceScoreInputs.provenanceStrength === 'CONNECTOR'
      ? 100n
      : contribution.provenanceScoreInputs.provenanceStrength === 'UPLOAD'
        ? 70n
        : 60n;
  const verification =
    contribution.provenanceScoreInputs.sourceVerification === 'SIMULATED_CONNECTOR'
      ? 100n
      : contribution.provenanceScoreInputs.sourceVerification === 'USER_UPLOADED'
        ? 70n
        : 50n;
  const freshness = contribution.provenanceScoreInputs.freshness.length > 0 ? 100n : 80n;
  const completeness = contribution.provenanceScoreInputs.schemaCompleteness === 'COMPLETE' ? 100n : 50n;
  const authorizedScope = receipt.purposeId.length > 0 ? 100n : 0n;
  const uniqueness = contribution.provenanceScoreInputs.duplicateState === 'UNIQUE' ? 100n : 0n;
  const computationParticipation = contribution.participationState === 'INCLUDED' ? 100n : 0n;
  const researchComputeUtility = receipt.egressDecision === 'RELEASE' ? 100n : 40n;
  return Object.freeze({
    provenance,
    verification,
    freshness,
    completeness,
    authorizedScope,
    uniqueness,
    computationParticipation,
    researchComputeUtility,
  });
}

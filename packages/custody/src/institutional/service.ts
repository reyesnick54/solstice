import { createHash, randomUUID } from 'node:crypto';

import type { Clock } from '../../../config/src/clock.ts';
import { LIVE_CRYPTO_ENABLED, LIVE_EXCHANGE_ENABLED } from '../../../config/src/flags.ts';
import type { Customer, CustomerId } from '../../../domain/src/customer.ts';
import type { Jurisdiction } from '../../../domain/src/jurisdiction.ts';
import { isOk } from '../../../domain/src/result.ts';
import type { EvidenceVault } from '../../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../../events/src/events.ts';
import {
  actionTypesFromCapabilities,
  type IdentityAuthorityPort,
} from '../../../identity/src/index.ts';
import { openComplianceCase, type ComplianceCase } from '../../../kernel/src/compliance/cases.ts';
import type { ComplianceKernel } from '../../../kernel/src/kernel.ts';
import type { KernelFacts } from '../../../kernel/src/proofs.ts';
import { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import { asIntentId, type ActionIntent } from '../../../permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../../permissions/src/action-types.ts';
import type { AuthorizationDecision } from '../../../permissions/src/decision.ts';
import type { AuthorityIssuer } from '../../../permissions/src/execution-authority.ts';
import { SUITE_SUNREY_ED25519_V1, type CryptoSuiteId } from '../../../security/src/crypto-suite.ts';
import { sha256Hex } from '../../../security/src/hash.ts';
import type { HsmKeyHandle } from '../../../security/src/hsm-kms.ts';
import type { NativeChainTransfer, NativeCustodyChainPort } from '../../../sunrey-chain/src/native-custody/port.ts';
import type { CustodyCatalog } from '../service.ts';
import type { DestinationRiskProvider, TravelRuleNetworkPort } from '../ports.ts';
import { EVIDENCE_KIND_CUSTODY } from '../taxonomy.ts';
import { evaluateTravelRuleApplicability, type TravelRulePack } from '../travel-rule.ts';
import type { CustodyOutcome } from '../types.ts';
import type { ExchangeCustodyPort, ExchangeReservation } from './exchange.ts';
import {
  newApprovalId,
  newCompromiseIncidentId,
  newCustodyWalletId,
  newInstitutionalDestinationId,
  newNativeWithdrawalId,
  newPreviewId,
  newRebalanceProposalId,
  newVaultId,
  type NativeWithdrawalId,
  type VaultId,
} from './ids.ts';
import { approvalSatisfied, evaluateWithdrawalPolicy, previewBindsApprovedBytes } from './policies.ts';
import { buildRecoveryManifest } from './recovery.ts';
import type { InstitutionalSigningProvider } from './signing.ts';
import { InstitutionalCustodyStore } from './store.ts';
import {
  CUSTODY_KEY_PURPOSE,
  DEVELOPMENT_TIER_LIMITS,
  VAULT_SCHEMA_VERSION,
  type ApprovalMode,
  type CustodyActorKind,
  type CustodyType,
  type CustodyWalletClass,
  type HumanCustodyActor,
  type InstitutionalSecurityControl,
  type SecurityTier,
  type SigningProviderKind,
} from './taxonomy.ts';
import type {
  ApprovalAction,
  ColdSignatureImport,
  ColdSigningPackage,
  CompromiseIncident,
  CustodyVault,
  CustodyWallet,
  DerivedPosition,
  InstitutionalDestination,
  InstitutionalReconciliationReport,
  NativeDepositRecord,
  NativeWithdrawal,
  RebalanceProposal,
  RecoveryManifest,
  TransactionPreview,
} from './types.ts';

function isHuman(actorKind: CustodyActorKind): actorKind is HumanCustodyActor {
  return actorKind === 'HUMAN_OPERATOR' || actorKind === 'HUMAN_SECURITY';
}

function encodePreviewBytes(preview: Omit<TransactionPreview, 'previewId' | 'previewHash'>): Buffer {
  return Buffer.from(
    [
      preview.source,
      preview.destination,
      preview.assetId,
      preview.quantity.toString(),
      preview.feeAssetId,
      preview.maxFee.toString(),
      preview.nonce.toString(),
      preview.networkId,
      preview.chainId,
      preview.expectedStateEffect,
    ].join('|'),
    'utf8',
  );
}

export class InstitutionalCustodyService implements ExchangeCustodyPort {
  private readonly kernel: ComplianceKernel;
  private readonly issuer: AuthorityIssuer;
  private readonly evidence: EvidenceVault;
  private readonly events: DomainEventLog;
  private readonly clock: Clock;
  private readonly identity: IdentityAuthorityPort;
  private readonly catalog: CustodyCatalog;
  private readonly chain: NativeCustodyChainPort;
  private readonly signer: InstitutionalSigningProvider;
  private readonly destinationRisk: DestinationRiskProvider;
  private readonly travelNetwork: TravelRuleNetworkPort;
  private readonly pack: TravelRulePack;
  private readonly store = new InstitutionalCustodyStore();
  readonly cases: ComplianceCase[] = [];

  constructor(input: {
    readonly kernel: ComplianceKernel;
    readonly issuer: AuthorityIssuer;
    readonly evidence: EvidenceVault;
    readonly events: DomainEventLog;
    readonly clock: Clock;
    readonly identity: IdentityAuthorityPort;
    readonly catalog: CustodyCatalog;
    readonly chain: NativeCustodyChainPort;
    readonly signer: InstitutionalSigningProvider;
    readonly destinationRisk: DestinationRiskProvider;
    readonly travelNetwork: TravelRuleNetworkPort;
    readonly pack: TravelRulePack;
  }) {
    if (LIVE_EXCHANGE_ENABLED !== false || LIVE_CRYPTO_ENABLED !== false) {
      throw new Error('live custody and live crypto paths are forbidden');
    }
    this.kernel = input.kernel;
    this.issuer = input.issuer;
    this.evidence = input.evidence;
    this.events = input.events;
    this.clock = input.clock;
    this.identity = input.identity;
    this.catalog = input.catalog;
    this.chain = input.chain;
    this.signer = input.signer;
    this.destinationRisk = input.destinationRisk;
    this.travelNetwork = input.travelNetwork;
    this.pack = input.pack;
  }

  createVault(input: {
    readonly actorKind: CustodyActorKind;
    readonly custodyType: CustodyType;
    readonly securityTier: SecurityTier;
    readonly approvalMode: ApprovalMode;
    readonly authorizedApproverIds: readonly string[];
    readonly requiredApprovals?: number;
    readonly classifications: readonly CustodyWalletClass[];
    readonly providerKind?: SigningProviderKind;
  }): CustodyOutcome<CustodyVault> {
    if (!isHuman(input.actorKind)) {
      return { outcome: 'REJECTED', code: 'AI_CANNOT_OPERATE', message: 'AI cannot create a custody vault' };
    }
    const vaultId = newVaultId();
    const vault: CustodyVault = Object.freeze({
      vaultId,
      custodyType: input.custodyType,
      network: this.chain.networkId,
      authorizedAssets: Object.freeze(['SUNREY_COIN'] as const),
      walletIds: Object.freeze([]),
      signingPolicy: Object.freeze({
        providerKind: input.providerKind ?? this.signer.kind,
        requiredSuiteId: SUITE_SUNREY_ED25519_V1,
        purpose: CUSTODY_KEY_PURPOSE,
      }),
      approvalPolicy: Object.freeze({
        mode: input.approvalMode,
        requiredApprovals: input.requiredApprovals ?? (input.approvalMode === 'SINGLE_OPERATOR' ? 1 : 2),
        authorizedApproverIds: Object.freeze([...input.authorizedApproverIds]),
        highValueThreshold: 500_000n,
      }),
      velocityPolicy: Object.freeze({
        maxPerWithdrawal: DEVELOPMENT_TIER_LIMITS[input.securityTier],
        dailyLimit: DEVELOPMENT_TIER_LIMITS[input.securityTier],
        epochLimit: DEVELOPMENT_TIER_LIMITS[input.securityTier] * 4n,
      }),
      destinationPolicy: Object.freeze({
        requireApproved: true,
        coolingPeriodHeights: 0n,
        allowNewWithoutReview: false,
      }),
      securityTier: input.securityTier,
      status: 'ACTIVE',
      providerReference: this.signer.kind,
      createdAt: this.clock.now(),
      schemaVersion: VAULT_SCHEMA_VERSION,
    });
    this.store.putVault(vault);
    void input.classifications;
    this.seal('vault.created', { vaultId, custodyType: input.custodyType, securityTier: input.securityTier });
    return { outcome: 'OK', value: vault };
  }

  showVault(vaultId: VaultId): CustodyVault | undefined {
    return this.store.vaults.get(vaultId);
  }

  createAddress(input: {
    readonly actorKind: CustodyActorKind;
    readonly vaultId: VaultId;
    readonly classifications: readonly CustodyWalletClass[];
  }): CustodyOutcome<CustodyWallet> {
    if (!isHuman(input.actorKind)) {
      return { outcome: 'REJECTED', code: 'AI_CANNOT_OPERATE', message: 'AI cannot assign a custody address' };
    }
    const vault = this.store.vaults.get(input.vaultId);
    if (!vault) {
      return { outcome: 'REJECTED', code: 'UNKNOWN_VAULT', message: 'vault not found' };
    }
    const generated = this.signer.generate(SUITE_SUNREY_ED25519_V1);
    if (!generated.ok) {
      return { outcome: 'REJECTED', code: generated.error.code, message: generated.error.message };
    }
    const descriptor = this.signer.publicDescriptor(generated.value);
    if (!descriptor.ok) {
      return { outcome: 'REJECTED', code: descriptor.error.code, message: descriptor.error.message };
    }
    const wallet: CustodyWallet = Object.freeze({
      walletId: newCustodyWalletId(),
      vaultId: vault.vaultId,
      classifications: Object.freeze([...input.classifications]),
      address: this.chain.addressFromPublicKey(descriptor.value.publicKeyHex),
      assetId: 'SUNREY_COIN',
      signerHandle: generated.value,
      createdAt: this.clock.now(),
    });
    this.store.putWallet(wallet);
    this.store.putVault(Object.freeze({ ...vault, walletIds: Object.freeze([...vault.walletIds, wallet.walletId]) }));
    this.seal('address.created', { vaultId: vault.vaultId, walletId: wallet.walletId, address: wallet.address });
    return { outcome: 'OK', value: wallet };
  }

  recognizeFinalizedDeposits(): readonly NativeDepositRecord[] {
    const created: NativeDepositRecord[] = [];
    for (const block of this.chain.listFinalizedBlocks()) {
      if (block.height <= this.store.lastIndexedHeight) {
        continue;
      }
      if (!block.finalized) {
        continue;
      }
      for (const tx of block.transactions) {
        const wallet = [...this.store.wallets.values()].find((entry) => entry.address === tx.destination);
        if (!wallet) {
          continue;
        }
        const depositKey = `${tx.txId}:${tx.destination}`;
        if (this.store.deposits.has(depositKey)) {
          continue;
        }
        const screen = this.destinationRisk.screen({
          address: tx.source,
          customerId: wallet.vaultId,
          assetId: tx.assetId,
        });
        const deposit: NativeDepositRecord = Object.freeze({
          depositKey,
          vaultId: wallet.vaultId,
          walletId: wallet.walletId,
          address: wallet.address,
          txId: tx.txId,
          height: block.height,
          quantity: tx.quantity,
          assetId: 'SUNREY_COIN',
          screeningOutcome: screen.outcome,
          mempoolRejected: true,
          createdAt: this.clock.now(),
        });
        this.store.putDeposit(deposit);
        this.store.attributed.set(wallet.address, (this.store.attributed.get(wallet.address) ?? 0n) + tx.quantity);
        created.push(deposit);
        this.seal('deposit.recognized', {
          depositKey,
          txId: tx.txId,
          height: block.height.toString(),
          finalizedOnly: true,
        });
      }
      this.store.lastIndexedHeight = block.height;
    }
    return created;
  }

  listDeposits(vaultId?: VaultId): readonly NativeDepositRecord[] {
    return [...this.store.deposits.values()].filter((deposit) => !vaultId || deposit.vaultId === vaultId);
  }

  registerDestination(input: {
    readonly actorKind: CustodyActorKind;
    readonly actorId: string;
    readonly vaultId: VaultId;
    readonly address: string;
    readonly label: string;
  }): CustodyOutcome<InstitutionalDestination> {
    if (!isHuman(input.actorKind)) {
      return { outcome: 'REJECTED', code: 'AI_CANNOT_OPERATE', message: 'AI cannot register a destination' };
    }
    const vault = this.store.vaults.get(input.vaultId);
    if (!vault) {
      return { outcome: 'REJECTED', code: 'UNKNOWN_VAULT', message: 'vault not found' };
    }
    const destination: InstitutionalDestination = Object.freeze({
      destinationId: newInstitutionalDestinationId(),
      vaultId: input.vaultId,
      address: input.address,
      label: input.label,
      status: 'NEW',
      approvedAtHeight: null,
      lastChangedAt: this.clock.now(),
      changeAuthorizedBy: input.actorId,
    });
    this.store.putDestination(destination);
    this.seal('destination.registered', { destinationId: destination.destinationId, status: 'NEW' });
    return { outcome: 'OK', value: destination };
  }

  verifyDestination(input: {
    readonly actorKind: CustodyActorKind;
    readonly actorId: string;
    readonly destinationId: InstitutionalDestination['destinationId'];
    readonly status: 'PENDING_VERIFICATION' | 'APPROVED' | 'RESTRICTED' | 'REVOKED';
  }): CustodyOutcome<InstitutionalDestination> {
    if (!isHuman(input.actorKind)) {
      return { outcome: 'REJECTED', code: 'AI_CANNOT_OPERATE', message: 'AI cannot change destination status' };
    }
    const current = this.store.destinations.get(input.destinationId);
    if (!current) {
      return { outcome: 'REJECTED', code: 'UNKNOWN_DESTINATION', message: 'destination not found' };
    }
    const next: InstitutionalDestination = Object.freeze({
      ...current,
      status: input.status,
      approvedAtHeight: input.status === 'APPROVED' ? this.chain.latestFinalizedHeight() : current.approvedAtHeight,
      lastChangedAt: this.clock.now(),
      changeAuthorizedBy: input.actorId,
    });
    this.store.putDestination(next);
    this.seal('destination.status', { destinationId: next.destinationId, status: next.status });
    return { outcome: 'OK', value: next };
  }

  changeDestinationAddress(input: {
    readonly actorKind: CustodyActorKind;
    readonly actorId: string;
    readonly destinationId: InstitutionalDestination['destinationId'];
    readonly address: string;
  }): CustodyOutcome<InstitutionalDestination> {
    if (!isHuman(input.actorKind)) {
      return { outcome: 'REJECTED', code: 'AI_CANNOT_OPERATE', message: 'address change requires a human' };
    }
    const current = this.store.destinations.get(input.destinationId);
    if (!current) {
      return { outcome: 'REJECTED', code: 'UNKNOWN_DESTINATION', message: 'destination not found' };
    }
    const next: InstitutionalDestination = Object.freeze({
      ...current,
      address: input.address,
      status: 'PENDING_VERIFICATION',
      approvedAtHeight: null,
      lastChangedAt: this.clock.now(),
      changeAuthorizedBy: input.actorId,
    });
    this.store.putDestination(next);
    this.seal('destination.address_changed', { destinationId: next.destinationId, authorized: true });
    return { outcome: 'OK', value: next };
  }

  requestWithdrawal(input: {
    readonly actorId: string;
    readonly actorKind: CustodyActorKind;
    readonly customerId: CustomerId;
    readonly vaultId: VaultId;
    readonly walletId: CustodyWallet['walletId'];
    readonly destinationId: InstitutionalDestination['destinationId'];
    readonly quantity: bigint;
    readonly riskFlag?: boolean;
  }): CustodyOutcome<NativeWithdrawal> {
    if (!isHuman(input.actorKind)) {
      return { outcome: 'REJECTED', code: 'AI_CANNOT_APPROVE', message: 'AI cannot request a custody withdrawal' };
    }
    if (this.controlActive('WITHDRAWAL_HALT') || this.controlActive('ASSET_WITHDRAWAL_HALT')) {
      return { outcome: 'REJECTED', code: 'WITHDRAWAL_HALTED', message: 'withdrawal security control is active' };
    }
    const vault = this.store.vaults.get(input.vaultId);
    const wallet = this.store.wallets.get(input.walletId);
    const destination = this.store.destinations.get(input.destinationId);
    if (!vault || !wallet || !destination || wallet.vaultId !== vault.vaultId) {
      return { outcome: 'REJECTED', code: 'UNKNOWN_WITHDRAWAL_CONTEXT', message: 'vault, wallet, or destination missing' };
    }
    if (vault.securityTier === 'HOT' && this.controlActive('HOT_VAULT_HALT')) {
      return { outcome: 'REJECTED', code: 'HOT_VAULT_HALTED', message: 'hot vault halt is active' };
    }
    if (destination.status !== 'APPROVED') {
      return { outcome: 'REJECTED', code: 'UNAPPROVED_DESTINATION', message: 'destination is not APPROVED' };
    }
    const available = this.chain.holding(wallet.address, 'SUNREY_COIN') - this.pendingOut(wallet.address);
    if (available < input.quantity) {
      return { outcome: 'REJECTED', code: 'INSUFFICIENT_ON_CHAIN', message: 'withdrawal exceeds on-chain holding' };
    }
    const screen = this.destinationRisk.screen({
      address: destination.address,
      customerId: input.customerId,
      assetId: 'SUNREY_COIN',
    });
    if (screen.outcome === 'BLOCK') {
      this.openCase('SANCTIONS_REVIEW', ['DESTINATION_BLOCK'], input.customerId);
      return { outcome: 'REJECTED', code: 'DESTINATION_BLOCK', message: screen.reason };
    }
    const customer = this.catalog.customers.get(input.customerId);
    const travel = evaluateTravelRuleApplicability({
      pack: this.pack,
      originatorJurisdiction: customer?.jurisdiction ?? ('GB' as Jurisdiction),
      quantity: AssetQuantity.fromScaledUnits(input.quantity, 'SUNREY_COIN'),
      counterpartyIsVasp: this.travelNetwork.discoverCounterparty(destination.address) !== null,
    });
    const decision = evaluateWithdrawalPolicy({
      vault,
      quantity: input.quantity,
      destination,
      destinationHistoryCount: 1,
      screening: screen.outcome,
      travelRule: travel,
      dailySpent: this.spentToday(vault.vaultId),
      epochSpent: this.spentToday(vault.vaultId),
      currentHeight: this.chain.latestFinalizedHeight(),
      riskFlag: input.riskFlag === true,
    });
    if (decision === 'REJECTED') {
      return { outcome: 'REJECTED', code: 'WITHDRAWAL_POLICY_REJECTED', message: 'withdrawal policy rejected the request' };
    }
    const intent = this.intent(input.actorId, ACTION_TYPES.INITIATE_ASSET_WITHDRAWAL, {
      accountId: wallet.walletId,
      customerId: input.customerId,
      destinationId: destination.destinationId,
      amount: AssetQuantity.fromScaledUnits(input.quantity, 'SUNREY_COIN'),
    });
    const gated = this.authorizeIntent(intent, input.customerId);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const state = decision === 'ELIGIBLE' ? 'POLICY_EVALUATED' : 'AWAITING_APPROVAL';
    const withdrawal: NativeWithdrawal = Object.freeze({
      withdrawalId: newNativeWithdrawalId(),
      vaultId: vault.vaultId,
      walletId: wallet.walletId,
      destinationId: destination.destinationId,
      quantity: input.quantity,
      state,
      policyDecision: decision,
      screeningOutcome: screen.outcome,
      travelRule: travel,
      preview: null,
      approvals: Object.freeze([]),
      chainTxId: null,
      submittedOnce: false,
      createdAt: this.clock.now(),
    });
    this.store.putWithdrawal(withdrawal);
    this.seal('withdrawal.requested', {
      withdrawalId: withdrawal.withdrawalId,
      decision,
      noSecondLedger: true,
    });
    return { outcome: 'OK', value: withdrawal, decision: gated.decision };
  }

  approveWithdrawal(input: {
    readonly actorId: string;
    readonly actorKind: CustodyActorKind;
    readonly withdrawalId: NativeWithdrawalId;
    readonly decision: 'APPROVE' | 'REJECT';
  }): CustodyOutcome<NativeWithdrawal> {
    if (!isHuman(input.actorKind)) {
      return { outcome: 'REJECTED', code: 'AI_CANNOT_APPROVE', message: 'AI cannot approve a custody withdrawal' };
    }
    const current = this.store.withdrawals.get(input.withdrawalId);
    if (!current) {
      return { outcome: 'REJECTED', code: 'UNKNOWN_WITHDRAWAL', message: 'withdrawal not found' };
    }
    const vault = this.store.vaults.get(current.vaultId);
    if (!vault) {
      return { outcome: 'REJECTED', code: 'UNKNOWN_VAULT', message: 'vault not found' };
    }
    if (!vault.approvalPolicy.authorizedApproverIds.includes(input.actorId)) {
      return { outcome: 'REJECTED', code: 'APPROVER_NOT_AUTHORIZED', message: 'actor is not an authorized approver' };
    }
    const action: ApprovalAction = Object.freeze({
      approvalId: newApprovalId(),
      withdrawalId: current.withdrawalId,
      actorId: input.actorId,
      actorKind: input.actorKind,
      decidedAt: this.clock.now(),
      decision: input.decision,
    });
    this.store.approvals.push(action);
    if (input.decision === 'REJECT') {
      const rejected = Object.freeze({ ...current, state: 'REJECTED' as const, approvals: Object.freeze([...current.approvals, action]) });
      this.store.putWithdrawal(rejected);
      this.seal('withdrawal.rejected', { withdrawalId: current.withdrawalId, actorId: input.actorId });
      return { outcome: 'OK', value: rejected };
    }
    const approvals = Object.freeze([...current.approvals, action]);
    const satisfied = approvalSatisfied(vault.approvalPolicy, approvals, current.quantity);
    const next = Object.freeze({
      ...current,
      approvals,
      state: satisfied ? ('APPROVED' as const) : ('AWAITING_APPROVAL' as const),
    });
    this.store.putWithdrawal(next);
    this.seal('withdrawal.approval', {
      withdrawalId: current.withdrawalId,
      actorId: input.actorId,
      satisfied,
    });
    return { outcome: 'OK', value: next };
  }

  simulateWithdrawal(withdrawalId: NativeWithdrawalId): CustodyOutcome<NativeWithdrawal> {
    const current = this.store.withdrawals.get(withdrawalId);
    if (!current || (current.state !== 'APPROVED' && current.state !== 'POLICY_EVALUATED')) {
      return { outcome: 'REJECTED', code: 'NOT_APPROVED', message: 'simulation requires an approved or eligible withdrawal' };
    }
    const vault = this.store.vaults.get(current.vaultId);
    const wallet = this.store.wallets.get(current.walletId);
    const destination = this.store.destinations.get(current.destinationId);
    if (!vault || !wallet || !destination) {
      return { outcome: 'REJECTED', code: 'UNKNOWN_WITHDRAWAL_CONTEXT', message: 'missing vault context' };
    }
    if (vault.approvalPolicy.mode !== 'SINGLE_OPERATOR' && current.state !== 'APPROVED') {
      return { outcome: 'REJECTED', code: 'ADDITIONAL_APPROVAL_REQUIRED', message: 'dual control is not satisfied' };
    }
    const nonce = this.chain.holding(wallet.address, 'SUNREY_COIN');
    const draft = {
      source: wallet.address,
      destination: destination.address,
      assetId: 'SUNREY_COIN' as const,
      quantity: current.quantity,
      feeAssetId: 'SUNREY_COIN' as const,
      maxFee: 0n,
      nonce,
      networkId: this.chain.networkId,
      chainId: this.chain.chainId,
      expectedStateEffect: `debit ${current.quantity} from ${wallet.address}; credit ${destination.address}`,
      canonicalBytesHex: '',
    };
    const canonical = encodePreviewBytes(draft);
    const preview: TransactionPreview = Object.freeze({
      ...draft,
      previewId: newPreviewId(),
      canonicalBytesHex: canonical.toString('hex'),
      previewHash: sha256Hex(canonical),
    });
    const next = Object.freeze({ ...current, preview, state: current.state });
    this.store.putWithdrawal(next);
    this.seal('withdrawal.simulated', { withdrawalId, previewHash: preview.previewHash });
    return { outcome: 'OK', value: next };
  }

  signAndSubmitWithdrawal(input: {
    readonly actorKind: CustodyActorKind;
    readonly withdrawalId: NativeWithdrawalId;
    readonly suiteId?: CryptoSuiteId;
  }): CustodyOutcome<NativeWithdrawal> {
    if (!isHuman(input.actorKind)) {
      return { outcome: 'REJECTED', code: 'AI_CANNOT_APPROVE', message: 'AI cannot sign a custody withdrawal' };
    }
    if (this.controlActive('SIGNING_HALT')) {
      return { outcome: 'REJECTED', code: 'SIGNING_HALTED', message: 'signing halt is active' };
    }
    const current = this.store.withdrawals.get(input.withdrawalId);
    if (!current?.preview) {
      return { outcome: 'REJECTED', code: 'PREVIEW_REQUIRED', message: 'approved preview is required before signing' };
    }
    if (current.submittedOnce) {
      return { outcome: 'REJECTED', code: 'NO_BLIND_RESUBMIT', message: 'a second economic withdrawal must not be signed' };
    }
    const wallet = this.store.wallets.get(current.walletId);
    if (!wallet?.signerHandle) {
      return { outcome: 'REJECTED', code: 'SIGNER_MISSING', message: 'wallet has no signer handle' };
    }
    if (wallet.signerHandle.compromised || wallet.signerHandle.disabled) {
      return { outcome: 'REJECTED', code: 'KEY_COMPROMISED', message: 'compromised or disabled key cannot sign' };
    }
    const vault = this.store.vaults.get(current.vaultId);
    if (vault && vault.approvalPolicy.mode !== 'SINGLE_OPERATOR' && current.state !== 'APPROVED') {
      return { outcome: 'REJECTED', code: 'ADDITIONAL_APPROVAL_REQUIRED', message: 'dual control is not satisfied' };
    }
    const suiteId = input.suiteId ?? SUITE_SUNREY_ED25519_V1;
    const digest = Buffer.from(current.preview.previewHash, 'hex');
    const signed = this.signer.sign({
      handle: wallet.signerHandle,
      digest,
      purpose: CUSTODY_KEY_PURPOSE,
      suiteId,
    });
    if (!signed.ok) {
      return { outcome: 'REJECTED', code: signed.error.code, message: signed.error.message };
    }
    const descriptor = this.signer.publicDescriptor(wallet.signerHandle);
    if (!descriptor.ok) {
      return { outcome: 'REJECTED', code: descriptor.error.code, message: descriptor.error.message };
    }
    if (!previewBindsApprovedBytes(current.preview, current.preview.canonicalBytesHex)) {
      return { outcome: 'REJECTED', code: 'PREVIEW_BINDING_FAILED', message: 'signed bytes do not match approved preview' };
    }
    const tx: NativeChainTransfer = Object.freeze({
      txId: current.preview.previewHash,
      source: current.preview.source,
      destination: current.preview.destination,
      assetId: 'SUNREY_COIN',
      quantity: current.preview.quantity,
      feeAssetId: 'SUNREY_COIN',
      maxFee: current.preview.maxFee,
      nonce: current.preview.nonce,
      networkId: current.preview.networkId,
      chainId: current.preview.chainId,
      canonicalBytesHex: current.preview.canonicalBytesHex,
      previewHash: current.preview.previewHash,
      signatureHex: signed.value.signatureHex,
      signerPublicKeyHex: descriptor.value.publicKeyHex,
      suiteId,
    });
    const signing: NativeWithdrawal = Object.freeze({ ...current, state: 'SIGNED' as const });
    this.store.putWithdrawal(signing);
    const submitted = this.chain.submit(tx);
    if (submitted.kind === 'SUBMISSION_UNKNOWN') {
      const unknown: NativeWithdrawal = Object.freeze({
        ...signing,
        state: 'SUBMISSION_UNKNOWN',
        chainTxId: submitted.txId,
        submittedOnce: true,
      });
      this.store.putWithdrawal(unknown);
      this.seal('withdrawal.unknown', { withdrawalId: unknown.withdrawalId, txId: submitted.txId, noResubmit: true });
      return { outcome: 'OK', value: unknown };
    }
    const next: NativeWithdrawal = Object.freeze({
      ...signing,
      state: 'SUBMITTED',
      chainTxId: submitted.txId,
      submittedOnce: true,
    });
    this.store.putWithdrawal(next);
    this.seal('withdrawal.submitted', { withdrawalId: next.withdrawalId, txId: submitted.txId, noResubmit: true });
    return { outcome: 'OK', value: next };
  }

  recognizeFinality(withdrawalId: NativeWithdrawalId): CustodyOutcome<NativeWithdrawal> {
    const current = this.store.withdrawals.get(withdrawalId);
    if (!current) {
      return { outcome: 'REJECTED', code: 'UNKNOWN_WITHDRAWAL', message: 'withdrawal not found' };
    }
    if (!current.chainTxId) {
      return { outcome: 'OK', value: current };
    }
    const queried = this.chain.queryByTxId(current.chainTxId);
    if (queried.kind === 'FINALIZED') {
      const attributed = this.store.attributed.get(current.preview?.source ?? '') ?? 0n;
      this.store.attributed.set(current.preview!.source, attributed - current.quantity);
      const finalized = Object.freeze({ ...current, state: 'FINALIZED' as const });
      this.store.putWithdrawal(finalized);
      this.seal('withdrawal.finalized', { withdrawalId, txId: current.chainTxId });
      return { outcome: 'OK', value: finalized };
    }
    if (current.state === 'SUBMISSION_UNKNOWN') {
      return { outcome: 'OK', value: current };
    }
    return { outcome: 'OK', value: current };
  }

  queryUnknownWithdrawal(withdrawalId: NativeWithdrawalId): CustodyOutcome<NativeWithdrawal> {
    const current = this.store.withdrawals.get(withdrawalId);
    if (!current || !current.chainTxId) {
      return { outcome: 'REJECTED', code: 'UNKNOWN_WITHDRAWAL', message: 'withdrawal not found' };
    }
    if (current.submittedOnce !== true) {
      return { outcome: 'REJECTED', code: 'NOT_SUBMITTED', message: 'query requires a prior submission' };
    }
    const discovered = this.chain.discoverUnknown(current.chainTxId);
    this.seal('withdrawal.queried', { withdrawalId, txId: current.chainTxId, noResubmit: true, kind: discovered.kind });
    if (discovered.kind === 'FINALIZED') {
      return this.recognizeFinality(withdrawalId);
    }
    return { outcome: 'OK', value: current };
  }

  exportColdPackage(withdrawalId: NativeWithdrawalId): CustodyOutcome<ColdSigningPackage> {
    const current = this.store.withdrawals.get(withdrawalId);
    if (!current?.preview || current.state !== 'APPROVED') {
      return { outcome: 'REJECTED', code: 'NOT_APPROVED', message: 'cold export requires an approved preview' };
    }
    const pack: ColdSigningPackage = Object.freeze({
      unsignedCanonicalHex: current.preview.canonicalBytesHex,
      approvalEvidence: current.approvals,
      networkId: current.preview.networkId,
      chainId: current.preview.chainId,
      assetId: 'SUNREY_COIN',
      quantity: current.quantity,
      feeLimit: current.preview.maxFee,
      expirationUnixSeconds: 1_900_000_000n,
      transactionHash: current.preview.previewHash,
      previewHash: current.preview.previewHash,
    });
    this.seal('cold.export', { withdrawalId, previewHash: pack.previewHash });
    return { outcome: 'OK', value: pack };
  }

  importColdSignature(input: {
    readonly actorKind: CustodyActorKind;
    readonly withdrawalId: NativeWithdrawalId;
    readonly pack: ColdSigningPackage;
    readonly imported: ColdSignatureImport;
    readonly isolatedSigner: { sign(request: { handle: HsmKeyHandle; digest: Buffer; purpose: typeof CUSTODY_KEY_PURPOSE; suiteId: CryptoSuiteId }): { ok: true; value: { signatureHex: string } } | { ok: false; error: { code: string; message: string } } };
  }): CustodyOutcome<NativeWithdrawal> {
    if (!isHuman(input.actorKind)) {
      return { outcome: 'REJECTED', code: 'AI_CANNOT_APPROVE', message: 'AI cannot import a cold signature' };
    }
    const current = this.store.withdrawals.get(input.withdrawalId);
    if (!current?.preview) {
      return { outcome: 'REJECTED', code: 'PREVIEW_REQUIRED', message: 'approved preview is required' };
    }
    if (input.pack.previewHash !== current.preview.previewHash) {
      return { outcome: 'REJECTED', code: 'COLD_BINDING_FAILED', message: 'cold package does not bind approved bytes' };
    }
    if (input.imported.signedCanonicalHex !== current.preview.canonicalBytesHex) {
      return { outcome: 'REJECTED', code: 'ALTERED_TRANSACTION', message: 'altered transaction after approval is rejected' };
    }
    const wallet = this.store.wallets.get(current.walletId);
    if (!wallet?.signerHandle) {
      return { outcome: 'REJECTED', code: 'SIGNER_MISSING', message: 'wallet has no signer handle' };
    }
    const signed = input.isolatedSigner.sign({
      handle: wallet.signerHandle,
      digest: Buffer.from(current.preview.previewHash, 'hex'),
      purpose: CUSTODY_KEY_PURPOSE,
      suiteId: input.imported.suiteId as CryptoSuiteId,
    });
    if (!signed.ok) {
      return { outcome: 'REJECTED', code: signed.error.code, message: signed.error.message };
    }
    if (input.imported.signatureHex && input.imported.signatureHex !== signed.value.signatureHex) {
      return { outcome: 'REJECTED', code: 'COLD_SIGNATURE_MISMATCH', message: 'imported signature does not verify approved bytes' };
    }
    const next = Object.freeze({ ...current, state: 'SIGNED' as const });
    this.store.putWithdrawal(next);
    const descriptor = this.signer.publicDescriptor(wallet.signerHandle);
    if (!descriptor.ok) {
      return { outcome: 'REJECTED', code: descriptor.error.code, message: descriptor.error.message };
    }
    const tx: NativeChainTransfer = Object.freeze({
      txId: current.preview.previewHash,
      source: current.preview.source,
      destination: current.preview.destination,
      assetId: 'SUNREY_COIN',
      quantity: current.preview.quantity,
      feeAssetId: 'SUNREY_COIN',
      maxFee: current.preview.maxFee,
      nonce: current.preview.nonce,
      networkId: current.preview.networkId,
      chainId: current.preview.chainId,
      canonicalBytesHex: current.preview.canonicalBytesHex,
      previewHash: current.preview.previewHash,
      signatureHex: signed.value.signatureHex,
      signerPublicKeyHex: descriptor.value.publicKeyHex,
      suiteId: input.imported.suiteId,
    });
    const submitted = this.chain.submit(tx);
    const complete = Object.freeze({
      ...next,
      state: submitted.kind === 'SUBMISSION_UNKNOWN' ? ('SUBMISSION_UNKNOWN' as const) : ('SUBMITTED' as const),
      chainTxId: submitted.txId,
      submittedOnce: true,
    });
    this.store.putWithdrawal(complete);
    this.seal('cold.imported', { withdrawalId: current.withdrawalId, txId: submitted.txId });
    return { outcome: 'OK', value: complete };
  }

  rejectAlteredPreview(withdrawalId: NativeWithdrawalId, alteredCanonicalHex: string): CustodyOutcome<never> {
    const current = this.store.withdrawals.get(withdrawalId);
    if (!current?.preview || current.preview.canonicalBytesHex !== alteredCanonicalHex) {
      return { outcome: 'REJECTED', code: 'ALTERED_TRANSACTION', message: 'altered transaction after approval is rejected' };
    }
    return { outcome: 'REJECTED', code: 'ALTERED_TRANSACTION', message: 'canonical bytes must not be rewritten after approval' };
  }

  proposeRebalance(input: {
    readonly fromVaultId: VaultId;
    readonly toVaultId: VaultId;
    readonly proposedBy: 'POLICY' | 'AI';
  }): CustodyOutcome<RebalanceProposal> {
    const from = this.store.vaults.get(input.fromVaultId);
    const to = this.store.vaults.get(input.toVaultId);
    if (!from || !to) {
      return { outcome: 'REJECTED', code: 'UNKNOWN_VAULT', message: 'vault not found' };
    }
    const direction =
      from.securityTier === 'COLD' && to.securityTier === 'WARM'
        ? 'COLD_TO_WARM'
        : from.securityTier === 'WARM' && to.securityTier === 'HOT'
          ? 'WARM_TO_HOT'
          : null;
    if (!direction) {
      return { outcome: 'REJECTED', code: 'INVALID_REBALANCE', message: 'only cold→warm or warm→hot proposals are permitted' };
    }
    const fromWallet = [...this.store.wallets.values()].find((wallet) => wallet.vaultId === from.vaultId);
    if (!fromWallet) {
      return { outcome: 'REJECTED', code: 'WALLET_MISSING', message: 'source vault has no wallet' };
    }
    const holding = this.chain.holding(fromWallet.address, 'SUNREY_COIN');
    const threshold = DEVELOPMENT_TIER_LIMITS[to.securityTier] / 2n;
    const quantity = holding > threshold ? threshold : 0n;
    const proposal: RebalanceProposal = Object.freeze({
      proposalId: newRebalanceProposalId(),
      fromVaultId: from.vaultId,
      toVaultId: to.vaultId,
      quantity,
      direction,
      proposedBy: input.proposedBy,
      canSign: false,
      canApprove: false,
      createdAt: this.clock.now(),
    });
    this.store.proposals.push(proposal);
    this.seal('rebalance.proposed', { proposalId: proposal.proposalId, proposedBy: input.proposedBy, canSign: false });
    return { outcome: 'OK', value: proposal };
  }

  reconcile(): InstitutionalReconciliationReport {
    const notes: string[] = [];
    let outcome: InstitutionalReconciliationReport['outcome'] = 'MATCHED';
    for (const wallet of this.store.wallets.values()) {
      const onChain = this.chain.holding(wallet.address, 'SUNREY_COIN');
      const attributed = this.store.attributed.get(wallet.address) ?? 0n;
      const pending = this.pendingOut(wallet.address);
      const reserved = [...this.store.reservations.values()]
        .filter((row) => row.vaultId === wallet.vaultId && !row.released)
        .reduce((sum, row) => sum + row.quantity, 0n);
      if (onChain !== attributed) {
        outcome = 'MISMATCH';
        notes.push(
          `wallet ${wallet.walletId} on-chain ${onChain} attributed ${attributed} pending ${pending} reserved ${reserved}`,
        );
      }
    }
    for (const withdrawal of this.store.withdrawals.values()) {
      if (withdrawal.state === 'SUBMISSION_UNKNOWN') {
        outcome = outcome === 'MISMATCH' ? 'MISMATCH' : 'INVESTIGATION_REQUIRED';
        notes.push(`withdrawal ${withdrawal.withdrawalId} remains SUBMISSION_UNKNOWN`);
      }
    }
    const report: InstitutionalReconciliationReport = Object.freeze({
      outcome,
      notes: Object.freeze(notes),
      createdAt: this.clock.now(),
      autoAdjustedOnChain: false,
      autoCorrected: false,
    });
    this.seal('reconciliation', { outcome, autoAdjustedOnChain: false });
    return report;
  }

  derivedPosition(walletId: CustodyWallet['walletId']): DerivedPosition | null {
    const wallet = this.store.wallets.get(walletId);
    if (!wallet) {
      return null;
    }
    return Object.freeze({
      vaultId: wallet.vaultId,
      walletId: wallet.walletId,
      address: wallet.address,
      onChain: this.chain.holding(wallet.address, 'SUNREY_COIN'),
      attributed: this.store.attributed.get(wallet.address) ?? 0n,
      pendingWithdrawals: this.pendingOut(wallet.address),
      reservedForExchange: [...this.store.reservations.values()]
        .filter((row) => row.vaultId === wallet.vaultId && !row.released)
        .reduce((sum, row) => sum + row.quantity, 0n),
      notALedgerBalance: true,
    });
  }

  setSecurityControl(input: {
    readonly kind: InstitutionalSecurityControl;
    readonly active: boolean;
    readonly actorId: string;
    readonly actorKind: CustodyActorKind;
  }): CustodyOutcome<true> {
    if (!isHuman(input.actorKind)) {
      return { outcome: 'REJECTED', code: 'AI_CANNOT_CHANGE_CONTROLS', message: 'AI cannot change security controls' };
    }
    this.store.controls.set(input.kind, {
      kind: input.kind,
      active: input.active,
      actorId: input.actorId,
      actorKind: input.actorKind,
    });
    this.seal('security.control', { kind: input.kind, active: input.active, actorKind: input.actorKind });
    return { outcome: 'OK', value: true };
  }

  reportCompromise(input: {
    readonly actorKind: CustodyActorKind;
    readonly vaultId: VaultId;
    readonly walletId: CustodyWallet['walletId'];
  }): CustodyOutcome<CompromiseIncident> {
    if (!isHuman(input.actorKind)) {
      return { outcome: 'REJECTED', code: 'AI_CANNOT_OPERATE', message: 'AI cannot declare key compromise' };
    }
    const vault = this.store.vaults.get(input.vaultId);
    const wallet = this.store.wallets.get(input.walletId);
    if (!vault || !wallet?.signerHandle) {
      return { outcome: 'REJECTED', code: 'UNKNOWN_VAULT', message: 'vault or signer missing' };
    }
    const disabled = this.signer.disable(wallet.signerHandle);
    if (!disabled.ok) {
      return { outcome: 'REJECTED', code: disabled.error.code, message: disabled.error.message };
    }
    this.store.putWallet(Object.freeze({ ...wallet, signerHandle: { ...disabled.value, compromised: true } }));
    this.store.putVault(Object.freeze({ ...vault, status: 'COMPROMISED' }));
    const incident: CompromiseIncident = Object.freeze({
      incidentId: newCompromiseIncidentId(),
      vaultId: vault.vaultId,
      keyId: wallet.signerHandle.keyId,
      signingDisabled: true,
      historicalSignaturesRewritten: false,
      createdAt: this.clock.now(),
    });
    this.store.incidents.push(incident);
    this.seal('key.compromise', {
      incidentId: incident.incidentId,
      historicalSignaturesRewritten: false,
      migrationRequired: true,
    });
    return { outcome: 'OK', value: incident };
  }

  rotateSigner(input: {
    readonly actorKind: CustodyActorKind;
    readonly walletId: CustodyWallet['walletId'];
  }): CustodyOutcome<CustodyWallet> {
    if (!isHuman(input.actorKind)) {
      return { outcome: 'REJECTED', code: 'AI_CANNOT_OPERATE', message: 'AI cannot rotate a custody signer' };
    }
    const wallet = this.store.wallets.get(input.walletId);
    if (!wallet?.signerHandle) {
      return { outcome: 'REJECTED', code: 'SIGNER_MISSING', message: 'wallet has no signer handle' };
    }
    const rotated = this.signer.rotate(wallet.signerHandle);
    if (!rotated.ok) {
      return { outcome: 'REJECTED', code: rotated.error.code, message: rotated.error.message };
    }
    const descriptor = this.signer.publicDescriptor(rotated.value);
    if (!descriptor.ok) {
      return { outcome: 'REJECTED', code: descriptor.error.code, message: descriptor.error.message };
    }
    const next = Object.freeze({
      ...wallet,
      signerHandle: rotated.value,
      address: this.chain.addressFromPublicKey(descriptor.value.publicKeyHex),
    });
    this.store.putWallet(next);
    this.seal('signer.rotated', { walletId: wallet.walletId, previousAddress: wallet.address, address: next.address });
    return { outcome: 'OK', value: next };
  }

  recoveryManifest(vaultId: VaultId): CustodyOutcome<RecoveryManifest> {
    const vault = this.store.vaults.get(vaultId);
    if (!vault) {
      return { outcome: 'REJECTED', code: 'UNKNOWN_VAULT', message: 'vault not found' };
    }
    const wallets = [...this.store.wallets.values()].filter((wallet) => wallet.vaultId === vaultId);
    return {
      outcome: 'OK',
      value: buildRecoveryManifest({
        vault,
        wallets,
        approvalPolicy: vault.approvalPolicy,
        coldBackupRefs: ['cold://simulation/airgap'],
        hsmDisasterRecoveryRef: 'hsm-dr://simulation',
        configuration: { vaultId, network: vault.network },
      }),
    };
  }

  signerStatus(): { readonly kind: SigningProviderKind; readonly healthy: boolean; readonly simulation: boolean } {
    return this.signer.status();
  }

  getWithdrawal(id: NativeWithdrawalId): NativeWithdrawal | undefined {
    return this.store.withdrawals.get(id);
  }

  walletsFor(vaultId: VaultId): readonly CustodyWallet[] {
    return [...this.store.wallets.values()].filter((wallet) => wallet.vaultId === vaultId);
  }

  exchangeDepositAddress(vaultId: VaultId): string | null {
    return this.walletsFor(vaultId)[0]?.address ?? null;
  }

  reserveForExchange(vaultId: VaultId, quantity: bigint): ExchangeReservation | { readonly rejected: true; readonly code: string } {
    const wallet = this.walletsFor(vaultId)[0];
    if (!wallet) {
      return { rejected: true, code: 'WALLET_MISSING' };
    }
    const available = this.chain.holding(wallet.address, 'SUNREY_COIN') - this.pendingOut(wallet.address);
    if (available < quantity) {
      return { rejected: true, code: 'INSUFFICIENT_ON_CHAIN' };
    }
    const reservation: ExchangeReservation = Object.freeze({
      reservationId: `xres_${randomUUID().replace(/-/g, '')}`,
      vaultId,
      quantity,
      assetId: 'SUNREY_COIN',
      released: false,
    });
    this.store.reservations.set(reservation.reservationId, {
      vaultId,
      quantity,
      released: false,
    });
    return reservation;
  }

  releaseReservation(reservationId: string): ExchangeReservation | { readonly rejected: true; readonly code: string } {
    const current = this.store.reservations.get(reservationId);
    if (!current) {
      return { rejected: true, code: 'UNKNOWN_RESERVATION' };
    }
    this.store.reservations.set(reservationId, { ...current, released: true });
    return Object.freeze({
      reservationId,
      vaultId: current.vaultId,
      quantity: current.quantity,
      assetId: 'SUNREY_COIN',
      released: true,
    });
  }

  signSettlement(): { readonly rejected: true; readonly code: 'REQUIRES_CUSTODY_APPROVAL' } {
    return { rejected: true, code: 'REQUIRES_CUSTODY_APPROVAL' };
  }

  withdrawFromExchange(): { readonly rejected: true; readonly code: string } {
    return { rejected: true, code: 'REQUIRES_CUSTODY_WITHDRAWAL_WORKFLOW' };
  }

  queryFinality(txId: string) {
    return this.chain.queryByTxId(txId);
  }

  reconcileExchangeVault(vaultId: VaultId): InstitutionalReconciliationReport {
    void vaultId;
    return this.reconcile();
  }

  fundDevelopment(address: string, quantity: bigint) {
    return this.chain.fundDevelopment(address, quantity);
  }

  finalizeBlock() {
    return this.chain.finalizeNextBlock();
  }

  private controlActive(kind: InstitutionalSecurityControl): boolean {
    return this.store.controls.get(kind)?.active === true;
  }

  private pendingOut(address: string): bigint {
    let total = 0n;
    for (const withdrawal of this.store.withdrawals.values()) {
      const wallet = this.store.wallets.get(withdrawal.walletId);
      if (wallet?.address !== address) {
        continue;
      }
      if (
        withdrawal.state === 'FINALIZED' ||
        withdrawal.state === 'REJECTED' ||
        withdrawal.state === 'CANCELLED'
      ) {
        continue;
      }
      total += withdrawal.quantity;
    }
    return total;
  }

  private spentToday(vaultId: VaultId): bigint {
    let total = 0n;
    for (const withdrawal of this.store.withdrawals.values()) {
      if (withdrawal.vaultId === vaultId && withdrawal.state === 'FINALIZED') {
        total += withdrawal.quantity;
      }
    }
    return total;
  }

  private openCase(
    caseType: 'SANCTIONS_REVIEW' | 'AML_ALERT' | 'TRANSACTION_MONITORING_ALERT',
    reasons: readonly string[],
    subjectRef: string,
  ): void {
    this.cases.push(
      openComplianceCase({
        caseType,
        reasonCodes: reasons,
        originRefs: ['institutional-custody'],
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
      idempotencyKey: `institutional.${actionType}.${payload.destinationId ?? payload.accountId ?? randomUUID()}`,
      actorId,
      requestedAt: this.clock.now(),
      purpose: 'CUSTOMER_DIGITAL_ASSET',
    };
  }

  private authorizeIntent(
    intent: ActionIntent,
    customerId: Customer['id'],
  ):
    | { readonly outcome: 'ALLOWED'; readonly decision: AuthorizationDecision }
    | { readonly outcome: 'REFUSED'; readonly result: CustodyOutcome<never> } {
    const customer = this.catalog.customers.get(customerId);
    const product = this.catalog.products.get('prod_digital_usd_gb' as never);
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
    if (decision.status !== 'ALLOW') {
      this.seal(`${intent.actionType}_KERNEL_REFUSED`, { intentId: intent.id, status: decision.status });
      return { outcome: 'REFUSED', result: { outcome: 'KERNEL_REFUSED', decision } };
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
    return { outcome: 'ALLOWED', decision };
  }

  private seal(kind: string, payload: Record<string, unknown>): void {
    this.evidence.seal(`${EVIDENCE_KIND_CUSTODY}:${kind}`, payload);
    this.events.append({
      eventType: `CustodyInstitutional.${kind}` as never,
      schemaVersion: 1,
      occurredAt: this.clock.now(),
      payload,
    } as never);
  }
}

export function digestPreview(canonicalBytesHex: string): string {
  return createHash('sha256').update(Buffer.from(canonicalBytesHex, 'hex')).digest('hex');
}

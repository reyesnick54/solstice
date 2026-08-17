/**
 * Canonical SunRey wallet engine.
 *
 * Wallet metadata is not a second native-asset ledger. Balances are
 * read from the fee/native-asset accounts. Banking Account semantics
 * are not reused.
 */

import { createHash } from 'node:crypto';

import { FeeEngine } from '../fees/engine.ts';
import type { FeeAssetId } from '../fees/types.ts';
import { MachineEconomyEngine, developmentPorts } from '../machine-economy/index.ts';
import { PROTOCOL_CHAIN_ID, PROTOCOL_NETWORK_ID } from '../protocol/constants.ts';
import type { ActorDescriptor } from '../protocol/actor.ts';
import type { NativeAssetId } from '../protocol/assets.ts';
import type { TransactionFamily } from '../protocol/transaction-family.ts';
import { AddressBook } from './address-book.ts';
import { encodeFromAccountDescriptor, encodeFromPublicKey, parseAddress } from './address.ts';
import { authorizeAccountAction, historicalSignatureStillVerifies } from './authorization.ts';
import { buildNativeTransfer, buildReservedFamily } from './builder.ts';
import { WalletHistory } from './history.ts';
import {
  CLASSICAL_WALLET_SUITE,
  HYBRID_WALLET_SUITE,
  PQ_WALLET_SUITE,
  ed25519FromSeed,
  isApprovedWalletSuite,
  publicDescriptorFromSeed,
  seedFromLabel,
  suiteRank,
  suiteToAlgorithm,
  wipeBuffer,
} from './keys.ts';
import { DevelopmentKeystore } from './keystore.ts';
import { assertMachineMaySpend } from './machine.ts';
import { NonceManager } from './nonce.ts';
import { cancelRecovery, createRecoveryPolicy, recoveryIsActive, requestRecovery } from './recovery.ts';
import { LocalEncryptedDevelopmentSigner } from './signer.ts';
import type {
  AccountDescriptor,
  AccountKeyRecord,
  AddressClass,
  AuthorizationPolicy,
  AuthorizationPolicyKind,
  BlockchainAccount,
  BuiltTransaction,
  DelegatedKeyLimit,
  RecoveryPolicy,
  WalletDescriptor,
  WalletRejection,
  WalletSignature,
  WalletTransactionRecord,
  WalletType,
} from './types.ts';
import { WALLET_SCHEMA_VERSION } from './types.ts';

export type CreateWalletInput = {
  readonly walletId: string;
  readonly ownerActorId: string;
  readonly walletType: WalletType;
  readonly accountType?: AddressClass;
  readonly policyKind?: AuthorizationPolicyKind;
  readonly threshold?: number;
  readonly signerLabels?: readonly string[];
  readonly recovery?: RecoveryPolicy;
  readonly watchOnly?: boolean;
  readonly approvedCryptoSuites?: readonly string[];
  readonly machineId?: string;
};

function actorFor(ownerActorId: string): ActorDescriptor {
  return Object.freeze({
    schemaVersion: 1,
    actorId: ownerActorId,
    actorType: 'HUMAN',
    ownerControllerId: ownerActorId,
    credentialRefs: Object.freeze([`cred.${ownerActorId}`]),
    capabilityRefs: Object.freeze([] as string[]),
    modelFirmwareRef: '',
    jurisdiction: 'SIM-DEV',
    revocationState: 'ACTIVE',
    identitySystemRef: 'solstice.identity',
  });
}

function policyOf(
  kind: AuthorizationPolicyKind,
  keyIds: readonly string[],
  threshold: number,
  recoveryKeyIds: readonly string[] = [],
): AuthorizationPolicy {
  return Object.freeze({
    schemaVersion: WALLET_SCHEMA_VERSION,
    kind,
    threshold,
    authorizedKeyIds: Object.freeze([...keyIds]),
    roleBindings: Object.freeze({ OWNER: Object.freeze([...keyIds]) }),
    recoveryKeyIds: Object.freeze([...recoveryKeyIds]),
  });
}

export class WalletEngine {
  readonly networkId: string;
  readonly chainId: string;
  readonly fees: FeeEngine;
  readonly machines: MachineEconomyEngine;
  readonly keystore: DevelopmentKeystore;
  readonly history = new WalletHistory();
  readonly addressBook = new AddressBook();
  readonly nonces = new NonceManager();
  readonly signer: LocalEncryptedDevelopmentSigner;
  height = 0;
  private readonly wallets = new Map<string, WalletDescriptor>();
  private readonly accounts = new Map<string, BlockchainAccount>();
  private readonly recoveries = new Map<string, RecoveryPolicy>();
  private readonly watchOnly = new Set<string>();
  private readonly validators: WalletEngine[] = [];

  constructor(input: {
    readonly networkId?: string;
    readonly chainId?: string;
    readonly fees?: FeeEngine;
    readonly machines?: MachineEconomyEngine;
    readonly keystore?: DevelopmentKeystore;
  } = {}) {
    this.networkId = input.networkId ?? PROTOCOL_NETWORK_ID;
    this.chainId = input.chainId ?? PROTOCOL_CHAIN_ID;
    this.fees = input.fees ?? new FeeEngine();
    this.machines = input.machines ?? new MachineEconomyEngine(developmentPorts());
    this.keystore = input.keystore ?? new DevelopmentKeystore();
    this.signer = new LocalEncryptedDevelopmentSigner(this.keystore);
  }

  attachValidators(peers: readonly WalletEngine[]): void {
    this.validators.splice(0, this.validators.length, ...peers);
  }

  registerRecoveryPolicy(policy: RecoveryPolicy): void {
    this.recoveries.set(policy.policyId, policy);
  }

  unlock(passphrase: string): void {
    this.keystore.unlock(passphrase);
  }

  lock(): void {
    this.keystore.lock();
  }

  getWallet(walletId: string): WalletDescriptor | undefined {
    return this.wallets.get(walletId);
  }

  getAccount(accountId: string): BlockchainAccount | undefined {
    return this.accounts.get(accountId);
  }

  listAccounts(): readonly BlockchainAccount[] {
    return [...this.accounts.values()];
  }

  holdings(accountId: string, asset: FeeAssetId = 'SUNREY_COIN') {
    return this.fees.accounts.position(accountId, asset);
  }

  createWallet(input: CreateWalletInput): WalletDescriptor | WalletRejection {
    const watchOnly = input.watchOnly === true || input.walletType === 'WATCH_ONLY';
    const accountType =
      input.accountType ??
      (watchOnly
        ? 'WATCH_ONLY_ACCOUNT'
        : input.walletType === 'MACHINE'
          ? 'MACHINE_ACCOUNT'
          : input.walletType === 'INSTITUTIONAL'
            ? 'INSTITUTIONAL_ACCOUNT'
            : input.policyKind === 'M_OF_N'
              ? 'MULTI_AUTH_ACCOUNT'
              : 'SINGLE_KEY_ACCOUNT');
    const labels = input.signerLabels ?? [`${input.walletId}.primary`];
    const threshold = input.threshold ?? (input.policyKind === 'M_OF_N' ? 2 : 1);
    const suites = input.approvedCryptoSuites ?? [CLASSICAL_WALLET_SUITE];
    const keys: AccountKeyRecord[] = [];
    const keyIds: string[] = [];
    if (!watchOnly && !this.keystore.unlocked) {
      return { ok: false, code: 'KEYSTORE_LOCKED', detail: 'unlock the development keystore before creating a signing wallet' };
    }
    for (const [index, label] of labels.entries()) {
      const keyId = `${input.walletId}.key.${index + 1}`;
      const seed = seedFromLabel(label);
      const suiteId = suites[Math.min(index, suites.length - 1)] ?? CLASSICAL_WALLET_SUITE;
      if (!isApprovedWalletSuite(suiteId)) {
        return { ok: false, code: 'CRYPTO_SUITE_DOWNGRADE', detail: `unknown suite ${suiteId}` };
      }
      const descriptor = publicDescriptorFromSeed(keyId, seed, suiteId);
      if (!watchOnly) {
        this.keystore.put({
          keyId,
          purpose: 'WALLET_SIGNING',
          suiteId,
          publicKeyHex: descriptor.publicKeyHex,
          seedHex: Buffer.from(seed).toString('hex'),
        });
      }
      keys.push(
        Object.freeze({
          keyId,
          suiteId,
          algorithm: suiteToAlgorithm(suiteId),
          publicKeyHex: descriptor.publicKeyHex,
          purpose: 'WALLET_SIGNING',
          status: 'ACTIVE',
          version: 1,
          createdHeight: this.height,
          activatedHeight: this.height,
          revokedHeight: null,
          rotatedFrom: null,
        }),
      );
      keyIds.push(keyId);
    }
    const recoveryKeyIds = input.recovery?.credentials.map((credential) => credential.keyId) ?? [];
    const policyKind =
      input.policyKind ??
      (accountType === 'MACHINE_ACCOUNT'
        ? 'MACHINE_MANDATE'
        : accountType === 'INSTITUTIONAL_ACCOUNT'
          ? 'INSTITUTIONAL_POLICY'
          : threshold > 1
            ? 'M_OF_N'
            : 'SINGLE_SIGNATURE');
    const policy = policyOf(policyKind, keyIds, threshold, recoveryKeyIds);
    const accountId = `bca.${input.walletId}`;
    const accountDescriptor: AccountDescriptor = Object.freeze({
      schemaVersion: WALLET_SCHEMA_VERSION,
      accountId,
      addressClass: accountType,
      authorizedKeyIds: Object.freeze([...keyIds]),
      policyKind,
      threshold,
    });
    const address =
      accountType === 'SINGLE_KEY_ACCOUNT' && keys[0]
        ? encodeFromPublicKey(this.networkId, accountType, {
            schemaVersion: 1,
            keyId: keys[0].keyId,
            suiteId: keys[0].suiteId,
            algorithm: keys[0].algorithm,
            publicKeyHex: keys[0].publicKeyHex,
            purpose: 'WALLET_SIGNING',
          })
        : encodeFromAccountDescriptor(this.networkId, keys[0]?.algorithm ?? 'ED25519_V1', accountDescriptor);
    const account: BlockchainAccount = Object.freeze({
      schemaVersion: WALLET_SCHEMA_VERSION,
      accountId,
      address,
      ownerActorId: input.ownerActorId,
      controllerActorIds: Object.freeze([input.ownerActorId]),
      accountType,
      authorizationPolicy: policy,
      nonce: 0n,
      approvedCryptoSuites: Object.freeze([...suites]),
      recoveryPolicyReference: input.recovery?.policyId ?? null,
      createdHeight: this.height,
      status: 'ACTIVE',
      keys: Object.freeze(keys),
      delegatedLimits: Object.freeze([]),
      pendingRecovery: null,
      pendingRotation: null,
      securityHoldPolicy: null,
    });
    const wallet: WalletDescriptor = Object.freeze({
      schemaVersion: WALLET_SCHEMA_VERSION,
      walletId: input.walletId,
      ownerActorId: input.ownerActorId,
      walletType: input.walletType,
      networkId: this.networkId,
      accountDescriptors: Object.freeze([accountDescriptor]),
      creationVersion: WALLET_SCHEMA_VERSION,
      cryptoPolicy: suites.join(','),
      recoveryPolicy: input.recovery?.policyId ?? null,
      status: 'ACTIVE',
    });
    this.accounts.set(accountId, account);
    this.wallets.set(input.walletId, wallet);
    this.nonces.observeChain(accountId, 0n);
    if (input.recovery) {
      this.recoveries.set(input.recovery.policyId, input.recovery);
    }
    if (watchOnly) {
      this.watchOnly.add(input.walletId);
    }
    return wallet;
  }

  faucet(accountId: string, amount: bigint, asset: FeeAssetId = 'SUNREY_COIN'): void {
    this.fees.faucet(accountId, amount, asset);
  }

  balance(accountId: string, asset: FeeAssetId = 'SUNREY_COIN'): bigint {
    return this.fees.accounts.position(accountId, asset).available;
  }

  buildTransfer(input: {
    readonly walletId: string;
    readonly toAccountId: string;
    readonly toAddressText: string;
    readonly amount: bigint;
    readonly maxFee: bigint;
    readonly assetId?: NativeAssetId;
    readonly purpose?: string;
  }): BuiltTransaction | WalletRejection {
    const wallet = this.wallets.get(input.walletId);
    const account = this.accountOf(input.walletId);
    if (!wallet || !account) {
      return { ok: false, code: 'ACCOUNT_NOT_ACTIVE', detail: 'wallet or account not found' };
    }
    if (this.watchOnly.has(input.walletId)) {
      const nonce = this.nonces.next(account.accountId);
      return buildNativeTransfer({
        account,
        actor: actorFor(account.ownerActorId),
        toAccountId: input.toAccountId,
        toAddressText: input.toAddressText,
        assetId: input.assetId ?? 'SUNREY_COIN',
        amount: input.amount,
        maxFee: input.maxFee,
        nonce,
        networkId: this.networkId,
        chainId: this.chainId,
        ...(input.purpose !== undefined ? { purpose: input.purpose } : {}),
      });
    }
    if (account.accountType === 'MACHINE_ACCOUNT') {
      const machineCheck = assertMachineMaySpend({
        engine: this.machines,
        account,
        machineId: account.ownerActorId,
        assetId: input.assetId ?? 'SUNREY_COIN',
        amount: input.amount,
        purpose: input.purpose ?? 'bounded_purchase',
      });
      if (machineCheck.ok === false) {
        return machineCheck;
      }
    }
    const nonce = this.nonces.next(account.accountId);
    return buildNativeTransfer({
      account,
      actor: actorFor(account.ownerActorId),
      toAccountId: input.toAccountId,
      toAddressText: input.toAddressText,
      assetId: input.assetId ?? 'SUNREY_COIN',
      amount: input.amount,
      maxFee: input.maxFee,
      nonce,
      networkId: this.networkId,
      chainId: this.chainId,
      ...(input.purpose !== undefined ? { purpose: input.purpose } : {}),
    });
  }

  sign(input: {
    readonly walletId: string;
    readonly built: BuiltTransaction;
    readonly keyIds: readonly string[];
  }): { readonly ok: true; readonly signatures: readonly WalletSignature[] } | WalletRejection {
    if (this.watchOnly.has(input.walletId)) {
      return { ok: false, code: 'WATCH_ONLY_CANNOT_SIGN', detail: 'watch-only wallets cannot sign, rotate, or recover' };
    }
    const account = this.accountOf(input.walletId);
    if (!account) {
      return { ok: false, code: 'ACCOUNT_NOT_ACTIVE', detail: 'account not found' };
    }
    if (input.built.networkId !== this.networkId || input.built.chainId !== this.chainId) {
      return { ok: false, code: 'WRONG_CHAIN_TRANSACTION', detail: 'transaction network or chain does not match this wallet' };
    }
    if (!this.keystore.unlocked) {
      return { ok: false, code: 'KEYSTORE_LOCKED', detail: 'development keystore is locked' };
    }
    const signatures: WalletSignature[] = [];
    for (const keyId of input.keyIds) {
      const delegated = account.delegatedLimits.find((limit) => limit.keyId === keyId);
      if (delegated) {
        const denied = this.enforceDelegation(delegated, input.built);
        if (denied) {
          return denied;
        }
      }
      signatures.push(this.signer.sign(keyId, Buffer.from(input.built.signBytesHex, 'hex')));
    }
    const authorized = authorizeAccountAction({
      account,
      bodyHash: input.built.bodyHash,
      signatures,
      currentHeight: this.height,
    });
    if (authorized.ok === false) {
      return authorized;
    }
    return { ok: true, signatures: Object.freeze(signatures) };
  }

  submit(input: {
    readonly walletId: string;
    readonly built: BuiltTransaction;
    readonly signatures: readonly WalletSignature[];
  }): { readonly ok: true; readonly txId: string; readonly height: number } | WalletRejection {
    const account = this.accountOf(input.walletId);
    if (!account) {
      return { ok: false, code: 'ACCOUNT_NOT_ACTIVE', detail: 'account not found' };
    }
    const authorized = authorizeAccountAction({
      account,
      bodyHash: input.built.bodyHash,
      signatures: input.signatures,
      currentHeight: this.height,
    });
    if (authorized.ok === false) {
      return authorized;
    }
    if (input.built.networkId !== this.networkId || input.built.chainId !== this.chainId) {
      return { ok: false, code: 'WRONG_CHAIN_TRANSACTION', detail: 'wrong-chain transaction rejected' };
    }
    const available = this.balance(account.accountId, input.built.fee.feeAsset);
    const spend = (input.built.amount ?? 0n) + input.built.fee.maximumAuthorizedFee;
    if (available < spend) {
      return { ok: false, code: 'INSUFFICIENT_BALANCE', detail: 'canonical chain balance cannot cover amount plus max_fee' };
    }
    const txId = createHash('sha256').update(input.built.bodyHash).update(input.signatures.map((item) => item.signatureHex).join('')).digest('hex');
    this.nonces.reserve(account.accountId, txId, input.built.fee.maximumAuthorizedFee);
    this.nonces.markSubmitted(account.accountId, txId);
    this.history.upsert({
      txId,
      clientTxId: input.built.clientTxId,
      accountId: account.accountId,
      family: input.built.family,
      state: 'SUBMITTED',
      assetId: input.built.assetId,
      amount: input.built.amount,
      estimatedFee: input.built.fee.estimatedFee,
      maximumAuthorizedFee: input.built.fee.maximumAuthorizedFee,
      actualFinalizedFee: null,
      height: null,
      bodyHash: input.built.bodyHash,
      historicSignatureHex: input.signatures[0]?.signatureHex ?? null,
    });
    return this.finalize(account, input.built, txId, input.signatures);
  }

  private finalize(
    account: BlockchainAccount,
    built: BuiltTransaction,
    txId: string,
    signatures: readonly WalletSignature[],
  ): { readonly ok: true; readonly txId: string; readonly height: number } | WalletRejection {
    this.height += 1;
    const actualFee = built.fee.estimatedFee;
    const transfer =
      built.amount !== null && built.counterpartyAccountId && built.assetId
        ? {
            from: account.accountId,
            to: built.counterpartyAccountId,
            asset: built.assetId,
            amount: built.amount,
          }
        : undefined;
    const executable = {
      transactionId: txId,
      payerAuthenticated: true,
      operation: 'NATIVE_TRANSFER' as const,
      encodedBytes: 256,
      signatureCount: signatures.length,
      forceOverBudget: false,
      applicationShouldFail: false,
      budget: {
        feePayer: account.accountId,
        feeAsset: built.fee.feeAsset,
        maxFee: built.fee.maximumAuthorizedFee,
        maxExecutionUnits: 10_000n,
        exemption: 'NONE' as const,
      },
      ...(transfer ? { transfer } : {}),
    };
    const result = this.fees.execute({
      tx: executable,
      blockHeight: this.height,
      blockId: `blk.${this.height}`,
      proposerId: 'val.1',
      validators: [
        { validatorId: 'val.1', votingPower: 1n },
        { validatorId: 'val.2', votingPower: 1n },
        { validatorId: 'val.3', votingPower: 1n },
        { validatorId: 'val.4', votingPower: 1n },
      ],
    });
    if (!result.ok) {
      this.nonces.markRejected(account.accountId, txId);
      this.history.mark(txId, 'REJECTED');
      return { ok: false, code: 'INSUFFICIENT_BALANCE', detail: result.rejection.detail };
    }
    const nextNonce = account.nonce + 1n;
    this.accounts.set(account.accountId, Object.freeze({ ...account, nonce: nextNonce }));
    this.nonces.markFinalized(account.accountId, txId, nextNonce);
    this.history.mark(txId, 'FINALIZED', {
      height: this.height,
      actualFinalizedFee: actualFee,
    });
    this.applyPendingActivations();
    return { ok: true, txId, height: this.height };
  }

  rotateKey(input: {
    readonly walletId: string;
    readonly currentKeyId: string;
    readonly nextLabel: string;
    readonly nextSuiteId?: string;
    readonly activationDelay?: number;
  }): { readonly ok: true; readonly nextKeyId: string } | WalletRejection {
    if (this.watchOnly.has(input.walletId)) {
      return { ok: false, code: 'WATCH_ONLY_CANNOT_SIGN', detail: 'watch-only cannot rotate keys' };
    }
    const account = this.accountOf(input.walletId);
    if (!account) {
      return { ok: false, code: 'ACCOUNT_NOT_ACTIVE', detail: 'account not found' };
    }
    const current = account.keys.find((key) => key.keyId === input.currentKeyId);
    if (!current || current.status !== 'ACTIVE') {
      return { ok: false, code: 'OLD_ROTATED_KEY', detail: 'current key is not active' };
    }
    const nextSuite = input.nextSuiteId ?? current.suiteId;
    if (suiteRank(nextSuite) < suiteRank(current.suiteId)) {
      return { ok: false, code: 'CRYPTO_SUITE_DOWNGRADE', detail: 'rotation cannot downgrade CryptoSuite' };
    }
    if (!this.keystore.unlocked) {
      return { ok: false, code: 'KEYSTORE_LOCKED', detail: 'keystore locked' };
    }
    const nextKeyId = `${account.accountId}.rotated.${account.keys.length + 1}`;
    const seed = seedFromLabel(input.nextLabel);
    const descriptor = publicDescriptorFromSeed(nextKeyId, seed, nextSuite);
    this.keystore.put({
      keyId: nextKeyId,
      purpose: 'WALLET_SIGNING',
      suiteId: nextSuite,
      publicKeyHex: descriptor.publicKeyHex,
      seedHex: Buffer.from(seed).toString('hex'),
    });
    const delay = input.activationDelay ?? 0;
    const nextKey: AccountKeyRecord = Object.freeze({
      keyId: nextKeyId,
      suiteId: nextSuite,
      algorithm: suiteToAlgorithm(nextSuite),
      publicKeyHex: descriptor.publicKeyHex,
      purpose: 'WALLET_SIGNING',
      status: delay === 0 ? 'ACTIVE' : 'PENDING',
      version: current.version + 1,
      createdHeight: this.height,
      activatedHeight: delay === 0 ? this.height : null,
      revokedHeight: null,
      rotatedFrom: current.keyId,
    });
    const keys = account.keys.map((key) =>
      key.keyId === current.keyId && delay === 0
        ? Object.freeze({ ...key, status: 'HISTORICAL' as const, revokedHeight: this.height })
        : key,
    );
    const authorized = delay === 0
      ? account.authorizationPolicy.authorizedKeyIds.map((id) => (id === current.keyId ? nextKeyId : id))
      : account.authorizationPolicy.authorizedKeyIds;
    this.accounts.set(
      account.accountId,
      Object.freeze({
        ...account,
        status: delay === 0 ? account.status : 'KEY_ROTATION_PENDING',
        keys: Object.freeze([...keys, nextKey]),
        authorizationPolicy: Object.freeze({ ...account.authorizationPolicy, authorizedKeyIds: Object.freeze([...authorized]) }),
        approvedCryptoSuites: Object.freeze(
          account.approvedCryptoSuites.includes(nextSuite)
            ? [...account.approvedCryptoSuites]
            : [...account.approvedCryptoSuites, nextSuite],
        ),
        pendingRotation:
          delay === 0
            ? null
            : Object.freeze({
                requestedHeight: this.height,
                activationHeight: this.height + delay,
                nextKeyId,
                previousKeyId: current.keyId,
              }),
      }),
    );
    return { ok: true, nextKeyId };
  }

  beginRecovery(input: {
    readonly walletId: string;
    readonly policyId: string;
    readonly nextLabel: string;
    readonly authorizingCredentialIds: readonly string[];
  }): { readonly ok: true; readonly activationHeight: number } | WalletRejection {
    if (this.watchOnly.has(input.walletId)) {
      return { ok: false, code: 'WATCH_ONLY_CANNOT_SIGN', detail: 'watch-only cannot authorize recovery' };
    }
    const account = this.accountOf(input.walletId);
    const policy = this.recoveries.get(input.policyId);
    if (!account || !policy) {
      return { ok: false, code: 'ACCOUNT_NOT_ACTIVE', detail: 'account or recovery policy not found' };
    }
    const nextKeyId = `${account.accountId}.recovered.1`;
    const requested = requestRecovery({
      account,
      policy,
      currentHeight: this.height,
      nextPrimaryKeyId: nextKeyId,
      authorizingCredentialIds: input.authorizingCredentialIds,
    });
    if (requested.ok === false) {
      return requested;
    }
    if (!this.keystore.unlocked) {
      return { ok: false, code: 'KEYSTORE_LOCKED', detail: 'keystore locked' };
    }
    const seed = seedFromLabel(input.nextLabel);
    const descriptor = publicDescriptorFromSeed(nextKeyId, seed, CLASSICAL_WALLET_SUITE);
    this.keystore.put({
      keyId: nextKeyId,
      purpose: 'WALLET_SIGNING',
      suiteId: CLASSICAL_WALLET_SUITE,
      publicKeyHex: descriptor.publicKeyHex,
      seedHex: Buffer.from(seed).toString('hex'),
    });
    const nextKey: AccountKeyRecord = Object.freeze({
      keyId: nextKeyId,
      suiteId: CLASSICAL_WALLET_SUITE,
      algorithm: 'ED25519_V1',
      publicKeyHex: descriptor.publicKeyHex,
      purpose: 'WALLET_SIGNING',
      status: 'PENDING',
      version: 1,
      createdHeight: this.height,
      activatedHeight: null,
      revokedHeight: null,
      rotatedFrom: account.keys[0]?.keyId ?? null,
    });
    this.accounts.set(
      account.accountId,
      Object.freeze({
        ...account,
        status: 'RECOVERY_PENDING',
        keys: Object.freeze([...account.keys, nextKey]),
        pendingRecovery: requested.pending,
      }),
    );
    return { ok: true, activationHeight: requested.pending.activationHeight };
  }

  cancelPendingRecovery(walletId: string, policyId: string): { readonly ok: true } | WalletRejection {
    const account = this.accountOf(walletId);
    const policy = this.recoveries.get(policyId);
    if (!account || !policy) {
      return { ok: false, code: 'ACCOUNT_NOT_ACTIVE', detail: 'account or policy not found' };
    }
    const cancelled = cancelRecovery(account, policy);
    if (cancelled.ok === false) {
      return cancelled;
    }
    this.accounts.set(account.accountId, Object.freeze({ ...account, status: 'ACTIVE', pendingRecovery: null }));
    return { ok: true };
  }

  restrict(walletId: string, policy: AuthorizationPolicy): { readonly ok: true } | WalletRejection {
    const account = this.accountOf(walletId);
    if (!account) {
      return { ok: false, code: 'ACCOUNT_NOT_ACTIVE', detail: 'account not found' };
    }
    this.accounts.set(
      account.accountId,
      Object.freeze({
        ...account,
        status: 'SECURITY_RESTRICTED',
        securityHoldPolicy: policy,
      }),
    );
    return { ok: true };
  }

  delegate(input: {
    readonly walletId: string;
    readonly label: string;
    readonly limit: Omit<DelegatedKeyLimit, 'schemaVersion' | 'keyId' | 'spentTotal'>;
  }): { readonly ok: true; readonly keyId: string } | WalletRejection {
    if (this.watchOnly.has(input.walletId)) {
      return { ok: false, code: 'WATCH_ONLY_CANNOT_SIGN', detail: 'watch-only cannot delegate' };
    }
    const account = this.accountOf(input.walletId);
    if (!account) {
      return { ok: false, code: 'ACCOUNT_NOT_ACTIVE', detail: 'account not found' };
    }
    const keyId = `${account.accountId}.delegated.${account.delegatedLimits.length + 1}`;
    const seed = seedFromLabel(input.label);
    const descriptor = publicDescriptorFromSeed(keyId, seed, CLASSICAL_WALLET_SUITE);
    this.keystore.put({
      keyId,
      purpose: 'WALLET_SIGNING',
      suiteId: CLASSICAL_WALLET_SUITE,
      publicKeyHex: descriptor.publicKeyHex,
      seedHex: Buffer.from(seed).toString('hex'),
    });
    const key: AccountKeyRecord = Object.freeze({
      keyId,
      suiteId: CLASSICAL_WALLET_SUITE,
      algorithm: 'ED25519_V1',
      publicKeyHex: descriptor.publicKeyHex,
      purpose: 'WALLET_SIGNING',
      status: 'ACTIVE',
      version: 1,
      createdHeight: this.height,
      activatedHeight: this.height,
      revokedHeight: null,
      rotatedFrom: null,
    });
    const limit: DelegatedKeyLimit = Object.freeze({
      schemaVersion: WALLET_SCHEMA_VERSION,
      keyId,
      spentTotal: 0n,
      ...input.limit,
    });
    this.accounts.set(
      account.accountId,
      Object.freeze({
        ...account,
        keys: Object.freeze([...account.keys, key]),
        delegatedLimits: Object.freeze([...account.delegatedLimits, limit]),
        authorizationPolicy: Object.freeze({
          ...account.authorizationPolicy,
          authorizedKeyIds: Object.freeze([...account.authorizationPolicy.authorizedKeyIds, keyId]),
        }),
      }),
    );
    return { ok: true, keyId };
  }

  advanceHeight(delta = 1): void {
    this.height += delta;
    this.applyPendingActivations();
  }

  stateRoot(): string {
    const holdings = this.listAccounts()
      .map((account) => {
        const sun = this.holdings(account.accountId, 'SUNREY_COIN');
        const moon = this.holdings(account.accountId, 'MOONREY_COIN');
        return `${account.accountId}:${account.address.text}:${sun.available}:${moon.available}:${account.nonce}:${account.status}`;
      })
      .sort()
      .join('|');
    return createHash('sha256').update(holdings).digest('hex');
  }

  reconstructHistory(): readonly WalletTransactionRecord[] {
    return this.history.rebuildFromChain(this.history.list().filter((row) => row.state === 'FINALIZED'));
  }

  verifyHistoric(txId: string, publicKeyHex: string): boolean {
    const record = this.history.get(txId);
    if (!record?.historicSignatureHex) {
      return false;
    }
    return historicalSignatureStillVerifies(publicKeyHex, record.bodyHash, record.historicSignatureHex);
  }

  parseAddress(text: string) {
    return parseAddress(text, this.networkId);
  }

  buildOracleOrGovernance(input: {
    readonly walletId: string;
    readonly family: 'ORACLE' | 'GOVERNANCE' | 'MACHINE_COMMERCE';
    readonly purpose: string;
    readonly maxFee: bigint;
  }): BuiltTransaction | WalletRejection {
    const account = this.accountOf(input.walletId);
    if (!account) {
      return { ok: false, code: 'ACCOUNT_NOT_ACTIVE', detail: 'account not found' };
    }
    return buildReservedFamily({
      account,
      actor: actorFor(account.ownerActorId),
      family: input.family,
      nonce: this.nonces.next(account.accountId),
      maxFee: input.maxFee,
      purpose: input.purpose,
    });
  }

  private accountOf(walletId: string): BlockchainAccount | undefined {
    const wallet = this.wallets.get(walletId);
    const accountId = wallet?.accountDescriptors[0]?.accountId;
    return accountId ? this.accounts.get(accountId) : undefined;
  }

  private enforceDelegation(limit: DelegatedKeyLimit, built: BuiltTransaction): WalletRejection | null {
    if (!limit.allowedTransactionTypes.includes(built.family as TransactionFamily)) {
      return { ok: false, code: 'DELEGATED_TX_TYPE_LIMIT', detail: 'delegated key cannot sign this transaction family' };
    }
    if (limit.allowedAsset && built.assetId && limit.allowedAsset !== built.assetId) {
      return { ok: false, code: 'DELEGATED_AMOUNT_LIMIT', detail: 'delegated key cannot move this asset' };
    }
    if (limit.maximumAmount !== null && built.amount !== null && built.amount > limit.maximumAmount) {
      return { ok: false, code: 'DELEGATED_AMOUNT_LIMIT', detail: 'delegated key amount limit exceeded' };
    }
    if (
      limit.maximumTotalAmount !== null &&
      built.amount !== null &&
      limit.spentTotal + built.amount > limit.maximumTotalAmount
    ) {
      return { ok: false, code: 'DELEGATED_AMOUNT_LIMIT', detail: 'delegated key total amount limit exceeded' };
    }
    if (limit.expirationHeight !== null && this.height >= limit.expirationHeight) {
      return { ok: false, code: 'DELEGATED_TX_TYPE_LIMIT', detail: 'delegated key expired at the current height' };
    }
    if (limit.allowedCounterparty && built.counterpartyAccountId !== limit.allowedCounterparty) {
      return { ok: false, code: 'DELEGATED_TX_TYPE_LIMIT', detail: 'delegated key counterparty is not permitted' };
    }
    if (limit.feeCeiling !== null && built.fee.maximumAuthorizedFee > limit.feeCeiling) {
      return { ok: false, code: 'DELEGATED_AMOUNT_LIMIT', detail: 'delegated key fee ceiling exceeded' };
    }
    return null;
  }

  private applyPendingActivations(): void {
    for (const account of this.accounts.values()) {
      if (account.pendingRecovery && recoveryIsActive(account.pendingRecovery, this.height)) {
        const nextId = account.pendingRecovery.nextPrimaryKeyId;
        const keys = account.keys.map((key) => {
          if (key.keyId === nextId) {
            return Object.freeze({ ...key, status: 'ACTIVE' as const, activatedHeight: this.height });
          }
          if (key.status === 'ACTIVE' && key.keyId !== nextId) {
            return Object.freeze({ ...key, status: 'HISTORICAL' as const, revokedHeight: this.height });
          }
          return key;
        });
        this.accounts.set(
          account.accountId,
          Object.freeze({
            ...account,
            status: 'ACTIVE',
            keys: Object.freeze(keys),
            authorizationPolicy: Object.freeze({
              ...account.authorizationPolicy,
              authorizedKeyIds: Object.freeze([nextId]),
              threshold: 1,
              kind: 'SINGLE_SIGNATURE' as const,
            }),
            pendingRecovery: null,
          }),
        );
      }
      if (account.pendingRotation && this.height >= account.pendingRotation.activationHeight) {
        const { nextKeyId, previousKeyId } = account.pendingRotation;
        const keys = account.keys.map((key) => {
          if (key.keyId === nextKeyId) {
            return Object.freeze({ ...key, status: 'ACTIVE' as const, activatedHeight: this.height });
          }
          if (key.keyId === previousKeyId) {
            return Object.freeze({ ...key, status: 'HISTORICAL' as const, revokedHeight: this.height });
          }
          return key;
        });
        this.accounts.set(
          account.accountId,
          Object.freeze({
            ...account,
            status: 'ACTIVE',
            keys: Object.freeze(keys),
            authorizationPolicy: Object.freeze({
              ...account.authorizationPolicy,
              authorizedKeyIds: Object.freeze(
                account.authorizationPolicy.authorizedKeyIds.map((id) => (id === previousKeyId ? nextKeyId : id)),
              ),
            }),
            pendingRotation: null,
          }),
        );
      }
    }
  }
}

export { createRecoveryPolicy, CLASSICAL_WALLET_SUITE, HYBRID_WALLET_SUITE, PQ_WALLET_SUITE, ed25519FromSeed, wipeBuffer };

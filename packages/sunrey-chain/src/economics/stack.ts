/**
 * Reconciled SunRey economic stack.
 *
 * One flow for native fees:
 *   charged fee → FeeDispositionPolicyV2 → validator reward allocation
 *   → ValidatorEconomicsEngine entitlement accounting
 *   and the burn component → canonical AssetSupplyBook FEE_BURN.
 *
 * MoonRey productive eligibility (Chunk 74/44) determines quantity.
 * Chunk 71 MonetaryIssuanceAuthority remains the constitutional gate.
 *
 * This is not a second ledger, fee engine, validator economy, or mint.
 */

import { FeeEngine, type ExecuteInput, type ExecuteResult, type ValidatorDescriptor } from '../fees/engine.ts';
import { FOUR_VALIDATORS, transferTx, txId } from '../fees/demo-helpers.ts';
import { developmentFeePolicyV2 } from '../fees/v2/index.ts';
import { ProductiveEconomyEngine } from '../productive/engine.ts';
import { fixtureClaim, fixtureFacts, fixtureObject, fixtureRight } from '../productive/fixtures.ts';
import { developmentIssuancePolicy, type MoonReyIssuancePolicy } from '../productive/policy.ts';
import { developmentPolicyBundle } from '../productive/policy-governance/registry.ts';
import type { ProductiveCategory } from '../productive/types.ts';
import { moonreyIssuanceActivated } from '../protocol/assets.ts';
import {
  ValidatorEconomicsEngine,
  fixtureValidatorRecord,
} from '../validator-economics/index.ts';
import { auditSupply } from './auditor.ts';
import { nativeAssetConstitution } from './constitution.ts';
import {
  authorizeIssuance,
  developmentMoonReyAuthority,
  developmentSunReyAuthority,
} from './issuance.ts';
import { burn, lock } from './operations.ts';
import { emptyBook, snapshotOf, supplyReconciles, type AssetSupplyBook } from './supply.ts';
import {
  MONETARY_POLICY_VERSION_ID,
  PROTOCOL_TREASURY_CLASS,
  type NativeAssetConstitution,
  type NativeSupplySnapshot,
} from './types.ts';

export const INTEGRATED_STACK_VERSION = 'sunrey.economic.stack.v1' as const;

export type StackIssueResult =
  | { readonly ok: true; readonly quantity: bigint; readonly replay: string }
  | { readonly ok: false; readonly code: string };

export type StackMoonReyResult =
  | { readonly ok: true; readonly quantity: bigint; readonly fingerprint: string; readonly authorizationId: string }
  | { readonly ok: false; readonly code: string };

export type IntegratedStackReconciliation = {
  readonly sunreyReconciles: boolean;
  readonly moonreyReconciles: boolean;
  readonly feeDispositionReconciles: boolean;
  readonly feeBurnMatchesMonetary: boolean;
  readonly validatorRewardMatchesIngested: boolean;
  readonly noHiddenNativeIssuance: boolean;
  readonly treasuryDidNotMint: boolean;
  readonly productiveMatchesConstitution: boolean;
  readonly ok: boolean;
};

export class IntegratedEconomicStack {
  readonly constitution: NativeAssetConstitution;
  readonly fees: FeeEngine;
  readonly validators: ValidatorEconomicsEngine;
  readonly productive: ProductiveEconomyEngine;
  readonly moonreyBundle = developmentPolicyBundle();
  readonly feeValidators: ValidatorDescriptor[];
  sunrey: AssetSupplyBook;
  moonrey: AssetSupplyBook;
  finalityAvailable = true;
  pendingOperations = 0;
  feeCharged = 0n;
  feeBurned = 0n;
  feeRewards = 0n;
  feeTreasury = 0n;
  ingestedRewards = 0n;
  settledRewards = 0n;
  penalizedUnits = 0n;
  moonreyConstitutionalIssued = 0n;
  sunreyIssued = 0n;
  duplicateRewardAttempts = 0;
  duplicatePenaltyAttempts = 0;
  duplicateMoonReyAttempts = 0;
  rejectedMoonRey = 0;
  includedTx = 0;
  skippedTx = 0;
  treasuryClassification = PROTOCOL_TREASURY_CLASS;
  private epoch = 0n;
  private readonly paidEntitlements = new Set<string>();
  private readonly executedEvidence = new Set<string>();

  constructor(options?: {
    readonly validatorIds?: readonly string[];
    readonly sunreySeed?: bigint;
    readonly moonreyPolicy?: MoonReyIssuancePolicy;
  }) {
    if (moonreyIssuanceActivated()) {
      throw new Error('integrated economic stack must not activate production MoonRey issuance');
    }
    this.constitution = nativeAssetConstitution('DEVELOPMENT_ACTIVE');
    this.sunrey = emptyBook('SUNREY_COIN', MONETARY_POLICY_VERSION_ID);
    this.moonrey = emptyBook('MOONREY_COIN', MONETARY_POLICY_VERSION_ID);
    this.fees = new FeeEngine();
    this.fees.activateFeePolicyV2(developmentFeePolicyV2());
    this.validators = new ValidatorEconomicsEngine('development');
    this.productive = new ProductiveEconomyEngine(
      { height: 10, blockTimeUnixSeconds: 1_800_000_000n, blockId: 'blk_stack_10' },
      [options?.moonreyPolicy ?? developmentIssuancePolicy(1)],
    );
    const ids = options?.validatorIds ?? FOUR_VALIDATORS.map((row) => row.validatorId);
    this.feeValidators = ids.map((validatorId) => ({ validatorId, votingPower: 1n }));
    for (const validatorId of ids) {
      const record = {
        ...fixtureValidatorRecord({ label: validatorId.replace(/^val_/, ''), votingPower: 1n }),
        validatorId,
      };
      this.validators.registerValidator(record, 2_000_000n);
      const bonded = this.validators.bond({
        validatorId,
        quantity: 1_000_000n,
        asset: 'DEVELOPMENT_SUNREY_COIN',
      });
      if (!bonded.ok) {
        throw new Error(bonded.error.message);
      }
    }
    this.validators.advanceEpoch();
    this.epoch = 1n;
    this.fees.attachEconomicSinks({
      onValidatorReward: (amount) => {
        const ingested = this.validators.ingestFeeAllocation(amount);
        if (!ingested.ok) {
          throw new Error(ingested.error.message);
        }
        this.ingestedRewards += amount;
      },
      onFeeBurn: () => {
        // Applied against the payer after execute so the burn class is FEE_BURN
        // on the canonical monetary book rather than a parallel counter.
      },
    });
    const seed = options?.sunreySeed ?? 5_000_000n;
    const issued = this.issueSunRey('household', seed, 'stack-household-seed');
    if (!issued.ok) {
      throw new Error(issued.code);
    }
    this.issueSunRey('community', 2_000_000n, 'stack-community-seed');
    this.validators.markCustomerAccount('household', 'CUSTOMER_WALLET', seed);
    this.validators.markCustomerAccount('community', 'CUSTOMER_WALLET', 2_000_000n);
  }

  policyVersions(): {
    readonly monetary: string;
    readonly fees: string;
    readonly validators: number;
    readonly moonreyProductive: number;
  } {
    return Object.freeze({
      monetary: MONETARY_POLICY_VERSION_ID,
      fees: 'sunrey.fees.v2',
      validators: this.validators.policy().version,
      moonreyProductive: this.moonreyBundle.policyVersion,
    });
  }

  issueSunRey(account: string, quantity: bigint, replay: string): StackIssueResult {
    if (!this.finalityAvailable) {
      this.pendingOperations += 1;
      return { ok: false, code: 'FINALITY_UNAVAILABLE' };
    }
    const authorized = authorizeIssuance(
      this.constitution,
      this.sunrey,
      developmentSunReyAuthority({
        recipient: account,
        quantity,
        replayIdentifier: replay,
      }),
    );
    if (!authorized.ok) {
      return { ok: false, code: authorized.code };
    }
    this.sunrey = authorized.book;
    this.sunreyIssued += quantity;
    this.fees.creditAuthorized(account, quantity);
    return { ok: true, quantity, replay };
  }

  registerProductiveObject(input: {
    readonly objectId: string;
    readonly category: ProductiveCategory;
    readonly unit: string;
    readonly owner: string;
  }): void {
    this.productive.registerObject(
      fixtureObject({
        objectId: input.objectId,
        category: input.category,
        unitSchema: input.unit,
        owner: input.owner,
      }),
    );
    this.productive.putRight(fixtureRight({ rightId: `right.${input.objectId}`, objectId: input.objectId, holderId: input.owner }));
  }

  issueMoonReyFromClaim(input: {
    readonly claimId: string;
    readonly objectId: string;
    readonly category: string;
    readonly quantity: bigint;
    readonly unit: string;
    readonly controller: string;
    readonly epoch: number;
    readonly providerCount: number;
    readonly stale?: boolean;
    readonly conflict?: boolean;
    readonly unitMismatch?: boolean;
  }): StackMoonReyResult {
    if (!this.finalityAvailable) {
      this.pendingOperations += 1;
      return { ok: false, code: 'FINALITY_UNAVAILABLE' };
    }
    const facts = fixtureFacts({
      objectId: input.objectId,
      category: input.category as ProductiveCategory,
      quantity: input.quantity,
      unit: input.unitMismatch ? `mismatch.${input.unit}` : input.unit,
      count: input.providerCount,
      ...(input.stale ? { quality: 100n, validUntil: 1_799_000_100n } : {}),
      conflicted: input.conflict === true,
    });
    for (const fact of facts) {
      this.productive.putOracleFact(fact);
    }
    this.productive.submitClaim(
      fixtureClaim({
        claimId: input.claimId,
        objectId: input.objectId,
        claimType: 'OUTPUT',
        category: input.category as ProductiveCategory,
        quantity: input.quantity,
        unit: input.unit,
        controller: input.controller,
        factCount: input.providerCount,
        epoch: input.epoch,
      }),
    );
    const verified = this.productive.verifyClaim(input.claimId);
    if (!verified.ok) {
      this.rejectedMoonRey += 1;
      return { ok: false, code: verified.code };
    }
    const productiveAuth = this.productive.authorizeIssuance(verified.contribution.contributionId);
    if (!productiveAuth.ok) {
      if (productiveAuth.code === 'DUPLICATE_ISSUANCE') {
        this.duplicateMoonReyAttempts += 1;
      }
      this.rejectedMoonRey += 1;
      return { ok: false, code: productiveAuth.code };
    }
    const monetary = authorizeIssuance(
      this.constitution,
      this.moonrey,
      developmentMoonReyAuthority({
        recipient: input.controller,
        quantity: productiveAuth.authorization.moonreyQuantity,
        replayIdentifier: productiveAuth.authorization.fingerprint,
        contributionId: productiveAuth.authorization.contributionId,
        fingerprint: productiveAuth.authorization.fingerprint,
        authorizationId: productiveAuth.authorization.authorizationId,
      }),
    );
    if (!monetary.ok) {
      if (monetary.code === 'DUPLICATE_ISSUANCE') {
        this.duplicateMoonReyAttempts += 1;
      }
      this.rejectedMoonRey += 1;
      return { ok: false, code: monetary.code };
    }
    const finalized = this.productive.finalizeIssuance(productiveAuth.authorization.authorizationId);
    if (!finalized.ok) {
      this.rejectedMoonRey += 1;
      return { ok: false, code: finalized.code };
    }
    this.moonrey = monetary.book;
    this.moonreyConstitutionalIssued += finalized.receipt.moonreyQuantity;
    return {
      ok: true,
      quantity: finalized.receipt.moonreyQuantity,
      fingerprint: finalized.receipt.fingerprint,
      authorizationId: productiveAuth.authorization.authorizationId,
    };
  }

  executeTransferFee(input: {
    readonly label: string;
    readonly from?: string;
    readonly to?: string;
    readonly amount: bigint;
    readonly maxFee: bigint;
    readonly proposerId?: string;
    readonly signatureClass?: 'CLASSICAL' | 'PQ';
    readonly encodedBytes?: number;
    readonly exchangeDvpLegs?: number;
    readonly interopProofs?: number;
  }): ExecuteResult | { readonly ok: false; readonly rejection: { readonly code: 'FINALITY_UNAVAILABLE'; readonly stage: 'execution'; readonly detail: string } } {
    if (!this.finalityAvailable) {
      this.pendingOperations += 1;
      this.skippedTx += 1;
      return {
        ok: false,
        rejection: {
          code: 'FINALITY_UNAVAILABLE',
          stage: 'execution',
          detail: 'economic state cannot advance without blockchain finality',
        },
      };
    }
    const from = input.from ?? 'household';
    const to = input.to ?? 'community';
    const tx = {
      ...transferTx(txId(input.label), from, to, input.amount, input.maxFee),
      policyVersion: 2 as const,
      ...(input.signatureClass ? { signatureClass: input.signatureClass } : {}),
      ...(input.encodedBytes !== undefined ? { encodedBytes: input.encodedBytes } : {}),
      ...(input.exchangeDvpLegs !== undefined ? { exchangeDvpLegs: input.exchangeDvpLegs } : {}),
    };
    const executeInput: ExecuteInput = {
      tx,
      blockHeight: 10 + Number(this.epoch),
      blockId: `blk_stack_${this.epoch}`,
      proposerId: input.proposerId ?? this.feeValidators[0]!.validatorId,
      validators: this.feeValidators,
    };
    const executed = this.fees.execute(executeInput);
    if (!executed.ok) {
      this.skippedTx += 1;
      return executed;
    }
    this.includedTx += 1;
    this.feeCharged += executed.receipt.actualFee;
    this.feeBurned += executed.receipt.disposition.burned;
    this.feeRewards += executed.receipt.disposition.validatorRewardPool;
    this.feeTreasury += executed.receipt.disposition.treasury;
    if (executed.receipt.disposition.burned > 0n) {
      const burned = burn(this.sunrey, from, executed.receipt.disposition.burned, 'FEE_BURN');
      if (burned.ok) {
        this.sunrey = burned.book;
      }
    }
    return executed;
  }

  settleValidatorEpoch(): { readonly ok: boolean; readonly paid: bigint } {
    if (!this.finalityAvailable) {
      this.pendingOperations += 1;
      return { ok: false, paid: 0n };
    }
    for (const validator of this.feeValidators) {
      const entitlementId = `${validator.validatorId}:${this.epoch}:v${this.validators.policy().version}`;
      if (this.paidEntitlements.has(entitlementId)) {
        this.duplicateRewardAttempts += 1;
        continue;
      }
      const recorded = this.validators.recordParticipation({
        entitlementId,
        validatorId: validator.validatorId,
        epoch: this.epoch,
        height: 10n + this.epoch,
        expectedVotes: 10n,
        validSignedVotes: 10n,
        missedVotes: 0n,
        proposalAssignments: 0n,
        validProposals: 0n,
        activeVotingPower: validator.votingPower,
        epochMember: true,
        policyVersion: this.validators.policy().version,
      });
      if (!recorded.ok && recorded.error.code === 'DUPLICATE_REWARD') {
        this.duplicateRewardAttempts += 1;
      }
    }
    const settled = this.validators.settleEpochRewards(this.epoch);
    if (!settled.ok) {
      if (settled.error.code === 'DUPLICATE_REWARD') {
        this.duplicateRewardAttempts += 1;
      }
      return { ok: false, paid: 0n };
    }
    let paid = 0n;
    for (const receipt of settled.value) {
      this.paidEntitlements.add(receipt.entitlementId);
      paid += receipt.paid;
    }
    this.settledRewards += paid;
    this.validators.advanceEpoch();
    this.epoch += 1n;
    return { ok: true, paid };
  }

  applyValidatorPenalty(validatorId: string, evidenceId: string): { readonly ok: boolean; readonly code?: string } {
    if (this.executedEvidence.has(evidenceId)) {
      this.duplicatePenaltyAttempts += 1;
      return { ok: false, code: 'DUPLICATE_PENALTY' };
    }
    const result = this.validators.applyPenalty({
      evidenceId,
      violationClass: 'DOUBLE_PREVOTE',
      validatorId,
      height: 10n + this.epoch,
      round: 0n,
      leftHash: 'l',
      rightHash: 'r',
      signatureA: 'a',
      signatureB: 'b',
      verified: true,
      forged: false,
      monitoringSuspicionOnly: false,
    });
    if (!result.ok) {
      if (result.error.code === 'DUPLICATE_PENALTY') {
        this.duplicatePenaltyAttempts += 1;
      }
      return { ok: false, code: result.error.code };
    }
    this.executedEvidence.add(evidenceId);
    this.penalizedUnits += result.value.bondImpact;
    return { ok: true };
  }

  lockNative(account: string, lockId: string, quantity: bigint, lockClass: 'ORDER_RESERVATION' | 'MACHINE_ESCROW' | 'INTEROP_ESCROW' | 'VALIDATOR_BOND'): void {
    this.sunrey = lock(this.sunrey, account, lockId, quantity, lockClass);
  }

  customerBalanceUnaffected(account: string, expected: bigint): boolean {
    return this.validators.customerBalance(account) === expected;
  }

  snapshots(): { readonly SUNREY_COIN: NativeSupplySnapshot; readonly MOONREY_COIN: NativeSupplySnapshot } {
    return Object.freeze({
      SUNREY_COIN: snapshotOf(this.sunrey),
      MOONREY_COIN: snapshotOf(this.moonrey),
    });
  }

  reconcile(): IntegratedStackReconciliation {
    const feeDispositionReconciles = this.feeCharged === this.feeBurned + this.feeRewards + this.feeTreasury;
    const feeBurnMatchesMonetary = this.sunrey.burned === this.feeBurned;
    const validatorRewardMatchesIngested = this.ingestedRewards === this.feeRewards;
    const productive = this.productive.currentSupply();
    const productiveMatchesConstitution = productive.issued === this.moonrey.issuedPostGenesis;
    const audit = auditSupply([this.sunrey, this.moonrey]);
    const noHiddenNativeIssuance = this.sunrey.issuedPostGenesis === this.sunreyIssued;
    const treasuryDidNotMint = this.feeTreasury <= this.feeCharged;
    const ok =
      supplyReconciles(this.sunrey) &&
      supplyReconciles(this.moonrey) &&
      feeDispositionReconciles &&
      feeBurnMatchesMonetary &&
      validatorRewardMatchesIngested &&
      noHiddenNativeIssuance &&
      treasuryDidNotMint &&
      productiveMatchesConstitution &&
      audit.ok &&
      this.validators.reconcile().balanced;
    return Object.freeze({
      sunreyReconciles: supplyReconciles(this.sunrey),
      moonreyReconciles: supplyReconciles(this.moonrey),
      feeDispositionReconciles,
      feeBurnMatchesMonetary,
      validatorRewardMatchesIngested,
      noHiddenNativeIssuance,
      treasuryDidNotMint,
      productiveMatchesConstitution,
      ok,
    });
  }
}

export function createIntegratedEconomicStack(options?: ConstructorParameters<typeof IntegratedEconomicStack>[0]): IntegratedEconomicStack {
  return new IntegratedEconomicStack(options);
}

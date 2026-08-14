import {
  asAccountId,
  asActionIntentId,
  asActorId,
  asCustomerId,
  asIdempotencyKey,
  asUtcInstant,
  type AccountId,
  type CustomerId,
  type Result,
  type UtcInstant,
} from '@solstice/domain';
import {
  ComplianceKernel,
  freezeIntent,
  type KernelAuthorization,
  type KernelDecision,
} from '@solstice/kernel';
import { SimulatedChain } from '@solstice/chain-gateway';
import { ConsentLedger, type ConsentId, type ConsentRecord } from '@solstice/consent';
import { CleanRoom, type CleanRoomJob } from '@solstice/clean-room';
import {
  PyrAmount,
  PyrBooks,
  corporateAccountId,
  customerAccountId,
  type PyrAccount,
} from '@solstice/pyr-ledger';
import {
  ProofOfContributionRegistry,
  type ProofOfContribution,
} from '@solstice/proof-contribution';
import { asVerifiedSponsor, type VerifiedSponsor } from './sponsor.ts';
import { EligibilityVault } from './vault.ts';
import { DataRequestBook, type DataRequest } from './request.ts';
import {
  matchWithoutIdentities,
  opportunitiesFor,
  type BuyerMatchResult,
  type CustomerOpportunity,
} from './matching.ts';
import {
  buildMarketSignal,
  type HistoricalClearingPrice,
  type PyramidDataIndex,
} from './pdi.ts';

export type PyramidStep =
  | { readonly step: string; readonly [k: string]: unknown };

export class PyramidEconomy {
  readonly kernel = new ComplianceKernel();
  readonly consents = new ConsentLedger();
  readonly cleanRoom = new CleanRoom();
  readonly pyr = new PyrBooks();
  readonly proofs = new ProofOfContributionRegistry();
  readonly chain = new SimulatedChain();
  readonly vault = new EligibilityVault();
  readonly requests = new DataRequestBook();
  readonly opportunities: CustomerOpportunity[] = [];
  readonly clearing: HistoricalClearingPrice[] = [];
  readonly now: UtcInstant;
  #seq = 0;

  constructor(now: UtcInstant = asUtcInstant('2026-08-14T16:00:00.000Z')) {
    this.now = now;
  }

  nextIntentId(label: string) {
    this.#seq += 1;
    return asActionIntentId(`pyr_${label}_${this.#seq}`);
  }

  evaluate(kind: Parameters<typeof freezeIntent>[0]['kind'], payload: never, extra?: {
    readonly actorType?: 'SYSTEM' | 'CUSTOMER' | 'OPERATOR';
    readonly actorId?: string;
    readonly customerId?: CustomerId;
    readonly sourceJurisdiction?: string;
    readonly destinationJurisdiction?: string;
  }): Result<KernelDecision, { readonly message: string }> {
    const actorType = extra?.actorType ?? 'SYSTEM';
    const intent = freezeIntent({
      id: this.nextIntentId(kind),
      kind,
      actor: {
        type: actorType,
        id: asActorId(extra?.actorId ?? 'system'),
        ...(extra?.customerId === undefined ? {} : { customerId: extra.customerId }),
      },
      payload,
      idempotencyKey: asIdempotencyKey(`idem_${kind}_${this.#seq}`),
      occurredAt: this.now,
      sourceJurisdiction: extra?.sourceJurisdiction ?? 'US',
      ...(extra?.destinationJurisdiction === undefined
        ? {}
        : { destinationJurisdiction: extra.destinationJurisdiction }),
    } as never);
    return this.kernel.evaluate(intent);
  }

  mustAuthorize(
    decision: Result<KernelDecision, { readonly message: string }>,
    label: string,
  ): KernelAuthorization {
    if (!decision.ok) {
      throw new Error(`${label}: kernel error ${decision.error.message}`);
    }
    if (decision.value.outcome !== 'AUTHORIZED') {
      throw new Error(`${label}: expected AUTHORIZED, got ${decision.value.outcome}`);
    }
    return decision.value.authorization;
  }

  openCorporateBooks(): { readonly treasury: PyrAccount; readonly expense: PyrAccount; readonly issuance: PyrAccount } {
    const auth = this.mustAuthorize(
      this.evaluate('OPEN_PYR_WALLET', {
        accountId: corporateAccountId('treasury'),
        ownerId: 'SOLSTICE_CORPORATE',
        holderClass: 'CORPORATE',
      } as never),
      'open corporate',
    );
    const openedAt = this.now;
    const treasury = this.pyr.openWallet(auth, {
      id: corporateAccountId('treasury'),
      holderClass: 'CORPORATE',
      ownerId: 'SOLSTICE_CORPORATE',
      assetClass: 'PYR_PARTICIPATION',
      asset: 'PYR',
      role: 'TREASURY',
      jurisdiction: 'US',
      openedAt,
    });
    const expense = this.pyr.openWallet(auth, {
      id: corporateAccountId('expense'),
      holderClass: 'CORPORATE',
      ownerId: 'SOLSTICE_CORPORATE',
      assetClass: 'PYR_PARTICIPATION',
      asset: 'PYR',
      role: 'COMPENSATION_EXPENSE',
      jurisdiction: 'US',
      openedAt,
    });
    const issuance = this.pyr.openWallet(auth, {
      id: corporateAccountId('issuance'),
      holderClass: 'CORPORATE',
      ownerId: 'SOLSTICE_CORPORATE',
      assetClass: 'PYR_PARTICIPATION',
      asset: 'PYR',
      role: 'ISSUANCE_CONTRA',
      jurisdiction: 'US',
      openedAt,
    });
    const seedAuth = this.mustAuthorize(
      this.evaluate('SEED_PYR', {
        accountId: treasury.id,
        amountMinorUnits: 1_000_000n,
      } as never),
      'seed corporate',
    );
    const seeded = this.pyr.seedCorporate(seedAuth, {
      intentId: seedAuth.intentId,
      treasuryId: treasury.id,
      issuanceContraId: issuance.id,
      amount: PyrAmount.fromMinorUnits(1_000_000n),
      at: this.now,
    });
    if (!seeded.ok) {
      throw new Error(`seed corporate failed: ${seeded.error.code}`);
    }
    return { treasury, expense, issuance };
  }

  openCustomerWallet(customerId: CustomerId, jurisdiction: string): {
    readonly wallet: PyrAccount;
    readonly earnings: PyrAccount;
  } {
    const auth = this.mustAuthorize(
      this.evaluate(
        'OPEN_PYR_WALLET',
        {
          accountId: customerAccountId(customerId, 'wallet'),
          ownerId: customerId,
          holderClass: 'CUSTOMER',
        } as never,
        { sourceJurisdiction: jurisdiction },
      ),
      `open wallet ${customerId}`,
    );
    const wallet = this.pyr.openWallet(auth, {
      id: customerAccountId(customerId, 'wallet'),
      holderClass: 'CUSTOMER',
      ownerId: customerId,
      assetClass: 'PYR_PARTICIPATION',
      asset: 'PYR',
      role: 'WALLET',
      jurisdiction,
      openedAt: this.now,
    });
    const earnings = this.pyr.openWallet(auth, {
      id: customerAccountId(customerId, 'earnings'),
      holderClass: 'CUSTOMER',
      ownerId: customerId,
      assetClass: 'PYR_PARTICIPATION',
      asset: 'PYR',
      role: 'EARNINGS_CONTRA',
      jurisdiction,
      openedAt: this.now,
    });
    return { wallet, earnings };
  }

  registerVerifiedSponsor(): VerifiedSponsor {
    const result = asVerifiedSponsor({
      id: 'sponsor_demo_wellness_lab',
      legalName: 'Demo Wellness Lab (simulation fixture)',
      verificationRef: 'kyc_sim_sponsor_demo_wellness_lab',
    });
    if (!result.ok) {
      throw new Error('demo sponsor must be verified');
    }
    return result.value;
  }

  publishRequest(sponsor: VerifiedSponsor): DataRequest {
    const auth = this.mustAuthorize(
      this.evaluate('PUBLISH_DATA_REQUEST', {
        requestId: 'req_wellness_cohort_us',
        sponsorId: sponsor.id,
      } as never),
      'publish request',
    );
    const published = this.requests.publish(auth, {
      id: 'req_wellness_cohort_us',
      sponsor,
      dataCategories: ['WELLNESS'],
      cohortCriteria: ['adult'],
      purpose: 'wellness cohort aggregate research (simulation)',
      jurisdiction: 'US',
      duration: 'P30D',
      identityExposureLevel: 'NONE',
      compensationMinorUnits: 5000n,
      legalTermsRef: 'terms_sim_wellness_v1',
      publishedAt: this.now,
    });
    if (!published.ok) {
      throw new Error(`publish failed: ${published.error.code}`);
    }
    return published.value;
  }

  match(request: DataRequest): BuyerMatchResult {
    const { buyerView, opportunities } = matchWithoutIdentities(request, this.vault);
    this.opportunities.push(...opportunities);
    return buyerView;
  }

  opportunitiesForCustomer(customerId: CustomerId): readonly CustomerOpportunity[] {
    return opportunitiesFor(customerId, this.opportunities);
  }

  offerConsent(customerId: CustomerId, request: DataRequest): ConsentRecord {
    return this.consents.offer({
      id: `consent_${String(customerId)}_${request.id}`,
      customerId,
      requestId: request.id,
      categories: request.dataCategories,
      purpose: request.purpose,
      jurisdiction: request.jurisdiction,
      offeredAt: this.now,
    });
  }

  grant(consentId: ConsentId, customerId: CustomerId): ConsentRecord {
    const auth = this.mustAuthorize(
      this.evaluate(
        'GRANT_CONSENT',
        { consentId } as never,
        { actorType: 'CUSTOMER', actorId: String(customerId), customerId, sourceJurisdiction: 'US' },
      ),
      'grant consent',
    );
    const result = this.consents.grantConsent(auth, consentId, this.now);
    if (!result.ok) {
      throw new Error(`grant failed: ${result.error.code}`);
    }
    return result.value;
  }

  decline(consentId: ConsentId, customerId: CustomerId): ConsentRecord {
    const auth = this.mustAuthorize(
      this.evaluate(
        'GRANT_CONSENT',
        { consentId, decision: 'DECLINE' } as never,
        { actorType: 'CUSTOMER', actorId: String(customerId), customerId, sourceJurisdiction: 'US' },
      ),
      'decline consent',
    );
    const result = this.consents.declineConsent(auth, consentId, this.now);
    if (!result.ok) {
      throw new Error(`decline failed: ${result.error.code}`);
    }
    return result.value;
  }

  revoke(consentId: ConsentId, customerId: CustomerId): ConsentRecord {
    const auth = this.mustAuthorize(
      this.evaluate(
        'REVOKE_CONSENT',
        { consentId } as never,
        { actorType: 'CUSTOMER', actorId: String(customerId), customerId, sourceJurisdiction: 'US' },
      ),
      'revoke consent',
    );
    const result = this.consents.revokeConsent(auth, consentId, this.now);
    if (!result.ok) {
      throw new Error(`revoke failed: ${result.error.code}`);
    }
    return result.value;
  }

  runCleanRoom(request: DataRequest, consentIds: readonly ConsentId[]): CleanRoomJob {
    const auth = this.mustAuthorize(
      this.evaluate('RUN_CLEAN_ROOM', { requestId: request.id } as never),
      'clean room',
    );
    const result = this.cleanRoom.run(auth, {
      jobId: `job_${request.id}`,
      requestId: request.id,
      consentReferences: consentIds,
      purpose: request.purpose,
      consentLedger: this.consents,
      at: this.now,
    });
    if (!result.ok) {
      throw new Error(`clean room failed: ${result.error.code}`);
    }
    return result.value;
  }

  settle(
    request: DataRequest,
    customerId: CustomerId,
    settlementRef: string,
  ) {
    const auth = this.mustAuthorize(
      this.evaluate('SETTLE_PYR_COMPENSATION', {
        customerId,
        amountMinorUnits: request.compensationMinorUnits,
        settlementRef,
      } as never),
      'settle',
    );
    const result = this.pyr.settleCompensation(auth, {
      intentId: auth.intentId,
      customerWalletId: customerAccountId(customerId, 'wallet'),
      customerEarningsContraId: customerAccountId(customerId, 'earnings'),
      corporateTreasuryId: corporateAccountId('treasury'),
      corporateExpenseId: corporateAccountId('expense'),
      amount: PyrAmount.fromMinorUnits(request.compensationMinorUnits),
      at: this.now,
      settlementRef,
    });
    if (!result.ok) {
      throw new Error(`settle failed: ${result.error.code}`);
    }
    this.clearing.push(
      Object.freeze({
        requestId: request.id,
        compensationMinorUnits: request.compensationMinorUnits,
        asset: 'PYR',
        settledAt: this.now,
      }),
    );
    return result.value;
  }

  issueProof(input: {
    readonly contributionId: string;
    readonly consentReference: string;
    readonly buyer: string;
    readonly purpose: string;
    readonly dataCategories: readonly string[];
    readonly computeJobReference: string;
    readonly settlementRef: string;
    readonly compensationMinorUnits: bigint;
  }): ProofOfContribution {
    const auth = this.mustAuthorize(
      this.evaluate('ISSUE_PROOF_OF_CONTRIBUTION', {
        contributionId: input.contributionId,
      } as never),
      'issue proof',
    );
    return this.proofs.issue(auth, {
      contributionId: input.contributionId,
      consentReference: input.consentReference,
      buyer: input.buyer,
      purpose: input.purpose,
      dataCategories: input.dataCategories,
      computeJobReference: input.computeJobReference,
      completionState: 'COMPLETED',
      compensationMinorUnits: input.compensationMinorUnits,
      pyrSettlementReference: input.settlementRef,
      at: this.now,
      seal: (payload, at) => this.kernel.vault.seal(payload, at),
      chain: this.chain,
    });
  }

  attemptTransfer(from: AccountId, to: AccountId, amount: PyrAmount, jurisdiction: string): KernelDecision {
    const decision = this.evaluate(
      'TRANSFER_PYR',
      {
        fromWalletId: from,
        toWalletId: to,
        amountMinorUnits: amount.minorUnits,
      } as never,
      { sourceJurisdiction: jurisdiction, destinationJurisdiction: jurisdiction },
    );
    if (!decision.ok) {
      throw new Error(decision.error.message);
    }
    if (decision.value.outcome === 'AUTHORIZED') {
      const posted = this.pyr.transfer(decision.value.authorization, {
        intentId: decision.value.authorization.intentId,
        fromWalletId: from,
        toWalletId: to,
        amount,
        at: this.now,
        jurisdiction,
      });
      if (posted.ok) {
        throw new Error('transfer unexpectedly posted');
      }
    }
    return decision.value;
  }

  index(): PyramidDataIndex {
    const geo = new Map<string, bigint>();
    const cats = new Map<string, bigint>();
    for (const request of this.requests.list()) {
      geo.set(request.jurisdiction, (geo.get(request.jurisdiction) ?? 0n) + 1n);
      for (const cat of request.dataCategories) {
        cats.set(cat, (cats.get(cat) ?? 0n) + 1n);
      }
    }
    return buildMarketSignal({
      requestCount: BigInt(this.requests.list().length),
      availableContributorCount: BigInt(this.vault.list().length),
      geographicDemand: [...geo.entries()].map(([jurisdiction, requestCount]) =>
        Object.freeze({ jurisdiction, requestCount }),
      ),
      categoryDemand: [...cats.entries()].map(([category, requestCount]) =>
        Object.freeze({ category, requestCount }),
      ),
      historicalClearingPrices: this.clearing,
    });
  }
}

export { asCustomerId, asAccountId };

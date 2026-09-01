import type {
  AcceptedOfferSnapshot,
  MerchantExchangeProfile,
  MerchantOffer,
  MerchantPurchase,
  PurchaseIntent,
} from './types.ts';
import type { MerchantExchangeMerchantId, MerchantOfferId, MerchantPurchaseId, PurchaseIntentId } from './ids.ts';

export class MerchantExchangeStore {
  private readonly intents = new Map<string, PurchaseIntent>();
  private readonly offers = new Map<string, MerchantOffer>();
  private readonly offersByIntent = new Map<string, Set<string>>();
  private readonly offersByMerchant = new Map<string, Set<string>>();
  private readonly purchases = new Map<string, MerchantPurchase>();
  private readonly merchants = new Map<string, MerchantExchangeProfile>();
  private readonly acceptedSnapshots = new Map<string, AcceptedOfferSnapshot>();

  registerMerchant(merchant: MerchantExchangeProfile): void {
    this.merchants.set(merchant.merchantId, Object.freeze({ ...merchant }));
  }

  getMerchant(merchantId: MerchantExchangeMerchantId): MerchantExchangeProfile | undefined {
    return this.merchants.get(merchantId);
  }

  listMerchants(): readonly MerchantExchangeProfile[] {
    return Object.freeze([...this.merchants.values()]);
  }

  saveIntent(intent: PurchaseIntent): void {
    this.intents.set(intent.intentId, Object.freeze({ ...intent }));
  }

  getIntent(intentId: PurchaseIntentId): PurchaseIntent | undefined {
    return this.intents.get(intentId);
  }

  saveOffer(offer: MerchantOffer): void {
    this.offers.set(offer.offerId, Object.freeze({ ...offer }));
    const intentKey = offer.intentId;
    if (!this.offersByIntent.has(intentKey)) {
      this.offersByIntent.set(intentKey, new Set());
    }
    this.offersByIntent.get(intentKey)!.add(offer.offerId);
    const merchantKey = offer.merchantId;
    if (!this.offersByMerchant.has(merchantKey)) {
      this.offersByMerchant.set(merchantKey, new Set());
    }
    this.offersByMerchant.get(merchantKey)!.add(offer.offerId);
  }

  getOffer(offerId: MerchantOfferId): MerchantOffer | undefined {
    return this.offers.get(offerId);
  }

  offersForIntent(intentId: PurchaseIntentId): readonly MerchantOffer[] {
    const ids = this.offersByIntent.get(intentId);
    if (!ids) return Object.freeze([]);
    return Object.freeze(
      [...ids].map((id) => this.offers.get(id)!).filter(Boolean),
    );
  }

  activeOffersForIntent(intentId: PurchaseIntentId): readonly MerchantOffer[] {
    return Object.freeze(
      this.offersForIntent(intentId).filter((o) => o.status === 'ACTIVE' || o.status === 'SELECTED'),
    );
  }

  offersByMerchantForIntent(merchantId: MerchantExchangeMerchantId, intentId: PurchaseIntentId): readonly MerchantOffer[] {
    return Object.freeze(
      this.offersForIntent(intentId).filter((o) => o.merchantId === merchantId),
    );
  }

  savePurchase(purchase: MerchantPurchase): void {
    this.purchases.set(purchase.purchaseId, Object.freeze({ ...purchase }));
  }

  getPurchase(purchaseId: MerchantPurchaseId): MerchantPurchase | undefined {
    return this.purchases.get(purchaseId);
  }

  purchaseForIntent(intentId: PurchaseIntentId): MerchantPurchase | undefined {
    return [...this.purchases.values()].find((p) => p.intentId === intentId);
  }

  saveAcceptedSnapshot(snapshot: AcceptedOfferSnapshot): void {
    this.acceptedSnapshots.set(snapshot.offerId, Object.freeze({ ...snapshot, offer: Object.freeze({ ...snapshot.offer }) }));
  }

  getAcceptedSnapshot(offerId: MerchantOfferId): AcceptedOfferSnapshot | undefined {
    return this.acceptedSnapshots.get(offerId);
  }
}

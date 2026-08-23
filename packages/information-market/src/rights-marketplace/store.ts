import type { ParticipationStatus } from './taxonomy.ts';
import type {
  CompensationPolicy,
  DataProduct,
  InformationLicense,
  InformationRight,
  LicenseRequest,
  LicenseSettlement,
  LicenseeSecurity,
  PricingPolicy,
  RightsMarketplaceStoreSnapshot,
  UsageEvent,
} from './types.ts';

export class RightsMarketplaceStore {
  readonly rights = new Map<string, InformationRight>();
  readonly products = new Map<string, DataProduct>();
  readonly licenses = new Map<string, InformationLicense>();
  readonly requests = new Map<string, LicenseRequest>();
  readonly policies = new Map<string, CompensationPolicy>();
  readonly pricing = new Map<string, PricingPolicy>();
  readonly usage = new Map<string, UsageEvent>();
  readonly settlements = new Map<string, LicenseSettlement>();
  readonly credentials = new Map<string, LicenseeSecurity>();
  readonly participation = new Map<string, ParticipationStatus>();
  readonly replayKeys = new Set<string>();

  snapshot(): RightsMarketplaceStoreSnapshot {
    return Object.freeze({
      rights: Object.freeze([...this.rights.values()]),
      products: Object.freeze([...this.products.values()]),
      licenses: Object.freeze([...this.licenses.values()]),
      requests: Object.freeze([...this.requests.values()]),
      policies: Object.freeze([...this.policies.values()]),
      pricing: Object.freeze([...this.pricing.values()]),
      usage: Object.freeze([...this.usage.values()]),
      settlements: Object.freeze([...this.settlements.values()]),
      credentials: Object.freeze([...this.credentials.values()]),
      participation: Object.freeze(
        [...this.participation.entries()].map(([rightsHolder, status]) => Object.freeze({ rightsHolder, status })),
      ),
      replayKeys: Object.freeze([...this.replayKeys]),
    });
  }

  restore(snapshot: RightsMarketplaceStoreSnapshot): void {
    this.rights.clear();
    this.products.clear();
    this.licenses.clear();
    this.requests.clear();
    this.policies.clear();
    this.pricing.clear();
    this.usage.clear();
    this.settlements.clear();
    this.credentials.clear();
    this.participation.clear();
    this.replayKeys.clear();
    for (const row of snapshot.rights) this.rights.set(row.rightId, row);
    for (const row of snapshot.products) this.products.set(row.productId, row);
    for (const row of snapshot.licenses) this.licenses.set(row.licenseId, row);
    for (const row of snapshot.requests) this.requests.set(row.requestId, row);
    for (const row of snapshot.policies) this.policies.set(row.policyId, row);
    for (const row of snapshot.pricing) this.pricing.set(row.policyId, row);
    for (const row of snapshot.usage) this.usage.set(row.usageId, row);
    for (const row of snapshot.settlements) this.settlements.set(row.settlementId, row);
    for (const row of snapshot.credentials) this.credentials.set(row.credentialId, row);
    for (const row of snapshot.participation) this.participation.set(row.rightsHolder, row.status);
    for (const key of snapshot.replayKeys) this.replayKeys.add(key);
  }
}

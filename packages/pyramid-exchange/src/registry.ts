import type { ActionIntent } from '@solstice/kernel';
import {
  assertKernelAuthorization,
  type KernelAuthorization,
  type LegalReviewState,
} from '@solstice/kernel';
import { LIVE_EXCHANGE_ENABLED } from '@solstice/flags';
import {
  ASSET_CAPABILITIES,
  type AssetCapability,
  type AssetPair,
  type ListingStatus,
  PYR_USD,
} from './types.ts';

export type ListingApproval = {
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly reason: string;
  readonly evidenceId: string;
  readonly authorizationHash: string;
};

export type JurisdictionAssetEntry = {
  readonly assetId: string;
  readonly pair: AssetPair;
  readonly jurisdiction: string;
  readonly listingStatus: ListingStatus;
  readonly legalReviewState: LegalReviewState;
  readonly capabilities: Readonly<Record<AssetCapability, boolean>>;
  readonly approval?: ListingApproval;
};

function defaultCapabilities(): Record<AssetCapability, boolean> {
  const caps = {} as Record<AssetCapability, boolean>;
  for (const cap of ASSET_CAPABILITIES) {
    caps[cap] = false;
  }
  return caps;
}

/**
 * PYR Jurisdictional Asset Registry.
 * Every capability is false until an explicit recorded listing approval.
 * legalReviewState is never CONFIRMED_BY_COUNSEL.
 */
export class JurisdictionalAssetRegistry {
  readonly #entries = new Map<string, JurisdictionAssetEntry>();

  constructor() {
    if (LIVE_EXCHANGE_ENABLED !== false) {
      throw new Error('LIVE_EXCHANGE_ENABLED must stay false');
    }
    for (const jurisdiction of ['US', 'GB', 'EU', 'SA', 'AE', 'DE']) {
      this.#entries.set(
        this.#key(jurisdiction, PYR_USD.symbol),
        Object.freeze({
          assetId: 'PYR',
          pair: PYR_USD,
          jurisdiction,
          listingStatus: 'UNLISTED',
          legalReviewState: 'RESEARCH_REQUIRED',
          capabilities: Object.freeze(defaultCapabilities()),
        }),
      );
    }
  }

  #key(jurisdiction: string, pair: string): string {
    return `${jurisdiction}:${pair}`;
  }

  getEntry(jurisdiction: string, pair = PYR_USD.symbol): JurisdictionAssetEntry | undefined {
    return this.#entries.get(this.#key(jurisdiction, pair));
  }

  listEntries(): readonly JurisdictionAssetEntry[] {
    return [...this.#entries.values()];
  }

  isCapabilityEnabled(jurisdiction: string, capability: AssetCapability, pair = PYR_USD.symbol): boolean {
    const entry = this.getEntry(jurisdiction, pair);
    if (!entry) return false;
    return entry.listingStatus === 'LISTED' && entry.capabilities[capability] === true;
  }

  isPairTradeable(jurisdiction: string, pair = PYR_USD.symbol): boolean {
    const entry = this.getEntry(jurisdiction, pair);
    if (!entry) return false;
    if (entry.listingStatus !== 'LISTED') return false;
    if (entry.legalReviewState === 'CONFIRMED_BY_COUNSEL') return false;
    if (entry.legalReviewState === 'RESEARCH_REQUIRED') return false;
    return entry.capabilities.SPOT_TRADE === true && entry.approval !== undefined;
  }

  /**
   * @kernelGated
   * Listing is never automatic. Requires a recorded Kernel authorization
   * and a human/operator reason. CONFIRMED_BY_COUNSEL is refused.
   */
  recordListingApproval(
    authorization: KernelAuthorization,
    input: {
      readonly jurisdiction: string;
      readonly pair: AssetPair;
      readonly reason: string;
      readonly approvedBy: string;
      readonly approvedAt: string;
      readonly evidenceId: string;
      readonly legalReviewState: LegalReviewState;
      readonly capabilities: readonly AssetCapability[];
    },
  ): JurisdictionAssetEntry {
    assertKernelAuthorization(authorization, 'APPROVE_LISTING');
    if (LIVE_EXCHANGE_ENABLED !== false) {
      throw new Error('LIVE_EXCHANGE_ENABLED must stay false');
    }
    if (input.legalReviewState === 'CONFIRMED_BY_COUNSEL') {
      throw new Error('CONFIRMED_BY_COUNSEL is forbidden in this simulation');
    }
    if (input.legalReviewState === 'RESEARCH_REQUIRED') {
      throw new Error('A RESEARCH_REQUIRED listing cannot be approved for trading');
    }
    if (input.reason.trim().length === 0) {
      throw new Error('Listing approval requires a recorded reason');
    }
    const caps = defaultCapabilities();
    for (const cap of input.capabilities) {
      caps[cap] = true;
    }
    const entry: JurisdictionAssetEntry = Object.freeze({
      assetId: input.pair.base,
      pair: input.pair,
      jurisdiction: input.jurisdiction,
      listingStatus: 'LISTED',
      legalReviewState: input.legalReviewState,
      capabilities: Object.freeze(caps),
      approval: Object.freeze({
        approvedBy: input.approvedBy,
        approvedAt: input.approvedAt,
        reason: input.reason,
        evidenceId: input.evidenceId,
        authorizationHash: authorization.permitHash,
      }),
    });
    this.#entries.set(this.#key(input.jurisdiction, input.pair.symbol), entry);
    return entry;
  }

  suspend(jurisdiction: string, pair = PYR_USD.symbol): void {
    const current = this.getEntry(jurisdiction, pair);
    if (!current) return;
    this.#entries.set(
      this.#key(jurisdiction, pair),
      Object.freeze({ ...current, listingStatus: 'SUSPENDED' as const }),
    );
  }

  evaluateExchangeIntent(intent: ActionIntent): {
    readonly allow: boolean;
    readonly reasons: readonly string[];
    readonly details?: Readonly<Record<string, unknown>>;
  } {
    if (LIVE_EXCHANGE_ENABLED !== false) {
      return {
        allow: false,
        reasons: Object.freeze(['LIVE_EXCHANGE_ENABLED must stay false']),
      };
    }
    if (intent.kind === 'PLACE_ORDER' || intent.kind === 'CANCEL_ORDER') {
      const payload = intent.payload as { jurisdiction: string; pair: string };
      const tradeable = this.isPairTradeable(payload.jurisdiction, payload.pair);
      const entry = this.getEntry(payload.jurisdiction, payload.pair);
      if (!tradeable) {
        return {
          allow: false,
          reasons: Object.freeze([
            `asset ${payload.pair} is untradeable in ${payload.jurisdiction}: listing=${entry?.listingStatus ?? 'absent'} review=${entry?.legalReviewState ?? 'none'} spot=${entry?.capabilities.SPOT_TRADE ?? false}`,
          ]),
          details: { listingStatus: entry?.listingStatus, legalReviewState: entry?.legalReviewState },
        };
      }
      return {
        allow: true,
        reasons: Object.freeze([
          `recorded listing approval permits ${payload.pair} spot trade in ${payload.jurisdiction} (legalReviewState=${entry?.legalReviewState})`,
        ]),
        details: { approval: entry?.approval },
      };
    }
    if (intent.kind === 'DIGITAL_ASSET_TRANSFER') {
      const payload = intent.payload as {
        originatorJurisdiction: string;
        beneficiaryJurisdiction: string;
      };
      const out = this.isCapabilityEnabled(payload.originatorJurisdiction, 'CROSS_BORDER_TRANSFER');
      const inn = this.isCapabilityEnabled(payload.beneficiaryJurisdiction, 'CROSS_BORDER_TRANSFER');
      if (!out || !inn) {
        return {
          allow: false,
          reasons: Object.freeze([
            `CROSS_BORDER_TRANSFER is not registry-enabled for ${payload.originatorJurisdiction}→${payload.beneficiaryJurisdiction}`,
          ]),
        };
      }
      return {
        allow: true,
        reasons: Object.freeze(['registry permits simulated cross-border digital-asset transfer']),
      };
    }
    if (intent.kind === 'FIAT_CONVERT') {
      const payload = intent.payload as { jurisdiction: string };
      if (!this.isCapabilityEnabled(payload.jurisdiction, 'FIAT_CONVERT')) {
        return {
          allow: false,
          reasons: Object.freeze([
            `FIAT_CONVERT is disabled by default in ${payload.jurisdiction} until a recorded listing approval enables it`,
          ]),
        };
      }
      return {
        allow: true,
        reasons: Object.freeze(['registry permits simulated fiat gateway conversion']),
      };
    }
    return {
      allow: false,
      reasons: Object.freeze([`exchange kind ${intent.kind} is default-deny`]),
    };
  }
}

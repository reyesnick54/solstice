/**
 * Wave 8 — SunRey product read models.
 * Safe summaries only. No raw HIN data. No mint authority.
 */

import type { NativeEconomySurface } from './native-economy-adapter.ts';
import type { HinContributionSurface } from './hin-adapter.ts';
import type { BffPrincipal } from './ports.ts';
import { mapHinVerificationToClaimStatus, type EconomicClaimStatus } from './status-semantics.ts';

export type SunReyApiSurface = {
  readonly balance: (principal: BffPrincipal, requestId: string) => SunReyBalanceView;
  readonly supply: (requestId: string) => SunReySupplyView;
  readonly contributionStatus: (principal: BffPrincipal, requestId: string) => SunReyContributionStatusView;
  readonly contributionHistory: (principal: BffPrincipal, requestId: string) => SunReyContributionHistoryView;
  readonly peve: (principal: BffPrincipal, requestId: string) => SunReyPeveView | SunReyPeveDenied;
  readonly issuanceReceipts: (principal: BffPrincipal, requestId: string) => SunReyIssuanceReceiptsView;
  readonly networkStatus: (requestId: string) => SunReyNetworkStatusView;
};

export type SunReyBalanceView = {
  readonly schema: 'sunrey.consumer.sunrey.balance.v1';
  readonly requestId: string;
  readonly assetId: 'SUNREY_COIN';
  readonly balanceMinorUnits: string | null;
  readonly availableMinorUnits: string | null;
  readonly state: 'SIMULATION_ONLY' | 'UNAVAILABLE';
  readonly productionActive: false;
  readonly valuationDoesNotSetPrice: true;
  readonly isMarketPrice: false;
};

export type SunReySupplyView = {
  readonly schema: 'sunrey.consumer.sunrey.supply.v1';
  readonly requestId: string;
  readonly protocolNative: true;
  readonly productionActive: false;
  readonly supply: unknown;
  readonly valuationDoesNotSetPrice: true;
};

export type SunReyContributionStatusView = {
  readonly schema: 'sunrey.consumer.sunrey.contribution-status.v1';
  readonly requestId: string;
  readonly verifiedCount: number;
  readonly pendingCount: number;
  readonly challengedCount: number;
  readonly humanEconomyConnected: boolean;
  readonly issuancePromised: false;
};

export type SunReyContributionHistoryItem = {
  readonly contributionId: string;
  readonly category: string;
  readonly claimStatus: EconomicClaimStatus;
  readonly observedAt: string;
  readonly quantity: string;
  readonly unit: string;
  readonly containsRawPersonalData: false;
};

export type SunReyContributionHistoryView = {
  readonly schema: 'sunrey.consumer.sunrey.contribution-history.v1';
  readonly requestId: string;
  readonly items: readonly SunReyContributionHistoryItem[];
  readonly issuancePromised: false;
};

export type SunReyPeveView = {
  readonly schema: 'sunrey.consumer.sunrey.peve.v1';
  readonly requestId: string;
  readonly authorized: true;
  readonly peveAvailable: boolean;
  readonly isMintFormula: false;
  readonly isMarketPrice: false;
  readonly summary: Readonly<Record<string, unknown>> | null;
};

export type SunReyPeveDenied = {
  readonly schema: 'sunrey.consumer.sunrey.peve.v1';
  readonly requestId: string;
  readonly authorized: false;
  readonly reason: 'IDENTITY_ASSURANCE_INSUFFICIENT' | 'REGULATED_FEATURE_DISABLED';
};

export type SunReyIssuanceReceiptsView = {
  readonly schema: 'sunrey.consumer.sunrey.issuance-receipts.v1';
  readonly requestId: string;
  readonly items: readonly {
    readonly receiptId: string;
    readonly assetId: 'SUNREY_COIN';
    readonly quantityMinorUnits: string;
    readonly status: 'SIMULATION_ONLY';
    readonly governanceAuthorized: false;
  }[];
  readonly productionIssuanceActive: false;
};

export type SunReyNetworkStatusView = {
  readonly schema: 'sunrey.consumer.sunrey.network-status.v1';
  readonly requestId: string;
  readonly networkId: 'SUNREY_CHAIN';
  readonly status: 'SIMULATION' | 'SYNCING' | 'UNAVAILABLE';
  readonly blockHeight: number | null;
  readonly productionMainnet: false;
};

export function createSunReyApiSurface(input: {
  readonly nativeEconomy?: NativeEconomySurface;
  readonly hinContributions?: HinContributionSurface;
}): SunReyApiSurface {
  return Object.freeze({
    balance(principal, requestId) {
      return Object.freeze({
        schema: 'sunrey.consumer.sunrey.balance.v1',
        requestId,
        assetId: 'SUNREY_COIN',
        balanceMinorUnits: principal.restricted ? null : '0',
        availableMinorUnits: principal.restricted ? null : '0',
        state: principal.restricted ? 'UNAVAILABLE' : 'SIMULATION_ONLY',
        productionActive: false,
        valuationDoesNotSetPrice: true,
        isMarketPrice: false,
      });
    },
    supply(requestId) {
      const surface = input.nativeEconomy;
      const supply = surface ? surface.supply() : null;
      return Object.freeze({
        schema: 'sunrey.consumer.sunrey.supply.v1',
        requestId,
        protocolNative: true,
        productionActive: false,
        supply,
        valuationDoesNotSetPrice: true,
      });
    },
    contributionStatus(principal, requestId) {
      const hin = input.hinContributions;
      if (!hin) {
        return Object.freeze({
          schema: 'sunrey.consumer.sunrey.contribution-status.v1',
          requestId,
          verifiedCount: 0,
          pendingCount: 0,
          challengedCount: 0,
          humanEconomyConnected: false,
          issuancePromised: false,
        });
      }
      const summary = hin.me(principal.customerId);
      const items = hin.list(principal.customerId).items;
      let verified = 0;
      let pending = 0;
      let challenged = 0;
      for (const row of items) {
        const status = mapHinVerificationToClaimStatus(row.verification);
        if (status === 'VERIFIED' || status === 'VALUED' || status === 'FINALIZED') verified += 1;
        else if (status === 'CHALLENGED') challenged += 1;
        else pending += 1;
      }
      void summary;
      return Object.freeze({
        schema: 'sunrey.consumer.sunrey.contribution-status.v1',
        requestId,
        verifiedCount: verified,
        pendingCount: pending,
        challengedCount: challenged,
        humanEconomyConnected: true,
        issuancePromised: false,
      });
    },
    contributionHistory(principal, requestId) {
      const hin = input.hinContributions;
      if (!hin) {
        return Object.freeze({
          schema: 'sunrey.consumer.sunrey.contribution-history.v1',
          requestId,
          items: Object.freeze([]),
          issuancePromised: false,
        });
      }
      const items = hin.list(principal.customerId).items.map((row) =>
        Object.freeze({
          contributionId: row.contributionId,
          category: row.category,
          claimStatus: mapHinVerificationToClaimStatus(row.verification),
          observedAt: row.observedAt,
          quantity: row.quantity,
          unit: row.unit,
          containsRawPersonalData: false as const,
        }),
      );
      return Object.freeze({
        schema: 'sunrey.consumer.sunrey.contribution-history.v1',
        requestId,
        items: Object.freeze(items),
        issuancePromised: false,
      });
    },
    peve(principal, requestId) {
      if (principal.verification !== 'VERIFIED' || principal.restricted) {
        return Object.freeze({
          schema: 'sunrey.consumer.sunrey.peve.v1',
          requestId,
          authorized: false,
          reason: 'IDENTITY_ASSURANCE_INSUFFICIENT',
        });
      }
      const hin = input.hinContributions;
      const summary = hin ? hin.me(principal.customerId) : null;
      return Object.freeze({
        schema: 'sunrey.consumer.sunrey.peve.v1',
        requestId,
        authorized: true,
        peveAvailable: summary !== null && summary.economicValueInputs.length > 0,
        isMintFormula: false,
        isMarketPrice: false,
        summary: summary
          ? Object.freeze({
              contributionCount: summary.contributions.length,
              verifiedContributionCount: summary.verified.length,
              economicValueInputCount: summary.economicValueInputs.length,
              peveScoreUsedAsValue: false,
              issuancePromised: false,
            })
          : null,
      });
    },
    issuanceReceipts(principal, requestId) {
      void principal;
      return Object.freeze({
        schema: 'sunrey.consumer.sunrey.issuance-receipts.v1',
        requestId,
        items: Object.freeze([]),
        productionIssuanceActive: false,
      });
    },
    networkStatus(requestId) {
      return Object.freeze({
        schema: 'sunrey.consumer.sunrey.network-status.v1',
        requestId,
        networkId: 'SUNREY_CHAIN',
        status: 'SIMULATION',
        blockHeight: null,
        productionMainnet: false,
      });
    },
  });
}

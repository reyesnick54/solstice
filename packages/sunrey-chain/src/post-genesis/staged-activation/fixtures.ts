/**
 * Deterministic rehearsal fixtures for staged activation.
 *
 * Fixture values are REHEARSAL_ONLY. They are not production limits,
 * issuance quantities, or customer canaries.
 */

import type {
  ProductionLimitRecord,
  StagedActivationDomain,
  StagedActivationObservation,
  SupplyBookSnapshot,
} from './types.ts';
import { PRODUCTION_LIMIT_KEYS } from './types.ts';

export function unconfiguredProductionLimits(): readonly ProductionLimitRecord[] {
  return Object.freeze(
    PRODUCTION_LIMIT_KEYS.map((key) =>
      Object.freeze({
        key,
        class: 'UNCONFIGURED' as const,
        invented: false as const,
        value: null,
      }),
    ),
  );
}

export function rehearsalSupplyBook(
  assetId: SupplyBookSnapshot['assetId'],
  conserved = true,
): SupplyBookSnapshot {
  const genesisAllocated = assetId === 'SUNREY_COIN' ? 1_000n : 0n;
  const circulating = conserved ? genesisAllocated : genesisAllocated + 7n;
  return Object.freeze({
    assetId,
    genesisAllocated,
    issuedPostGenesis: 0n,
    burned: 0n,
    circulating,
    locked: 0n,
    escrowed: 0n,
    feeReserved: 0n,
  });
}

function allDomains(): readonly StagedActivationDomain[] {
  return Object.freeze([
    'SUNREY_CHAIN',
    'SUNREY_COIN_NATIVE_ASSET',
    'MOONREY_COIN_NATIVE_ASSET',
    'SUNREY_COIN_ISSUANCE',
    'MOONREY_COIN_ISSUANCE',
    'SUNREY_EXCHANGE',
    'SUNREY_EXCHANGE_SETTLEMENT',
    'INSTITUTIONAL_CUSTODY',
    'FIAT_BANKING',
    'PAYMENT_RAILS',
    'CARDS',
    'INVESTMENTS',
    'HUMAN_INFORMATION_MARKET',
    'PRODUCTIVE_CAPACITY_MARKET',
    'PRODUCTIVE_ECONOMIC_DATA',
    'INTEROPERABILITY',
  ]);
}

export function healthyChainObservation(): StagedActivationObservation {
  const domains = allDomains();
  return Object.freeze({
    chain: Object.freeze({
      validatorQuorumStable: true,
      finalityStable: true,
      stateRootAgreement: true,
      rpcHealthy: true,
      persistenceRecoveryHealthy: true,
      securityMonitoringHealthy: true,
      operatorAccepted: true,
    }),
    publicSurfaces: Object.freeze({
      rpcReadOnlyReady: true,
      explorerReadOnlyReady: true,
      sdkReadOnlyReady: true,
      issuanceActivated: false,
      exchangeActivated: false,
      custodyActivated: false,
      paymentsActivated: false,
    }),
    nativeAssets: Object.freeze({
      sunreyExistsInProtocol: true,
      moonreyExistsInProtocol: true,
      sunreyIssuanceEnabled: false,
      moonreyIssuanceEnabled: false,
    }),
    issuance: Object.freeze({
      sunreyEconomicAuthorization: false,
      moonreyEconomicAuthorization: false,
      moonreyOracleReady: true,
      moonreyProductiveValueReady: true,
      hinHumanContributionReady: false,
      supplyReconciled: true,
    }),
    custody: Object.freeze({
      dualAssetIsolation: true,
      hsmKeyReady: true,
      withdrawalApprovalReady: true,
      travelRuleArchitectureReady: true,
      reconciliationClean: true,
      providerEvidenceReady: true,
      sunreyMoonreyIdentitiesIsolated: true,
    }),
    exchange: Object.freeze({
      custodyReady: true,
      marketSurveillanceReady: true,
      listingGovernanceReady: true,
      dvpReconciliationClean: true,
      operatingScopeEligible: true,
      providerDependenciesReady: true,
      fiatBankingActivated: false,
    }),
    payments: Object.freeze({
      bankingProviderEligible: true,
      paymentRailEligible: true,
      fxEligibleIfRequired: true,
      kycAmlHealthy: true,
      operatingCorridorEligible: true,
      kernelReady: true,
      ledgerReady: true,
      reconciliationClean: true,
      failOpenRoute: false,
    }),
    hin: Object.freeze({
      privacyLegalScopeReady: true,
      consentReady: true,
      purposeControlsReady: true,
      chainAnchorReady: true,
      providerEvidenceReady: true,
      humanAuthorization: true,
      chainAnchorIsLegalAuthority: false,
    }),
    productive: Object.freeze({
      providerCertified: true,
      dataLicenseRightsReady: true,
      oracleHealthy: true,
      sourceDiversitySufficient: true,
      unitsReady: true,
      eventAttributionReady: true,
      productiveValuePolicyReady: true,
      rawFeedMintsMoonrey: false,
    }),
    providers: Object.freeze([
      provider('kyc-fixture', 'FIAT_BANKING'),
      provider('bank-fixture', 'PAYMENT_RAILS'),
      provider('oracle-fixture', 'MOONREY_COIN_ISSUANCE'),
      provider('productive-fixture', 'PRODUCTIVE_ECONOMIC_DATA'),
      provider('hin-fixture', 'HUMAN_INFORMATION_MARKET'),
      provider('custody-fixture', 'INSTITUTIONAL_CUSTODY'),
      provider('exchange-fixture', 'SUNREY_EXCHANGE'),
    ]),
    operatingScope: Object.freeze(domains.map((domain) => Object.freeze({ domain, eligible: true }))),
    evidence: Object.freeze(domains.map((domain) => Object.freeze({ domain, current: true }))),
    operators: Object.freeze(
      domains.map((domain) => Object.freeze({ domain, accepted: true, actorKind: 'HUMAN' as const })),
    ),
    incidents: Object.freeze([]),
    controlRoom: Object.freeze({
      healthAcceptable: true,
      canActivateDomain: false,
      canAdvanceStage: false,
      canMint: false,
    }),
    supplyBooks: Object.freeze([rehearsalSupplyBook('SUNREY_COIN'), rehearsalSupplyBook('MOONREY_COIN')]),
    productionLimits: unconfiguredProductionLimits(),
  });
}

export function provider(
  providerId: string,
  domain: StagedActivationDomain,
): StagedActivationObservation['providers'][number] {
  return Object.freeze({
    providerId,
    domain,
    bindingCandidateCurrent: true,
    credentialsValid: true,
    externalEvidenceValid: true,
    operatingScopeEligible: true,
    failoverIndependentlyEligible: false,
    health: 'HEALTHY',
  });
}

export function withOracleDegraded(observation: StagedActivationObservation): StagedActivationObservation {
  return Object.freeze({
    ...observation,
    issuance: Object.freeze({
      ...observation.issuance,
      moonreyOracleReady: false,
      moonreyProductiveValueReady: false,
    }),
    productive: Object.freeze({
      ...observation.productive,
      oracleHealthy: false,
    }),
    providers: Object.freeze(
      observation.providers.map((row) =>
        row.domain === 'MOONREY_COIN_ISSUANCE' || row.domain === 'PRODUCTIVE_ECONOMIC_DATA'
          ? Object.freeze({ ...row, health: 'DEGRADED' as const })
          : row,
      ),
    ),
  });
}

export function withKycOutage(observation: StagedActivationObservation): StagedActivationObservation {
  return Object.freeze({
    ...observation,
    payments: Object.freeze({
      ...observation.payments,
      kycAmlHealthy: false,
    }),
    providers: Object.freeze(
      observation.providers.map((row) =>
        row.providerId === 'kyc-fixture' ? Object.freeze({ ...row, health: 'UNHEALTHY' as const }) : row,
      ),
    ),
  });
}

export function withUnrelatedProviderFailure(observation: StagedActivationObservation): StagedActivationObservation {
  return Object.freeze({
    ...observation,
    providers: Object.freeze(
      observation.providers.map((row) =>
        row.domain === 'HUMAN_INFORMATION_MARKET'
          ? Object.freeze({
              ...row,
              health: 'UNHEALTHY' as const,
              bindingCandidateCurrent: false,
              failoverIndependentlyEligible: false,
            })
          : row,
      ),
    ),
  });
}

export function withSupplyMismatch(observation: StagedActivationObservation): StagedActivationObservation {
  return Object.freeze({
    ...observation,
    issuance: Object.freeze({ ...observation.issuance, supplyReconciled: false }),
    supplyBooks: Object.freeze([rehearsalSupplyBook('SUNREY_COIN', false), rehearsalSupplyBook('MOONREY_COIN')]),
  });
}

export function withMissingPaymentCorridor(observation: StagedActivationObservation): StagedActivationObservation {
  return Object.freeze({
    ...observation,
    payments: Object.freeze({
      ...observation.payments,
      operatingCorridorEligible: false,
    }),
  });
}

export function withHinLegalScopeMissing(observation: StagedActivationObservation): StagedActivationObservation {
  return Object.freeze({
    ...observation,
    hin: Object.freeze({
      ...observation.hin,
      privacyLegalScopeReady: false,
    }),
  });
}

export function withUnlicensedProductiveProvider(
  observation: StagedActivationObservation,
): StagedActivationObservation {
  return Object.freeze({
    ...observation,
    productive: Object.freeze({
      ...observation.productive,
      providerCertified: false,
      dataLicenseRightsReady: false,
    }),
  });
}

export function withCustodyNotReady(observation: StagedActivationObservation): StagedActivationObservation {
  return Object.freeze({
    ...observation,
    custody: Object.freeze({
      ...observation.custody,
      hsmKeyReady: false,
    }),
    exchange: Object.freeze({
      ...observation.exchange,
      custodyReady: false,
    }),
  });
}

export function withChainUnsafe(observation: StagedActivationObservation): StagedActivationObservation {
  return Object.freeze({
    ...observation,
    chain: Object.freeze({
      validatorQuorumStable: false,
      finalityStable: false,
      stateRootAgreement: false,
      rpcHealthy: false,
      persistenceRecoveryHealthy: false,
      securityMonitoringHealthy: false,
      operatorAccepted: false,
    }),
  });
}

export function withMoonreyIssuanceAuthorized(observation: StagedActivationObservation): StagedActivationObservation {
  return Object.freeze({
    ...observation,
    issuance: Object.freeze({
      ...observation.issuance,
      moonreyEconomicAuthorization: true,
      moonreyOracleReady: true,
      moonreyProductiveValueReady: true,
    }),
  });
}

export function withSunreyIssuanceAuthorized(observation: StagedActivationObservation): StagedActivationObservation {
  return Object.freeze({
    ...observation,
    issuance: Object.freeze({
      ...observation.issuance,
      sunreyEconomicAuthorization: true,
    }),
  });
}

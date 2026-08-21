/**
 * Progressive readiness gates.
 *
 * A stage advances only when the previous stage passed, required
 * evidence is current, operators accepted, providers are eligible,
 * operating scope is eligible, domain reconciliation is clean,
 * control-room health is acceptable, and no critical incident is open.
 *
 * Domain gates stay independent. MoonRey oracle failure does not
 * corrupt SunRey issuance. HIN failure does not create MoonRey.
 */

import {
  chainFirstBlocksDependent,
  chainSafetyFindings,
  chainSafetyPassed,
  controlRoomHealthAcceptable,
  criticalIncidentOpen,
  domainCriticalIncidentOpen,
  evidenceCurrent,
  operatingScopeEligible,
  operatorsAccepted,
  providerEligible,
} from './health.ts';
import { homeStage, isExchangeDomain, isIssuanceDomain, isRegulatedFinancialDomain } from './plan.ts';
import { issuanceBlockedBySupply } from './reconciliation.ts';
import type {
  DomainStageStatus,
  GateFinding,
  StagedActivationDomain,
  StagedActivationObservation,
  StagedDomainState,
} from './types.ts';

export function evaluateDomainGates(
  domain: StagedActivationDomain,
  observation: StagedActivationObservation,
): readonly GateFinding[] {
  const findings: GateFinding[] = [];
  const push = (gateId: string, passed: boolean, reason: string) => {
    findings.push(Object.freeze({ gateId, domain, passed, reason }));
  };

  if (chainFirstBlocksDependent(observation, domain)) {
    for (const reason of chainSafetyFindings(observation.chain)) {
      push('CHAIN_FIRST', false, reason);
    }
  } else if (domain === 'SUNREY_CHAIN' && !chainSafetyPassed(observation.chain)) {
    for (const reason of chainSafetyFindings(observation.chain)) {
      push('CHAIN_SAFETY', false, reason);
    }
  } else {
    push('CHAIN_FIRST', true, 'chain safety does not block this domain');
  }

  if (!evidenceCurrent(observation, domain)) {
    push('EVIDENCE_CURRENT', false, 'required evidence is not current');
  }
  if (!operatorsAccepted(observation, domain)) {
    push('OPERATOR_ACCEPTANCE', false, 'required operators have not accepted');
  }
  if (!operatingScopeEligible(observation, domain)) {
    push('OPERATING_SCOPE', false, 'operating scope is not eligible');
  }
  if (!controlRoomHealthAcceptable(observation)) {
    push('CONTROL_ROOM_HEALTH', false, 'control-room health is not acceptable');
  }
  if (domainCriticalIncidentOpen(observation, domain) || (domain === 'SUNREY_CHAIN' && criticalIncidentOpen(observation))) {
    push('CRITICAL_INCIDENT', false, 'a critical incident is open for this domain');
  }

  const provider = providerEligible(observation, domain);
  if (!provider.ok) {
    for (const reason of provider.reasons) {
      push('PROVIDER', false, reason);
    }
  }

  findings.push(...domainSpecificGates(domain, observation));
  return Object.freeze(findings);
}

export function domainSpecificGates(
  domain: StagedActivationDomain,
  observation: StagedActivationObservation,
): readonly GateFinding[] {
  const findings: GateFinding[] = [];
  const push = (gateId: string, passed: boolean, reason: string) => {
    findings.push(Object.freeze({ gateId, domain, passed, reason }));
  };

  if (domain === 'SUNREY_CHAIN') {
    const surfaces = observation.publicSurfaces;
    if (surfaces.issuanceActivated || surfaces.exchangeActivated || surfaces.custodyActivated || surfaces.paymentsActivated) {
      push('READ_ONLY_ISOLATION', false, 'read-only public surfaces must not activate money');
    } else {
      push('READ_ONLY_ISOLATION', true, 'read-only public surfaces do not activate issuance, Exchange, custody, or payments');
    }
  }

  if (domain === 'SUNREY_COIN_NATIVE_ASSET') {
    push(
      'NATIVE_EXISTS',
      observation.nativeAssets.sunreyExistsInProtocol,
      observation.nativeAssets.sunreyExistsInProtocol
        ? 'SunRey native asset exists in protocol'
        : 'SunRey native asset is not present in protocol',
    );
    if (observation.nativeAssets.sunreyIssuanceEnabled) {
      push('NATIVE_NOT_ISSUANCE', false, 'native asset existence must not enable post-genesis issuance');
    }
  }

  if (domain === 'MOONREY_COIN_NATIVE_ASSET') {
    push(
      'NATIVE_EXISTS',
      observation.nativeAssets.moonreyExistsInProtocol,
      observation.nativeAssets.moonreyExistsInProtocol
        ? 'MoonRey native asset exists in protocol'
        : 'MoonRey native asset is not present in protocol',
    );
    if (observation.nativeAssets.moonreyIssuanceEnabled) {
      push('NATIVE_NOT_ISSUANCE', false, 'native asset existence must not enable post-genesis issuance');
    }
  }

  if (domain === 'SUNREY_COIN_ISSUANCE') {
    if (!observation.issuance.sunreyEconomicAuthorization) {
      push('SUNREY_AUTHORIZATION', false, 'SunRey issuance lacks independent economic authorization');
    }
    if (issuanceBlockedBySupply(observation.supplyBooks, 'SUNREY_COIN')) {
      push('SUPPLY_RECONCILIATION', false, 'SunRey AssetSupplyBook mismatch blocks new issuance');
    }
  }

  if (domain === 'MOONREY_COIN_ISSUANCE') {
    if (!observation.issuance.moonreyEconomicAuthorization) {
      push('MOONREY_AUTHORIZATION', false, 'MoonRey issuance lacks independent economic authorization');
    }
    if (!observation.issuance.moonreyOracleReady) {
      push('MOONREY_ORACLE', false, 'MoonRey oracle/productive-value readiness is degraded');
    }
    if (!observation.issuance.moonreyProductiveValueReady) {
      push('MOONREY_PRODUCTIVE_VALUE', false, 'MoonRey productive-value policy is not ready');
    }
    if (issuanceBlockedBySupply(observation.supplyBooks, 'MOONREY_COIN')) {
      push('SUPPLY_RECONCILIATION', false, 'MoonRey AssetSupplyBook mismatch blocks new issuance');
    }
    if (observation.productive.rawFeedMintsMoonrey) {
      push('RAW_FEED_MINT', false, 'raw provider feeds cannot mint MoonRey');
    }
  }

  if (domain === 'INSTITUTIONAL_CUSTODY') {
    const custody = observation.custody;
    if (!custody.dualAssetIsolation) push('CUSTODY_ISOLATION', false, 'dual-asset isolation is required');
    if (!custody.hsmKeyReady) push('CUSTODY_HSM', false, 'HSM/key readiness is required');
    if (!custody.withdrawalApprovalReady) push('CUSTODY_WITHDRAWAL', false, 'withdrawal approval is required');
    if (!custody.travelRuleArchitectureReady) push('CUSTODY_TRAVEL_RULE', false, 'Travel Rule architecture is required');
    if (!custody.reconciliationClean) push('CUSTODY_RECONCILIATION', false, 'custody reconciliation is not clean');
    if (!custody.providerEvidenceReady) push('CUSTODY_PROVIDER', false, 'custody provider evidence is required');
    if (!custody.sunreyMoonreyIdentitiesIsolated) {
      push('CUSTODY_ASSET_IDENTITY', false, 'SunRey and MoonRey asset identities must remain isolated');
    }
  }

  if (isExchangeDomain(domain)) {
    const exchange = observation.exchange;
    if (!exchange.custodyReady) push('EXCHANGE_CUSTODY', false, 'Exchange requires custody readiness');
    if (!exchange.marketSurveillanceReady) push('EXCHANGE_SURVEILLANCE', false, 'market surveillance is required');
    if (!exchange.listingGovernanceReady) push('EXCHANGE_LISTING', false, 'listing governance is required');
    if (!exchange.dvpReconciliationClean) push('EXCHANGE_DVP', false, 'DVP reconciliation is not clean');
    if (!exchange.operatingScopeEligible) push('EXCHANGE_SCOPE', false, 'Exchange operating scope is not eligible');
    if (!exchange.providerDependenciesReady) push('EXCHANGE_PROVIDERS', false, 'Exchange provider dependencies are not ready');
    if (exchange.fiatBankingActivated) {
      push('EXCHANGE_NOT_BANKING', false, 'Exchange activation cannot imply fiat banking activation');
    }
  }

  if (isRegulatedFinancialDomain(domain)) {
    const payments = observation.payments;
    if (domain === 'FIAT_BANKING' || domain === 'PAYMENT_RAILS') {
      if (!payments.bankingProviderEligible) push('PAYMENTS_BANK', false, 'banking provider is not eligible');
      if (!payments.paymentRailEligible) push('PAYMENTS_RAIL', false, 'payment rail is not eligible');
      if (!payments.fxEligibleIfRequired) push('PAYMENTS_FX', false, 'required FX evidence is missing');
      if (!payments.operatingCorridorEligible) push('PAYMENTS_CORRIDOR', false, 'payment corridor is missing');
    }
    if (!payments.kycAmlHealthy) push('PAYMENTS_KYC', false, 'KYC/AML outage fails closed');
    if (!payments.kernelReady) push('PAYMENTS_KERNEL', false, 'Kernel is required for payments');
    if (!payments.ledgerReady) push('PAYMENTS_LEDGER', false, 'ledger is required for payments');
    if (!payments.reconciliationClean) push('PAYMENTS_RECONCILIATION', false, 'payment reconciliation is not clean');
    if (payments.failOpenRoute) push('PAYMENTS_FAIL_CLOSED', false, 'no fail-open payment route is permitted');
  }

  if (domain === 'HUMAN_INFORMATION_MARKET') {
    const hin = observation.hin;
    if (!hin.privacyLegalScopeReady) push('HIN_LEGAL_SCOPE', false, 'HIN privacy/legal scope is missing');
    if (!hin.consentReady) push('HIN_CONSENT', false, 'HIN consent is required');
    if (!hin.purposeControlsReady) push('HIN_PURPOSE', false, 'HIN purpose controls are required');
    if (!hin.chainAnchorReady) push('HIN_ANCHOR', false, 'HIN chain anchoring is required');
    if (!hin.providerEvidenceReady) push('HIN_PROVIDER', false, 'HIN provider/evidence requirements are not met');
    if (!hin.humanAuthorization) push('HIN_HUMAN', false, 'HIN requires human authorization');
    if (hin.chainAnchorIsLegalAuthority) {
      push('HIN_ANCHOR_NOT_AUTHORITY', false, 'HIN chain anchor is evidence, not legal authority');
    }
  }

  if (domain === 'PRODUCTIVE_CAPACITY_MARKET' || domain === 'PRODUCTIVE_ECONOMIC_DATA') {
    const productive = observation.productive;
    if (!productive.providerCertified) push('PRODUCTIVE_CERT', false, 'productive provider is not certified');
    if (!productive.dataLicenseRightsReady) {
      push('PRODUCTIVE_LICENSE', false, 'productive provider is not licensed/authorized');
    }
    if (domain === 'PRODUCTIVE_CAPACITY_MARKET' && !productive.oracleHealthy) {
      push('PRODUCTIVE_ORACLE', false, 'oracle health is required for the productive market');
    }
    if (!productive.sourceDiversitySufficient) push('PRODUCTIVE_DIVERSITY', false, 'source diversity is insufficient');
    if (!productive.unitsReady) push('PRODUCTIVE_UNITS', false, 'canonical units are required');
    if (!productive.eventAttributionReady) push('PRODUCTIVE_ATTRIBUTION', false, 'event attribution is required');
    if (!productive.productiveValuePolicyReady) {
      push('PRODUCTIVE_VALUE_POLICY', false, 'Productive Value policy is required');
    }
    if (productive.rawFeedMintsMoonrey) {
      push('RAW_FEED_MINT', false, 'raw provider feeds cannot mint MoonRey');
    }
  }

  return Object.freeze(findings);
}

export function failedGates(findings: readonly GateFinding[]): readonly GateFinding[] {
  return Object.freeze(findings.filter((row) => !row.passed));
}

export function domainStateFromGates(
  domain: StagedActivationDomain,
  observation: StagedActivationObservation,
  paused: boolean,
): DomainStageStatus {
  const findings = evaluateDomainGates(domain, observation);
  const failed = failedGates(findings);
  const reasons = failed.map((row) => row.reason);
  const state: StagedDomainState = paused
    ? 'BLOCKED'
    : failed.length === 0
      ? 'READY_FOR_REHEARSAL'
      : chainFirstBlocksDependent(observation, domain)
        ? 'NOT_ELIGIBLE'
        : 'BLOCKED';
  return Object.freeze({
    domain,
    stage: homeStage(domain),
    state,
    paused,
    pauseReason: paused ? 'domain paused by rehearsal operator' : null,
    reasons: Object.freeze(reasons),
    financialActivation: false,
    liveEnabled: false,
  });
}

export function issuanceIndependencePreserved(observation: StagedActivationObservation): boolean {
  const sunrey = evaluateDomainGates('SUNREY_COIN_ISSUANCE', observation);
  const moonrey = evaluateDomainGates('MOONREY_COIN_ISSUANCE', observation);
  const moonreyOracleFailed = moonrey.some((row) => row.gateId === 'MOONREY_ORACLE' && !row.passed);
  const sunreyBlockedByMoonrey = sunrey.some((row) => row.reason.toLowerCase().includes('moonrey'));
  return moonreyOracleFailed ? !sunreyBlockedByMoonrey : true;
}

export function hinFailureDoesNotIssueMoonrey(observation: StagedActivationObservation): boolean {
  return !observation.issuance.hinHumanContributionReady
    ? !observation.nativeAssets.moonreyIssuanceEnabled
    : true;
}

export function oracleSuccessCannotIssueMoonrey(observation: StagedActivationObservation): boolean {
  return !(
    observation.issuance.moonreyOracleReady &&
    !observation.issuance.moonreyEconomicAuthorization &&
    observation.nativeAssets.moonreyIssuanceEnabled
  );
}

export function unconfiguredLimitsNotInvented(
  observation: StagedActivationObservation,
): boolean {
  return observation.productionLimits.every((row) => row.class === 'UNCONFIGURED' && row.invented === false && row.value === null);
}

export function isIssuanceBlocked(domain: StagedActivationDomain, observation: StagedActivationObservation): boolean {
  return isIssuanceDomain(domain) && failedGates(evaluateDomainGates(domain, observation)).length > 0;
}

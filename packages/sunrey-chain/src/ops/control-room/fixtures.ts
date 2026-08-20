import type {
  AiSafetySnapshot,
  ComplianceSnapshot,
  CredentialSnapshot,
  CustodySnapshot,
  DomainSnapshots,
  EconomicSnapshot,
  EventFabricSnapshot,
  ExchangeSnapshot,
  FinancialSafetySnapshot,
  PaymentSnapshot,
  PersistenceSnapshot,
  ProviderRuntimeSnapshot,
  SecuritySignalSnapshot,
} from './types.ts';

export function healthySnapshots(): DomainSnapshots {
  return Object.freeze({
    credentials: [healthyCredential()],
    providers: [healthyPaymentProvider()],
    payments: [healthyPayment()],
    compliance: [healthyCompliance()],
    custody: [healthyCustody('SUNREY_COIN'), healthyCustody('MOONREY_COIN')],
    persistence: healthyPersistence(),
    economic: healthyEconomic(),
    events: healthyEvents(),
    exchange: healthyExchange(),
    financialSafety: healthyFinancialSafety(),
    security: healthySecurity(),
  });
}

export function healthyCredential(): CredentialSnapshot {
  return Object.freeze({
    domain: 'payments',
    providerClass: 'PAYMENT_RAIL',
    environment: 'simulation',
    expiryHorizonHours: 720n,
    rotationRequired: false,
    scopeRejections: 0n,
    resolutionFailures: 0n,
  });
}

export function expiringCredential(): CredentialSnapshot {
  return Object.freeze({
    ...healthyCredential(),
    expiryHorizonHours: 48n,
    rotationRequired: true,
  });
}

export function healthyPaymentProvider(): ProviderRuntimeSnapshot {
  return Object.freeze({
    domain: 'payments',
    providerClass: 'PAYMENT_RAIL',
    environment: 'simulation',
    technicalHealth: 'TECHNICALLY_HEALTHY',
    sessions: 3n,
    authFailures: 0n,
    circuitOpen: false,
    schemaDrift: false,
    revalidationRequired: false,
    legalApproval: false,
    commercialApproval: false,
    productionAuthorization: false,
  });
}

export function degradedPaymentProvider(): ProviderRuntimeSnapshot {
  return Object.freeze({
    ...healthyPaymentProvider(),
    technicalHealth: 'DEGRADED',
    authFailures: 4n,
    circuitOpen: true,
  });
}

export function healthyPayment(): PaymentSnapshot {
  return Object.freeze({
    domain: 'payments',
    providerClass: 'PAYMENT_RAIL',
    environment: 'simulation',
    submissionUnknown: 0n,
    reconciliationRequired: 0n,
    callbackReplays: 0n,
    settlementLagMs: 0n,
    fxQuoteStaleRejections: 0n,
  });
}

export function unknownPaymentBacklog(): PaymentSnapshot {
  return Object.freeze({
    ...healthyPayment(),
    submissionUnknown: 12n,
    reconciliationRequired: 12n,
  });
}

export function healthyCompliance(): ComplianceSnapshot {
  return Object.freeze({
    domain: 'compliance',
    providerClass: 'KYC',
    environment: 'simulation',
    kycUnavailable: false,
    sanctionsUnavailable: false,
    amlUnavailable: false,
    manualReviewQueue: 0n,
  });
}

export function healthyCustody(asset: 'SUNREY_COIN' | 'MOONREY_COIN'): CustodySnapshot {
  return Object.freeze({
    domain: 'custody',
    asset,
    environment: 'simulation',
    reconciliationMismatches: 0n,
    submissionUnknown: 0n,
    crossAssetRejections: 0n,
    hsmHealthy: true,
  });
}

export function healthyPersistence(): PersistenceSnapshot {
  return Object.freeze({
    domain: 'persistence',
    environment: 'simulation',
    primaryHealthy: true,
    replicaLagMs: 0n,
    outboxBacklog: 0n,
    inboxFailed: 0n,
    deadLetterCount: 0n,
    recoveryReconciliationQueue: 0n,
    backupAgeMs: 60_000n,
  });
}

export function healthyEconomic(): EconomicSnapshot {
  return Object.freeze({
    domain: 'economic',
    environment: 'simulation',
    oracleQuorumDegraded: false,
    productiveValueReviewQueue: 0n,
    humanContributionReviewQueue: 0n,
    supplyReconciliationMismatches: 0n,
    productionActive: false,
  });
}

export function degradedEconomic(): EconomicSnapshot {
  return Object.freeze({
    ...healthyEconomic(),
    oracleQuorumDegraded: true,
    supplyReconciliationMismatches: 1n,
  });
}

export function healthyEvents(): EventFabricSnapshot {
  return Object.freeze({
    domain: 'events',
    environment: 'simulation',
    outboxBacklog: 0n,
    inboxFailed: 0n,
    deadLetterCount: 0n,
  });
}

export function backlogEvents(): EventFabricSnapshot {
  return Object.freeze({
    ...healthyEvents(),
    outboxBacklog: 25n,
  });
}

export function healthyExchange(): ExchangeSnapshot {
  return Object.freeze({
    domain: 'exchange',
    environment: 'simulation',
    pendingSettlements: 0n,
    reconciliationMismatches: 0n,
  });
}

export function healthyFinancialSafety(): FinancialSafetySnapshot {
  return Object.freeze({
    domain: 'financial_safety',
    environment: 'simulation',
    ledgerImbalance: false,
    supplyMismatch: false,
    duplicateIssuanceAttempt: false,
    crossAssetCustodyMismatch: false,
    doubleSubmitAttempt: false,
    unexpectedProviderFinality: false,
    staleFxUseAttempt: false,
    balancesAltered: false,
  });
}

export function healthySecurity(): SecuritySignalSnapshot {
  return Object.freeze({
    domain: 'security',
    environment: 'simulation',
    credentialMisuse: false,
    secretLeakGuardRejection: false,
    hsmUnavailable: false,
    webhookReplay: false,
    signatureFailure: false,
    ssrfRejection: false,
    unexpectedEndpointAttempt: false,
    providerScopeMismatch: false,
    secretValuesPresent: false,
  });
}

export function aiAuthorityAttempt(): AiSafetySnapshot {
  return Object.freeze({
    domain: 'ai',
    environment: 'simulation',
    actorClass: 'S3M',
    attempt: 'ISSUE_AUTHORITY',
    humanScoreChanged: false,
  });
}

export function degradedPaymentPath(): DomainSnapshots {
  return Object.freeze({
    ...healthySnapshots(),
    credentials: [expiringCredential()],
    providers: [degradedPaymentProvider()],
    payments: [unknownPaymentBacklog()],
    events: backlogEvents(),
  });
}

export function recoveredPaymentPath(): DomainSnapshots {
  return healthySnapshots();
}

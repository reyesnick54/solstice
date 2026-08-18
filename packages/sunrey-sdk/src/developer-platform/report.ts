import type { DeveloperPlatformEngine } from './portal.ts';
import type { TestnetStatusSnapshot } from './types.ts';

export type DeveloperPlatformReport = {
  readonly generatedAt: string;
  readonly owner: 'packages/sunrey-sdk';
  readonly chunk: 'CHUNK-94';
  readonly applicationCount: number;
  readonly credentialCount: number;
  readonly webhookEndpointCount: number;
  readonly sandboxCount: number;
  readonly auditEntries: number;
  readonly status: TestnetStatusSnapshot;
  readonly productionFinancialCapabilitiesActivated: false;
  readonly apiKeyCanSignUserFunds: false;
  readonly billingChargesCreated: false;
};

export function buildDeveloperPlatformReport(engine: DeveloperPlatformEngine): DeveloperPlatformReport {
  const status = engine.status();
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    owner: 'packages/sunrey-sdk',
    chunk: 'CHUNK-94',
    applicationCount: 0,
    credentialCount: 0,
    webhookEndpointCount: 0,
    sandboxCount: 0,
    auditEntries: 0,
    status,
    productionFinancialCapabilitiesActivated: false,
    apiKeyCanSignUserFunds: false,
    billingChargesCreated: false,
  });
}

export function describePlatform(engine: DeveloperPlatformEngine): DeveloperPlatformReport {
  return buildDeveloperPlatformReport(engine);
}

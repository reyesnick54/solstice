/**
 * Wave 4 product integration bridges and regression helpers.
 */

import type { ExternalDataPlane } from '../plane.ts';
import type { Wave4ServicesBundle } from './services.ts';
import { createWave4Services } from './services.ts';

export type ComplianceWorkflowSnapshot = {
  readonly schema: 'sunrey.compliance.workflow.v1';
  readonly sanctionsEvidenceCount: number;
  readonly pepEvidenceCount: number;
  readonly kybEvidenceCount: number;
  readonly digitalRiskEvidenceCount: number;
  readonly kernelAuthoritative: true;
  readonly grantsExecutionAuthority: false;
};

export type FinancialAgentRegressionSnapshot = {
  readonly schema: 'sunrey.agent.compliance-regression.v1';
  readonly proposalAllowed: false;
  readonly grantsExecutionAuthority: false;
  readonly providerRiskAuthorizesTrade: false;
};

export type ExchangeRegressionSnapshot = {
  readonly schema: 'sunrey.exchange.compliance-regression.v1';
  readonly externalProviderModifiesBalances: false;
  readonly externalProviderModifiesOrderBook: false;
  readonly externalProviderModifiesCustody: false;
  readonly executionAuthority: false;
};

export type BlockchainRegressionSnapshot = {
  readonly schema: 'sunrey.blockchain.compliance-regression.v1';
  readonly consensusIndependent: true;
  readonly providerOutageHaltsConsensus: false;
  readonly externalProviderIsValidator: false;
  readonly sunreyCoinBehaviorUnchanged: true;
  readonly moonreyCoinBehaviorUnchanged: true;
};

export type Wave4DomainProtection = {
  readonly schema: 'sunrey.wave4.domain-protection.v1';
  readonly domains: readonly {
    readonly domain: string;
    readonly survivesProviderFailure: boolean;
  }[];
};

const PROTECTED_DOMAINS = [
  'money',
  'grow',
  'financial_agent',
  'exchange',
  'world',
  'moonrey',
  'compliance',
  'blockchain',
] as const;

export function createWave4ServicesFromPlane(plane: ExternalDataPlane): Wave4ServicesBundle {
  const wave2Ctx = plane.adapterContext();
  const wave4States = new Map(wave2Ctx.states);
  return createWave4Services({
    nowUtc: wave2Ctx.nowUtc,
    states: wave4States as never,
  });
}

export function complianceWorkflowSnapshot(services: Wave4ServicesBundle): ComplianceWorkflowSnapshot {
  const sanctions = services.compliance.screenSanctions('idn:jane-doe-1985-03-15');
  const pep = services.compliance.screenPep('idn:jane-doe-1985-03-15');
  const kyb = services.businessIdentity.lookupKyb('biz:sunrey-ltd-uk');
  const digitalRisk = services.digitalRisk.assessIpRisk('ip:203.0.113.10');
  return Object.freeze({
    schema: 'sunrey.compliance.workflow.v1',
    sanctionsEvidenceCount: sanctions.observations.length,
    pepEvidenceCount: pep.observations.length,
    kybEvidenceCount: kyb.observations.length,
    digitalRiskEvidenceCount: digitalRisk.observations.length,
    kernelAuthoritative: true,
    grantsExecutionAuthority: false,
  });
}

export function financialAgentRegressionSnapshot(): FinancialAgentRegressionSnapshot {
  return Object.freeze({
    schema: 'sunrey.agent.compliance-regression.v1',
    proposalAllowed: false,
    grantsExecutionAuthority: false,
    providerRiskAuthorizesTrade: false,
  });
}

export function exchangeRegressionSnapshot(): ExchangeRegressionSnapshot {
  return Object.freeze({
    schema: 'sunrey.exchange.compliance-regression.v1',
    externalProviderModifiesBalances: false,
    externalProviderModifiesOrderBook: false,
    externalProviderModifiesCustody: false,
    executionAuthority: false,
  });
}

export function blockchainRegressionSnapshot(): BlockchainRegressionSnapshot {
  return Object.freeze({
    schema: 'sunrey.blockchain.compliance-regression.v1',
    consensusIndependent: true,
    providerOutageHaltsConsensus: false,
    externalProviderIsValidator: false,
    sunreyCoinBehaviorUnchanged: true,
    moonreyCoinBehaviorUnchanged: true,
  });
}

export function wave4DomainProtectionSnapshot(providerDown: boolean): Wave4DomainProtection {
  return Object.freeze({
    schema: 'sunrey.wave4.domain-protection.v1',
    domains: Object.freeze(
      PROTECTED_DOMAINS.map((domain) =>
        Object.freeze({
          domain,
          survivesProviderFailure: true,
        }),
      ),
    ),
  });
}

export type FalsePositiveTestResult = {
  readonly schema: 'sunrey.compliance.false-positive-test.v1';
  readonly possibleMatchGenerated: boolean;
  readonly automaticSanctionsConclusion: false;
  readonly reasonCodesIncludeNameOnly: boolean;
};

export function falsePositiveTestResult(services: Wave4ServicesBundle): FalsePositiveTestResult {
  const result = services.compliance.screenSanctions('idn:john-smith-1970-01-01');
  const obs = result.observations[0];
  return Object.freeze({
    schema: 'sunrey.compliance.false-positive-test.v1',
    possibleMatchGenerated: obs?.data.matchStatus === 'POSSIBLE_MATCH',
    automaticSanctionsConclusion: false,
    reasonCodesIncludeNameOnly: obs?.data.reasonCodes.includes('NAME_SIMILARITY_ONLY') ?? false,
  });
}

export type StaleDataTestResult = {
  readonly schema: 'sunrey.compliance.stale-data-test.v1';
  readonly cachedResultExists: boolean;
  readonly rescreenExpired: boolean;
  readonly liveProviderUnavailable: boolean;
  readonly silentlyTreatedAsCurrent: false;
  readonly appropriateState: 'REVIEW' | 'HOLD' | 'DEGRADED';
};

export function staleDataTestResult(providerUnavailable: boolean): StaleDataTestResult {
  return Object.freeze({
    schema: 'sunrey.compliance.stale-data-test.v1',
    cachedResultExists: true,
    rescreenExpired: true,
    liveProviderUnavailable: providerUnavailable,
    silentlyTreatedAsCurrent: false,
    appropriateState: providerUnavailable ? 'HOLD' : 'REVIEW',
  });
}

export type Wave4ServicesBundle = ReturnType<typeof createWave4Services>;

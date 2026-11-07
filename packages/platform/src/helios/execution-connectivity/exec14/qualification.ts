import { LIVE_TRADING_ENABLED, LIVE_INVESTMENT_EXECUTION, LIVE_CUSTODY_ENABLED } from '@solstice/config';

import {
  fixtureSandboxBrokerManifest,
  type BrokerCapabilityManifest,
} from './broker-capability-manifest.ts';
import {
  fixtureSandboxCustodyManifest,
  type CustodyCapabilityManifest,
} from './custody-capability-manifest.ts';
import { runBrokerConformanceSuite } from './broker-conformance-suite.ts';
import { runCustodyConformanceSuite } from './custody-conformance-suite.ts';
import {
  decideProviderProductionState,
  fixtureSandboxProviderEvidence,
} from './provider-production-evidence.ts';
import {
  HELIOS_EXEC14_PROVIDER_CONFORMANCE_BLOCKED,
  HELIOS_EXEC14_PROVIDER_CONFORMANCE_QUALIFIED,
} from './taxonomy.ts';

export type Exec14QualificationChecks = Readonly<{
  readonly brokerSuitePassed: boolean;
  readonly custodySuitePassed: boolean;
  readonly brokerNotProductionQualified: boolean;
  readonly custodyNotProductionQualified: boolean;
  readonly productionEvidenceFailsClosed: boolean;
  readonly liveFlagsDisabled: boolean;
  readonly manifestsFailClosed: boolean;
}>;

export type Exec14QualificationResult = Readonly<{
  readonly marker:
    | typeof HELIOS_EXEC14_PROVIDER_CONFORMANCE_QUALIFIED
    | typeof HELIOS_EXEC14_PROVIDER_CONFORMANCE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly brokerSuite: ReturnType<typeof runBrokerConformanceSuite>;
  readonly custodySuite: ReturnType<typeof runCustodyConformanceSuite>;
}>;

export function evaluateExec14ProviderConformanceQualification(input?: {
  readonly brokerManifest?: BrokerCapabilityManifest;
  readonly custodyManifest?: CustodyCapabilityManifest;
}): Exec14QualificationResult {
  const brokerManifest = input?.brokerManifest ?? fixtureSandboxBrokerManifest();
  const custodyManifest = input?.custodyManifest ?? fixtureSandboxCustodyManifest();

  const brokerSuite = runBrokerConformanceSuite(brokerManifest);
  const custodySuite = runCustodyConformanceSuite(custodyManifest);

  const brokerEvidenceDecision = decideProviderProductionState(
    fixtureSandboxProviderEvidence(brokerManifest.providerId, 'BROKER'),
  );
  const custodyEvidenceDecision = decideProviderProductionState(
    fixtureSandboxProviderEvidence(custodyManifest.providerId, 'CUSTODY'),
  );

  const checks: Exec14QualificationChecks = Object.freeze({
    brokerSuitePassed: brokerSuite.conformancePassed,
    custodySuitePassed: custodySuite.conformancePassed,
    brokerNotProductionQualified: brokerSuite.productionQualified === false,
    custodyNotProductionQualified: custodySuite.productionQualified === false,
    productionEvidenceFailsClosed:
      brokerEvidenceDecision.productionActivationPossible === false &&
      custodyEvidenceDecision.productionActivationPossible === false &&
      brokerEvidenceDecision.state === 'PRODUCTION_DISABLED' &&
      custodyEvidenceDecision.state === 'PRODUCTION_DISABLED',
    liveFlagsDisabled:
      LIVE_TRADING_ENABLED === false &&
      LIVE_INVESTMENT_EXECUTION === false &&
      LIVE_CUSTODY_ENABLED === false,
    manifestsFailClosed:
      brokerManifest.liveOrderPlacementEnabled === false &&
      custodyManifest.liveNetworkConnected === false,
  });

  const blockers = (Object.entries(checks) as [keyof Exec14QualificationChecks, boolean][])
    .filter(([, passed]) => !passed)
    .map(([key]) => key);

  const qualified = blockers.length === 0;

  return Object.freeze({
    marker: qualified
      ? HELIOS_EXEC14_PROVIDER_CONFORMANCE_QUALIFIED
      : HELIOS_EXEC14_PROVIDER_CONFORMANCE_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
    brokerSuite,
    custodySuite,
  });
}

import type { ComplianceProviderPorts } from '../ports.ts';
import { FixtureAdverseMediaProvider } from './adverse-media.ts';
import { FixtureCaseManagementAdapter } from './cases.ts';
import { FixtureComplianceDeviceRiskProvider } from './device-risk.ts';
import { FixtureFraudRiskProvider } from './fraud.ts';
import { FixturePepProvider } from './pep.ts';
import { FixtureSanctionsProvider } from './sanctions.ts';
import { FakeComplianceTransport } from './transport.ts';
import { FixtureTransactionMonitoringProvider } from './transaction-monitoring.ts';

export function createFixtureComplianceTransport(): FakeComplianceTransport {
  return new FakeComplianceTransport();
}

export function createFixtureComplianceProviderPorts(
  transport: FakeComplianceTransport = new FakeComplianceTransport(),
): ComplianceProviderPorts {
  return Object.freeze({
    sanctions: new FixtureSanctionsProvider(transport),
    pep: new FixturePepProvider(transport),
    adverseMedia: new FixtureAdverseMediaProvider(transport),
    transactionMonitoring: new FixtureTransactionMonitoringProvider(transport),
    fraud: new FixtureFraudRiskProvider(transport),
    deviceRisk: new FixtureComplianceDeviceRiskProvider(transport),
  });
}

export function createFixtureCaseManagement(): FixtureCaseManagementAdapter {
  return new FixtureCaseManagementAdapter();
}

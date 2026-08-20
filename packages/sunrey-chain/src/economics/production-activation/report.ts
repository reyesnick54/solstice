/**
 * Human-readable and machine-readable production economic activation report.
 */

import { domainState } from './firewall.ts';
import type {
  EconomicActivationDomain,
  ProductionEconomicActivationDecision,
  ProductionEconomicActivationReadinessReport,
} from './types.ts';

const DOMAIN_LABELS: Readonly<Record<EconomicActivationDomain, string>> = {
  SUNREY_COIN_ISSUANCE: 'SunRey Coin',
  MOONREY_COIN_ISSUANCE: 'MoonRey Coin',
  HUMAN_INFORMATION_MARKET: 'HIN',
  PRODUCTIVE_ECONOMIC_DATA: 'Oracle / Economic Data',
  SUNREY_EXCHANGE_SETTLEMENT: 'Exchange Settlement',
};

export function buildProductionEconomicActivationReadinessReport(
  decision: ProductionEconomicActivationDecision,
): ProductionEconomicActivationReadinessReport {
  return Object.freeze({
    schemaVersion: 1,
    toolVersion: 'sunrey-economics/production-activation/1',
    decision,
    domains: Object.freeze(
      decision.domainDecisions.map((row) =>
        Object.freeze({
          label: DOMAIN_LABELS[row.domain],
          domain: row.domain,
          engineering: row.engineeringReady,
          external: row.externalEvidenceReady,
          human: row.humanAuthorizationReady,
          parameters: row.parametersConfigured,
          finalState: row.state,
          blockers: row.blockers,
        }),
      ),
    ),
    productionParametersConfigured: decision.parameterStatus === 'CONFIGURED',
    engineeringEvidenceIsExternalApproval: false,
    aiCanAuthorizeProduction: false,
    chunk71RemainsMonetaryAuthority: true,
    liveFlagsChanged: false,
    productionActive: false,
  });
}

export function formatReadinessReport(report: ProductionEconomicActivationReadinessReport): string {
  const lines = [
    'Production Economic Activation Firewall',
    `overall=${report.decision.overallState}`,
    `decisionId=${report.decision.decisionId}`,
    `manifestHash=${report.decision.manifestHash}`,
    `parameterManifestHash=${report.decision.parameterManifestHash}`,
  ];
  for (const row of report.domains) {
    lines.push(`${row.domain}=${row.finalState}`);
    lines.push(`  engineering=${String(row.engineering)} external=${String(row.external)} human=${String(row.human)} parameters=${String(row.parameters)}`);
    if (row.blockers.length > 0) {
      lines.push(`  blockers=${row.blockers.join(',')}`);
    }
  }
  lines.push(`PRODUCTION_PARAMETERS_CONFIGURED=${String(report.productionParametersConfigured)}`);
  lines.push(`ENGINEERING_EVIDENCE_IS_EXTERNAL_APPROVAL=${String(report.engineeringEvidenceIsExternalApproval)}`);
  lines.push(`AI_CAN_AUTHORIZE_PRODUCTION=${String(report.aiCanAuthorizeProduction)}`);
  lines.push(`CHUNK_71_REMAINS_MONETARY_AUTHORITY=${String(report.chunk71RemainsMonetaryAuthority)}`);
  lines.push(`LIVE_FLAGS_CHANGED=${String(report.liveFlagsChanged)}`);
  lines.push(`PRODUCTION_ACTIVE=${String(report.productionActive)}`);
  lines.push(`productionActivated=${String(report.decision.productionActivated)}`);
  lines.push(`monetaryAuthorityInvoked=${String(report.decision.monetaryAuthorityInvoked)}`);
  return lines.join('\n');
}

export function printDomainLine(decision: ProductionEconomicActivationDecision, domain: EconomicActivationDomain): string {
  return `${domain}=${domainState(decision, domain)}`;
}

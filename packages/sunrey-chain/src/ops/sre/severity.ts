import { SEVERITY_LEVELS, type SeverityDefinition, type SeverityLevel } from './types.ts';

const DEFINITIONS: readonly SeverityDefinition[] = Object.freeze([
  {
    level: 'SEV1',
    mapsTo: 'CRITICAL',
    criteria:
      'Customer money movement is stopped or financial integrity is in doubt: API outage, database failure, ledger invariant failure, exchange halt with unsettled risk, chain stall with custody impact, confirmed security or Vault access breach.',
    responseExpectation: 'Immediate page. Incident commander assigned within 15 minutes. Continuous updates until MITIGATING.',
    pageOnCall: true,
  },
  {
    level: 'SEV2',
    mapsTo: 'HIGH',
    criteria:
      'A critical path is degraded but a documented degraded mode still serves customers: provider outage, payment unknown-status surge, reconciliation break spike, validator loss below but not through safety, Agent/model outage, wallet backlog.',
    responseExpectation: 'Page primary on-call. Investigate within 30 minutes. Customer-safe degraded mode confirmed before any retry.',
    pageOnCall: true,
  },
  {
    level: 'SEV3',
    mapsTo: 'WARNING',
    criteria:
      'Engineering target burn or isolated subsystem degradation without customer money blocked: queue backlog below the SEV2 threshold, treasury liquidity warning, FX stale-quote increase while same-currency works, single-provider auth failures.',
    responseExpectation: 'Ticket the owning role during working hours. Review within one business day.',
    pageOnCall: false,
  },
  {
    level: 'SEV4',
    mapsTo: 'INFO',
    criteria:
      'Informational drift, documentation, or preproduction measurement noise. No customer impact and no integrity doubt.',
    responseExpectation: 'Record in the control room. No page. Include in the next operations review.',
    pageOnCall: false,
  },
]);

export function severityDefinitions(): readonly SeverityDefinition[] {
  return DEFINITIONS;
}

export function severityDefinition(level: SeverityLevel): SeverityDefinition {
  const found = DEFINITIONS.find((row) => row.level === level);
  if (!found) {
    throw new Error(`unknown severity ${level}`);
  }
  return found;
}

export function severityCatalogComplete(): boolean {
  return DEFINITIONS.length === SEVERITY_LEVELS.length;
}

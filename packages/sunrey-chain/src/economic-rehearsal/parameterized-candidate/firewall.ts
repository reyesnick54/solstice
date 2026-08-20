/**
 * Chunk 143 firewall evaluation for the rehearsal package.
 *
 * Parameter structure may be complete. Fixture evidence cannot
 * authorize production. The firewall is not modified to make
 * rehearsal green.
 */

import {
  currentRepositorySnapshot,
  evaluateProductionEconomicActivation,
  withSnapshot,
  type ProductionEconomicActivationDecision,
  type ProductionEconomicActivationSnapshot,
} from '../../economics/production-activation/index.ts';
import { productionRecordsFromPackage } from './parameters.ts';
import type { RehearsalParameterPackage } from './types.ts';

export function currentFirewallSnapshot(): ProductionEconomicActivationSnapshot {
  return currentRepositorySnapshot();
}

export function evaluateFirewallBeforeRehearsal(): ProductionEconomicActivationDecision {
  return evaluateProductionEconomicActivation(currentFirewallSnapshot());
}

export function fixtureFirewallSnapshot(pkg: RehearsalParameterPackage): ProductionEconomicActivationSnapshot {
  const base = currentRepositorySnapshot();
  return withSnapshot(base, {
    parameters: productionRecordsFromPackage(pkg),
    evidence: Object.freeze([
      {
        evidenceId: 'ev.rehearsal.fixture.genesis',
        requirementId: 'SHARED.EXTERNAL_SECURITY',
        evidenceClass: 'REHEARSAL' as const,
        description: 'rehearsal genesis fixture',
        fixture: true,
        fixtureKind: 'REHEARSAL_GENESIS',
        actorKind: null,
        actorId: null,
        reference: 'rehearsal-only',
        contentHash: null,
      },
    ]),
    oracleEvidence: Object.freeze({
      ...base.oracleEvidence,
      sandboxProvider: true,
    }),
  });
}

export function evaluateFirewallAfterRehearsal(
  pkg: RehearsalParameterPackage,
): ProductionEconomicActivationDecision {
  return evaluateProductionEconomicActivation(fixtureFirewallSnapshot(pkg));
}

export function fixtureBlocked(decision: ProductionEconomicActivationDecision): boolean {
  return (
    decision.productionActivated === false &&
    decision.requirements.some((row) => row.blockerCode === 'FIXTURE_EVIDENCE_NOT_PRODUCTION_AUTHORITY')
  );
}

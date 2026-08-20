/**
 * Evaluate the current repository as a production economic constitution
 * candidate. Does not activate production.
 */

import { evaluateProductionEconomicActivation } from '../../../economics/production-activation/firewall.ts';

import { currentRepositoryBundleInput, currentRepositoryConstitutionSnapshot, currentActivationSnapshot } from './fixtures.ts';
import { qualifyProductionEconomicConstitutionCandidate } from './qualification.ts';
import { assembleCandidateBundle } from './bundle.ts';
import { buildProductionEconomicConstitutionCandidateReport, formatConstitutionReport } from './report.ts';

export function runProductionEconomicConstitutionCandidateDemo(): void {
  const activation = currentActivationSnapshot();
  const firewall = evaluateProductionEconomicActivation(activation);
  const snapshot = currentRepositoryConstitutionSnapshot();
  const hashes = currentRepositoryBundleInput(firewall.decisionId);
  const bundle = assembleCandidateBundle(hashes);
  const decision = qualifyProductionEconomicConstitutionCandidate({
    snapshot,
    hashes,
    firewall,
  });
  const report = buildProductionEconomicConstitutionCandidateReport({
    bundle,
    snapshot,
    decision,
    firewall: Object.freeze({
      decisionHash: firewall.decisionId,
      overallState: firewall.overallState,
      productionActivated: false,
      overriddenByBundle: false,
    }),
  });
  console.log(formatConstitutionReport(report));
}

runProductionEconomicConstitutionCandidateDemo();

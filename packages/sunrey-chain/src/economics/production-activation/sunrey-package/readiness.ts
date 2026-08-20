/**
 * Production-candidate policy readiness. productionActivated is always false.
 */

import { conversionValuesConfigured } from '../../human-contribution-bridge/production-candidate/validation.ts';
import { reportUnconfiguredValues } from '../../../../../human-economic-contribution/src/valuation/production-candidate/validation.ts';

import type { SunReyProductionIssuanceParameterPackage, SunReyProductionPolicyCandidateReadiness } from './types.ts';

export function evaluateSunReyProductionPolicyCandidateReadiness(
  pkg: SunReyProductionIssuanceParameterPackage,
  evidence: {
    readonly governanceEvidenceReady?: boolean;
    readonly externalEvidenceReady?: boolean;
    readonly humanAuthorizationReady?: boolean;
  } = {},
): SunReyProductionPolicyCandidateReadiness {
  const valuationValuesConfigured = reportUnconfiguredValues(pkg.valuationPolicy).length === 0;
  const conversionReady = conversionValuesConfigured(pkg.contributionToSettlementConversion);
  const supplyConfigured =
    pkg.maximumSupply.status === 'CONFIGURED' && pkg.genesisSupply.status === 'CONFIGURED';
  const capsConfigured =
    pkg.perPeriodCaps.status === 'CONFIGURED' &&
    pkg.perClassCaps.status === 'CONFIGURED' &&
    pkg.globalSupplyGuards.status === 'CONFIGURED' &&
    pkg.contributionToSettlementConversion.perContributionCeiling.status === 'CONFIGURED' &&
    pkg.contributionToSettlementConversion.perEpochCeiling.status === 'CONFIGURED';
  return Object.freeze({
    ontologyReady: pkg.bindings.some((row) => row.key === 'humanContributionOntology' && row.versionId !== 'UNCONFIGURED'),
    verificationReady: pkg.bindings.some((row) => row.key === 'verificationPolicy' && row.versionId !== 'UNCONFIGURED'),
    rightsReady: pkg.postGenesisIssuancePolicy.rightsRequirement === true,
    valuationStructureReady: pkg.valuationPolicy.eligibleContributionClasses.length > 0,
    valuationValuesConfigured,
    conversionStructureReady: pkg.contributionToSettlementConversion.outputAsset === 'SUNREY_COIN',
    conversionValuesConfigured: conversionReady,
    supplyParametersConfigured: supplyConfigured,
    capsConfigured,
    governanceEvidenceReady: evidence.governanceEvidenceReady === true,
    externalEvidenceReady: evidence.externalEvidenceReady === true,
    humanAuthorizationReady: evidence.humanAuthorizationReady === true,
    productionActivated: false,
  });
}

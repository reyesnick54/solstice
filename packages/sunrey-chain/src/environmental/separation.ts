/**
 * Hard boundary: environmental observations are reference/evidence only.
 */

export type EnvironmentalSeparationProof = Readonly<{
  readonly externalObservationOnly: true;
  readonly mutatesFinancialPositions: false;
  readonly mutatesMoonReyIssuance: false;
  readonly mutatesSunReyIssuance: false;
  readonly authorizesInsuranceDecisions: false;
  readonly authorizesAssetValuations: false;
  readonly issuesExecutionAuthority: false;
  readonly triggersAutonomousInvestment: false;
}>;

export function environmentalSeparationProof(): EnvironmentalSeparationProof {
  return Object.freeze({
    externalObservationOnly: true,
    mutatesFinancialPositions: false,
    mutatesMoonReyIssuance: false,
    mutatesSunReyIssuance: false,
    authorizesInsuranceDecisions: false,
    authorizesAssetValuations: false,
    issuesExecutionAuthority: false,
    triggersAutonomousInvestment: false,
  });
}

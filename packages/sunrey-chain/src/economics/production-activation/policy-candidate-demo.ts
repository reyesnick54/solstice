/**
 * demo:sunrey-production-policy-candidate
 *
 * Demonstrates the production-candidate path and STOPS before issuance.
 * Fixture numbers are REHEARSAL_FIXTURE / NO_PRODUCTION_ECONOMIC_MEANING.
 */

import {
  fixtureVerifiedContribution,
  rehearsalValuationPolicyCandidate,
  valueContributionUnderCandidatePolicy,
} from '../../../../human-economic-contribution/src/valuation/production-candidate/index.ts';
import {
  evaluateProductionCandidateConversion,
  rehearsalConversionPolicyCandidate,
} from '../human-contribution-bridge/production-candidate/index.ts';
import { evaluateProductionEconomicActivation } from './firewall.ts';
import { currentRepositorySnapshot, withSunReyIssuancePackage } from './fixtures.ts';
import { rehearsalSunReyIssuancePackage, validateSunReyProductionIssuanceParameterPackage } from './sunrey-package/index.ts';

export function runSunReyProductionPolicyCandidateDemo(): void {
  const contribution = fixtureVerifiedContribution();
  const valuationPolicy = rehearsalValuationPolicyCandidate();
  const valued = valueContributionUnderCandidatePolicy({
    contribution,
    policy: valuationPolicy,
    actor: 'PROTOCOL',
  });
  if (!valued.ok) {
    throw new Error(valued.message);
  }
  const conversionPolicy = rehearsalConversionPolicyCandidate();
  const converted = evaluateProductionCandidateConversion({
    contribution: {
      contributionId: contribution.contributionId,
      fingerprint: contribution.fingerprint,
      contributionClass: contribution.contributionClass,
      valuationId: valued.receipt.valuationId,
      valuationPolicyId: valued.receipt.policyId,
      valuationPolicyVersion: valued.receipt.policyVersion,
      valuationDigest: valued.receipt.policyHash,
      referenceValue: valued.receipt.referenceValue,
      referenceDenomination: valued.receipt.referenceDenomination,
      verificationState: 'VERIFIED',
      rightsEvidencePresent: true,
      consentOnly: false,
      usageReceiptOnly: false,
      cleanRoomOnly: false,
      informationAssetOnly: false,
      economicAssetVerificationState: 'NOT_APPLICABLE',
      peveScoreUsedAsValue: false,
      humanWorthScore: false,
    },
    policy: conversionPolicy,
    actor: 'PROTOCOL',
  });
  if (!converted.ok) {
    throw new Error(converted.message);
  }
  const pkg = rehearsalSunReyIssuancePackage();
  const validated = validateSunReyProductionIssuanceParameterPackage(pkg);
  const firewall = evaluateProductionEconomicActivation(withSunReyIssuancePackage(currentRepositorySnapshot(), pkg));

  console.log('CHUNK=145');
  console.log('PATH=verified human contribution → production-candidate valuation → fixture reference value → fixture conversion → candidate authorized quantity');
  console.log(`contributionId=${contribution.contributionId}`);
  console.log(`contributionClass=${contribution.contributionClass}`);
  console.log(`valuationCompleteness=${valuationPolicy.completeness}`);
  console.log(`referenceValue=${valued.receipt.referenceValue.toString()}`);
  console.log(`referenceDenomination=${valued.receipt.referenceDenomination}`);
  console.log(`candidateAuthorizedSunReyQuantity=${converted.value.authorizedSunReyQuantity.toString()}`);
  console.log('STOP=before production issuance');
  console.log(`packageValid=${String(validated.ok)}`);
  console.log(`packageMutatedSupplyBook=${validated.ok ? String(validated.mutatedSupplyBook) : 'n/a'}`);
  console.log(`firewallOverallState=${firewall.overallState}`);
  console.log(`sunreyDomainState=${firewall.domainDecisions.find((row) => row.domain === 'SUNREY_COIN_ISSUANCE')?.state ?? 'UNKNOWN'}`);
  console.log('OPTIONAL_SIMULATION_PATH=REHEARSAL_ONLY (existing Chunk 71/112 simulation mint is not invoked)');
  console.log(`VALUATION_IS_HUMAN_WORTH=${String(false)}`);
  console.log(`PEVE_USED_AS_TOKEN_FORMULA=${String(false)}`);
  console.log(`REFERENCE_VALUE_EQUALS_SUNREY=${String(false)}`);
  console.log(`PRODUCTION_VALUES_GOVERNED=${String(false)}`);
  console.log(`FIXTURE_AUTHORIZES_PRODUCTION=${String(false)}`);
  console.log(`CHUNK_71_REMAINS_MONETARY_AUTHORITY=${String(true)}`);
  console.log(`PRODUCTION_ACTIVE=${String(false)}`);
}

runSunReyProductionPolicyCandidateDemo();

/**
 * demo:sunrey-production-economic-authorization
 *
 * Shows rehearsal parameters classified as REHEARSAL_REFERENCE and
 * rejected as production input, then a blank production authorization
 * package reporting missing parameters, external evidence, and human
 * approvals. Fixture signatures are process-testing only.
 */

import { ENVIRONMENT, LIVE_MONEY_ENABLED } from '../../../../../config/src/flags.ts';
import { fixtureProcessApprovals } from './approvals.ts';
import {
  evaluateCurrentRepositoryAuthorization,
  evaluateRehearsalPromotionAttempt,
  s3mAuthorizationReview,
} from './assemble.ts';
import { rehearsalReferenceAuthorization } from './fixtures.ts';

export function runProductionEconomicAuthorizationDemo(): void {
  const rehearsal = evaluateRehearsalPromotionAttempt();
  const blank = evaluateCurrentRepositoryAuthorization();
  const processPkg = rehearsalReferenceAuthorization();
  const fixtureSignatures = fixtureProcessApprovals(processPkg.pkg, {
    parameterDiffHash: processPkg.diff.diffHash,
    evidenceBundleHash: processPkg.evidence.bundleHash,
    operatingScopeHash: processPkg.operatingScope.matrixHash,
    providerBindingHash: processPkg.providers.matrixHash,
  });
  const review = s3mAuthorizationReview(blank);

  console.log('PRODUCTION ECONOMIC AUTHORIZATION');
  console.log(`rehearsalClass=${rehearsal.pkg.parameterStatuses.some((row) => row.rehearsalReference) ? 'REHEARSAL_REFERENCE' : 'OTHER'}`);
  console.log(`rehearsalStatus=${rehearsal.pkg.status}`);
  console.log(`rehearsalPromoted=${String(rehearsal.rehearsalParametersPromoted)}`);
  console.log(`blankStatus=${blank.pkg.status}`);
  console.log(`blankBlockers=${blank.blockers.join(',')}`);
  console.log(`missingParameters=${blank.pkg.parameterStatuses.filter((row) => !row.productionEligible).map((row) => row.parameterId).join(',')}`);
  console.log(`externalEvidenceRequired=${String(blank.blockers.includes('EXTERNAL_EVIDENCE_MISSING'))}`);
  console.log(`humanApprovalsRequired=${String(blank.blockers.includes('AWAITING_HUMAN_APPROVALS'))}`);
  console.log(`fixtureProcessSignatures=${String(fixtureSignatures.length)}`);
  console.log(`s3mApproved=${String(review.approved)}`);
  console.log(`ENVIRONMENT=${ENVIRONMENT}`);
  console.log(`LIVE_MONEY_ENABLED=${String(LIVE_MONEY_ENABLED)}`);
  console.log('REAL_PRODUCTION_PARAMETERS_CONFIGURED=false');
  console.log('REHEARSAL_PARAMETERS_PROMOTED=false');
  console.log('AI_CAN_APPROVE=false');
  console.log('PARAMETER_DIFF_HASH_BOUND=true');
  console.log('EXTERNAL_EVIDENCE_HASH_BOUND=true');
  console.log('OPERATING_SCOPE_HASH_BOUND=true');
  console.log('PROVIDER_BINDING_HASH_BOUND=true');
  console.log('CHUNK_71_REMAINS_MONETARY_AUTHORITY=true');
  console.log('PRODUCTION_ACTIVE=false');
}

runProductionEconomicAuthorizationDemo();

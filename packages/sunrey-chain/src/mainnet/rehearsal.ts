/**
 * Mainnet candidate rehearsal using simulation credentials only.
 *
 * Leaves real external approvals incomplete. Does not activate
 * production services or LIVE_* flags.
 */

import { CAPABILITIES } from '../../../config/src/flags.ts';
import { assertMigrationNotExecuted, developmentMigrationFixture } from '../native-assets/migration.ts';
import { generateActivationPlan, activationPlanDoesNotEnableLiveFlags } from './activation-plan.ts';
import { signReadinessBundle, verifyReadinessBundle } from './bundle.ts';
import { defaultActivationMatrix, unlicensedCapabilitiesRemainUnavailable } from './capabilities.ts';
import { defaultDimensionCatalog } from './dimensions.ts';
import { assembleReadinessRegistry } from './registry.ts';
import { buildReadinessReport } from './report.ts';
import { sevenProductionCandidateValidators } from './validators.ts';
import { buildSimulatedCeremonyTranscript } from './ceremony.ts';
import { buildGenesisCandidate, defaultGenesisCandidateInput } from './genesis-candidate.ts';
import { verifyMainnetCandidate } from './verify.ts';

export function runMainnetCandidateRehearsal(root = process.cwd()) {
  const records = defaultDimensionCatalog();
  const authorizations = Object.freeze([]);
  const capabilities = defaultActivationMatrix();
  const validators = sevenProductionCandidateValidators();
  const ceremony = buildSimulatedCeremonyTranscript(validators);
  const genesisInput = defaultGenesisCandidateInput(validators);
  const first = buildGenesisCandidate(genesisInput);
  const second = buildGenesisCandidate(genesisInput);
  const registry = assembleReadinessRegistry({
    records,
    authorizations,
    capabilities,
    genesis: first,
  });
  const report = buildReadinessReport({
    records,
    authorizations,
    capabilities,
    candidateGenesisHash: first.genesisHash,
    root,
  });
  const bundle = signReadinessBundle(records, report);
  const plan = generateActivationPlan(records);
  const verify = verifyMainnetCandidate({
    genesisInput,
    expectedHash: first.genesisHash,
    records,
    bundle,
  });
  assertMigrationNotExecuted(developmentMigrationFixture());

  return Object.freeze({
    registry,
    report,
    bundle,
    plan,
    verify,
    ceremony,
    validatorCount: validators.length,
    genesisHash: first.genesisHash,
    deterministic: first.genesisHash === second.genesisHash,
    evidenceIncomplete: report.missingExternalEvidence.length > 0,
    humanAuthorizationAbsent: authorizations.length === 0,
    productionServicesActivated: false,
    liveFlags: CAPABILITIES,
    activationPlanSafe: activationPlanDoesNotEnableLiveFlags(plan),
    unlicensedUnavailable: unlicensedCapabilitiesRemainUnavailable(capabilities),
    bundleVerified: verifyReadinessBundle(records, bundle),
    status: registry.status,
  });
}

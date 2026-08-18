/**
 * ProductionGenesisCeremonyDressRehearsal.
 *
 * Completely separate simulation/rehearsal identities. Exercises the
 * full workflow. Keys, network ID, chain ID, genesis, and approvals
 * are unusable as real production inputs.
 */

import { assertNoPrivateKeyMaterial } from '../../../security/src/crypto-leakage.ts';
import { allocationManifestHash } from '../mainnet/allocation.ts';
import {
  consumeAuditEvidence,
  consumeProviderAcceptance,
  cryptoPolicyHash,
  economicBundleHash,
} from './bindings.ts';
import { collectExternalBlockers, evaluateGenesisEligibility } from './eligibility.ts';
import { rehearsalZeroAllocation } from './genesis.ts';
import {
  DRESS_REHEARSAL_CHAIN_ID,
  DRESS_REHEARSAL_ID,
  DRESS_REHEARSAL_NETWORK_ID,
  REHEARSAL_CANDIDATE_V2_ID,
  REHEARSAL_MAINNET_RC_ID,
} from './identity.ts';
import { defaultDressRehearsalParticipants } from './participants.ts';
import { createDressRehearsalCeremonyPlan } from './plan.ts';
import { buildLaunchAuthorizationDossier, buildVerificationReport, ceremonyEvidenceBundle } from './report.ts';
import {
  createReadinessSnapshot,
  dressRehearsalBindings,
  exportOfflinePackage,
  ProductionCeremonySessionController,
} from './session.ts';
import { sevenDressRehearsalDossiers, validatorSetHashFromDossiers } from './validators.ts';
import type { ProductionGenesisCeremonyDressRehearsal } from './types.ts';

export function runProductionGenesisCeremonyDressRehearsal(
  root = process.cwd(),
): ProductionGenesisCeremonyDressRehearsal {
  const dossiers = sevenDressRehearsalDossiers();
  const validatorSetHash = validatorSetHashFromDossiers(dossiers);
  const bindings = dressRehearsalBindings(validatorSetHash);
  const plan = createDressRehearsalCeremonyPlan({
    mainnetRcHash: bindings.mainnetRc.hash!,
    candidateV2RootHash: bindings.candidateV2.hash!,
    economicBundleHash: economicBundleHash(),
    cryptoPolicyHash: cryptoPolicyHash(),
    validatorCandidateSetHash: validatorSetHash,
    allocationManifestHash: allocationManifestHash(rehearsalZeroAllocation()),
  });
  const controller = new ProductionCeremonySessionController(plan, bindings.candidateV2, bindings.mainnetRc);
  for (const participant of defaultDressRehearsalParticipants()) {
    controller.register(participant);
  }
  controller.checkProvider();
  controller.recordDossiers(dossiers);
  controller.contributeDressRehearsalKeys();
  controller.challengeSigners();
  const genesis = controller.generateGenesis();
  controller.verifyGenesisHash(genesis.genesisHash);
  const humans = defaultDressRehearsalParticipants().filter((row) =>
    ['GENESIS_AUTHORITY', 'PROTOCOL_AUTHORITY', 'SECURITY_AUTHORITY', 'RELEASE_AUTHORITY'].includes(row.role),
  );
  for (const human of humans) {
    controller.approve(human);
  }
  const provider = consumeProviderAcceptance(root);
  const audit = consumeAuditEvidence(root);
  const snapshot = createReadinessSnapshot({ provider, audit });
  const authorization = controller.sealAuthorization(snapshot);
  const session = controller.snapshot();
  const transcriptVerified = controller.verifyTranscript();
  const eligibilityInput = {
    plan,
    candidateV2: bindings.candidateV2,
    mainnetRc: bindings.mainnetRc,
    provider,
    audit,
    acceptances: session.acceptances,
    allocationAuthorized: false,
    transcriptVerified,
    humanApprovals: authorization.humanAuthorizationSet,
    requireRealHsm: false,
    authorization,
  };
  const report = buildVerificationReport({
    plan,
    session,
    candidateV2: bindings.candidateV2,
    mainnetRc: bindings.mainnetRc,
    eligibility: evaluateGenesisEligibility(eligibilityInput),
    blockers: collectExternalBlockers(eligibilityInput),
    transcriptVerified,
    allocationStatus: 'REHEARSAL_ONLY',
  });
  const dossier = buildLaunchAuthorizationDossier({
    plan,
    report,
    authorization,
    blockers: report.externalBlockers,
  });
  const evidence = ceremonyEvidenceBundle(session, dossier);
  const offline = exportOfflinePackage(session);
  if (offline.containsSecretKeyMaterial) {
    throw new TypeError('offline package must not contain secret key material');
  }
  assertNoPrivateKeyMaterial(session, 'production-ceremony-dress-rehearsal');
  assertNoPrivateKeyMaterial(report, 'production-ceremony-dress-rehearsal');
  assertNoPrivateKeyMaterial(dossier, 'production-ceremony-dress-rehearsal');
  return Object.freeze({
    rehearsalId: DRESS_REHEARSAL_ID,
    session,
    report,
    dossier,
    evidence,
    genesisHash: genesis.genesisHash,
    transcriptVerified,
    usableForProduction: false,
    realProductionKeysCreated: false,
    mainnetEnabled: false,
  });
}

export function dressRehearsalUnusableForProduction(rehearsal: ProductionGenesisCeremonyDressRehearsal): true {
  if (rehearsal.usableForProduction || rehearsal.session.authorization?.usableForProduction) {
    throw new TypeError('dress-rehearsal authorization unusable for production');
  }
  if (rehearsal.session.plan.networkId !== DRESS_REHEARSAL_NETWORK_ID) {
    throw new TypeError('dress rehearsal network identity mismatch');
  }
  if (rehearsal.session.plan.chainId !== DRESS_REHEARSAL_CHAIN_ID) {
    throw new TypeError('dress rehearsal chain identity mismatch');
  }
  if (rehearsal.session.plan.candidateV2Id !== REHEARSAL_CANDIDATE_V2_ID) {
    throw new TypeError('dress rehearsal candidate id mismatch');
  }
  if (rehearsal.session.plan.mainnetRcId !== REHEARSAL_MAINNET_RC_ID) {
    throw new TypeError('dress rehearsal Mainnet RC id mismatch');
  }
  return true;
}

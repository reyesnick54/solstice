import { sha256Text } from '../../supply-chain/inventory.ts';
import type {
  MainnetCompatibilityReport,
  MainnetQualificationReport,
  SignedMainnetRcBundle,
} from './types.ts';

export function buildMainnetQualificationReport(bundle: SignedMainnetRcBundle): MainnetQualificationReport {
  const externalHumanGaps = bundle.qualification.cells
    .filter((row) => row.state === 'EXTERNAL_EVIDENCE_REQUIRED' || row.state === 'HUMAN_AUTHORIZATION_REQUIRED')
    .map((row) => `${row.category}:${row.state}`);
  return Object.freeze({
    rcId: bundle.manifest.mainnet_rc_id,
    sourceCommit: bundle.manifest.source_commit,
    candidateV2Hash: bundle.manifest.candidate_v2_hash,
    economicRcHash: bundle.manifest.economic_rc_hash,
    releaseManifestHash: sha256Text(JSON.stringify(bundle.manifest)),
    qualificationResult: bundle.manifest.qualification_result,
    matrix: Object.freeze(bundle.qualification.cells.map((row) => Object.freeze({ category: row.category, state: row.state }))),
    formal: bundle.evidence.formal.result,
    fuzz: bundle.evidence.fuzz.ok ? `PASS:${bundle.evidence.fuzz.profile}` : 'FAIL',
    adversarial: bundle.evidence.adversarial.ok ? 'PASS' : 'FAIL',
    economicStress: bundle.evidence.economicStress.ok ? 'PASS' : `FAIL:${bundle.evidence.economicStress.criticalFailures.join(',')}`,
    performance: bundle.evidence.performance,
    providerState: Object.freeze({
      unconfigured: bundle.providers.unconfigured,
      engineeringTested: bundle.providers.engineeringTested,
      externallyEvidenced: bundle.providers.externallyEvidenced,
      humanAccepted: bundle.providers.humanAccepted,
      productionEligible: bundle.providers.productionEligible,
    }),
    auditState: bundle.audit,
    hsmState: bundle.hsm.state,
    pqcState: bundle.cryptoFreeze,
    knownLimitations: Object.freeze(bundle.limitations.map((row) => row.id)),
    externalHumanGaps: Object.freeze(externalHumanGaps),
    mainnetEnabled: false,
    authorizedCandidate: false,
  });
}

export function buildMainnetCompatibilityReport(bundle: SignedMainnetRcBundle): MainnetCompatibilityReport {
  const sdk = bundle.qualification.cells.find((row) => row.category === 'SDK');
  const explorer = bundle.qualification.cells.find((row) => row.category === 'EXPLORER');
  const wallets = bundle.qualification.cells.find((row) => row.category === 'WALLETS');
  return Object.freeze({
    typescriptSdk: sdk?.state === 'PASS',
    rustSdk: sdk?.state === 'PASS',
    explorer: explorer?.state === 'PASS',
    wallets: wallets?.state === 'PASS',
    digest: sha256Text(`${sdk?.state ?? 'missing'}|${explorer?.state ?? 'missing'}|${wallets?.state ?? 'missing'}`),
  });
}

import { EconomicAssetRegistry } from '../../../../../economic-asset-registry/src/index.ts';
import {
  SANDBOX_CLASSES,
  emptyEvidenceStates,
  feedSchemaFor,
  projectCertificationMetadata,
  runCertificationSuite,
  sandboxSubject,
} from './index.ts';

const energy = sandboxSubject('energy', 'VALID', emptyEvidenceStates());
const suite = runCertificationSuite(energy, feedSchemaFor(SANDBOX_CLASSES.energy));
const registry = new EconomicAssetRegistry();
const projected = projectCertificationMetadata(registry, suite.record);

console.log('SunRey economic data provider certification demo');
console.log('provider sandbox → connector runtime → technical / unit / taxonomy / provenance / security');
console.log(suite.report.humanReadable);
console.log('');
console.log(`certificationId=${suite.record.certificationId}`);
console.log(`status=${suite.record.status}`);
console.log(`qualityClass=${suite.record.qualityClass}`);
console.log(`earProjected=${projected.ok}`);
console.log(`TESTNET_ADMISSIBLE=${suite.report.testnetAdmissible}`);
console.log(`PRODUCTION_CANDIDATE=${suite.report.productionCandidate}`);
console.log(`COMMERCIAL_EVIDENCE_FABRICATED=${suite.report.commercialEvidenceFabricated}`);
console.log(`CERTIFICATION_FINALIZES_ORACLE=${suite.report.certificationFinalizesOracle}`);
console.log(`CERTIFICATION_MINTS_MOONREY=${suite.report.certificationMintsMoonRey}`);
console.log('demo ok — certification is an admission control, not economic authority');

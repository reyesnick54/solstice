import { join } from 'node:path';

import { createEconomicReleaseCandidate, verifyEconomicReleaseCandidate } from './registry.ts';

const root = join(import.meta.dirname, '../../../../..');

const created = createEconomicReleaseCandidate({
  root,
  profile: 'smoke',
  rcId: 'SUNREY_ECONOMIC_TESTNET_RC_1',
});
const verified = verifyEconomicReleaseCandidate(created.bundle, created.bundle.manifest.source_commit, root);

console.log('SunRey economic RC demo');
console.log(`banner=SUNREY ECONOMIC TESTNET RC`);
console.log(`rc_id=${created.bundle.manifest.economic_rc_id}`);
console.log(`source_commit=${created.bundle.manifest.source_commit}`);
console.log(`protocol_version=${created.bundle.manifest.protocol_version}`);
console.log(`status=${created.bundle.manifest.qualification_result}`);
console.log(`mainnet_ready=${created.bundle.manifest.mainnet_ready}`);
console.log(`formal=${created.report.formalResult}`);
console.log(`stress=${created.report.stressResult}`);
console.log(`simulation=${created.report.simulationResult}`);
console.log(`seven_validator=${created.report.sevenValidatorResult}`);
console.log(`verified=${verified.ok}`);
console.log(`limitations=${created.report.knownLimitations.join(',')}`);
console.log('demo ok — economic TESTNET qualification only; not mainnet');

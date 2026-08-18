import { join } from 'node:path';

import { createMainnetReleaseCandidate, verifyMainnetReleaseCandidate } from './registry.ts';

const root = join(import.meta.dirname, '../../../../..');

const created = createMainnetReleaseCandidate({
  root,
  profile: 'smoke',
  rcId: 'SUNREY_MAINNET_RC_1',
});
const verified = verifyMainnetReleaseCandidate(created.bundle, created.bundle.manifest.source_commit, root);

console.log('SunRey mainnet RC demo');
console.log('banner=SUNREY MAINNET RC');
console.log(`rc_id=${created.bundle.manifest.mainnet_rc_id}`);
console.log(`source_commit=${created.bundle.manifest.source_commit}`);
console.log(`candidate_v2_hash=${created.bundle.manifest.candidate_v2_hash}`);
console.log(`economic_rc_hash=${created.bundle.manifest.economic_rc_hash}`);
console.log(`status=${created.bundle.manifest.qualification_result}`);
console.log(`mainnet_enabled=${created.bundle.manifest.mainnet_enabled}`);
console.log(`formal=${created.report.formal}`);
console.log(`fuzz=${created.report.fuzz}`);
console.log(`adversarial=${created.report.adversarial}`);
console.log(`economic_stress=${created.report.economicStress}`);
console.log(`verified=${verified.ok}`);
console.log(`limitations=${created.report.knownLimitations.join(',')}`);
console.log('demo ok — Mainnet RC qualification only; not network activation');

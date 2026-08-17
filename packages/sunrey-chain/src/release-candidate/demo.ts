import { join } from 'node:path';

import { createReleaseCandidate, verifyReleaseCandidate } from './registry.ts';

const root = join(import.meta.dirname, '../../../..');

const created = createReleaseCandidate({ root, profile: 'smoke', rcId: 'SUNREY_TESTNET_RC_1' });
const verified = verifyReleaseCandidate(created.bundle, created.bundle.manifest.source_commit);

console.log('SunRey Testnet RC demo');
console.log(`banner=${created.bundle.notes.banner}`);
console.log(`rc_id=${created.bundle.manifest.rc_id}`);
console.log(`source_commit=${created.bundle.manifest.source_commit}`);
console.log(`protocol_version=${created.bundle.manifest.protocol_version}`);
console.log(`genesis_hash=${created.bundle.manifest.genesis_hash}`);
console.log(`status=${created.bundle.manifest.qualification_state}`);
console.log(`mainnet_ready=${created.bundle.manifest.mainnet_ready}`);
console.log(`verified=${verified.ok}`);
console.log(`limitations=${created.bundle.notes.knownLimitations.map((row) => row.id).join(',')}`);
console.log('demo ok — TESTNET only; not mainnet');

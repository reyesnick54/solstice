import { join } from 'node:path';

import { generateAuditBundle, verifyAuditBundle } from './bundle.ts';
import { buildReadinessReport } from './readiness.ts';
import { scopeIsComplete } from './scope.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');

if (!scopeIsComplete()) {
  throw new Error('sunrey-audit demo: review domains incomplete');
}
const generated = generateAuditBundle(ROOT, { sourceCommit: 'demo' });
const verified = verifyAuditBundle(generated.outDir);
if (!verified.ok) {
  throw new Error('sunrey-audit demo: verify failed');
}
const readiness = buildReadinessReport();
if (readiness.claims_external_audit_completed) {
  throw new Error('sunrey-audit demo: must not claim an external audit');
}
console.log('sunrey-audit demo ok — engineering review package only');

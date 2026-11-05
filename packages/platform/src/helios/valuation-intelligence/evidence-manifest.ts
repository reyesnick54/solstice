/**
 * Compile a point-in-time valuation evidence manifest.
 */

import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import { assertAssumptionExplicit } from './assumption.ts';
import { assertNoValuationLeakage } from './knowable-at.ts';
import type {
  ValuationEvidenceManifest,
  ValuationIntelligenceStoreSnapshot,
} from './val01-canonical-domain.ts';
import { HELIOS_VAL01_CANONICAL_DOMAIN_SCHEMA } from './taxonomy.ts';

export function compileValuationEvidenceManifest(input: {
  readonly evaluationTime: UtcInstant;
  readonly compiledAt: UtcInstant;
  readonly snapshot: ValuationIntelligenceStoreSnapshot;
}): ValuationEvidenceManifest {
  assertNoValuationLeakage(input.evaluationTime, input.snapshot.snapshots);
  assertNoValuationLeakage(input.evaluationTime, input.snapshot.scenarios);
  assertNoValuationLeakage(input.evaluationTime, input.snapshot.assumptions);
  assertNoValuationLeakage(input.evaluationTime, input.snapshot.distributions);
  assertNoValuationLeakage(input.evaluationTime, input.snapshot.intrinsicDistributions);
  assertNoValuationLeakage(input.evaluationTime, input.snapshot.marketImpliedExpectations);

  for (const assumption of input.snapshot.assumptions) {
    assertAssumptionExplicit(assumption);
  }

  const contentHash = createHash('sha256')
    .update(
      JSON.stringify({
        evaluationTime: input.evaluationTime,
        snapshots: input.snapshot.snapshots.length,
        assumptions: input.snapshot.assumptions.length,
      }),
    )
    .digest('hex');

  const manifestId = `val_manifest_${contentHash.slice(0, 24)}`;

  return Object.freeze({
    schema: HELIOS_VAL01_CANONICAL_DOMAIN_SCHEMA,
    manifestId,
    evaluationTime: input.evaluationTime,
    compiledAt: input.compiledAt,
    snapshots: Object.freeze([...input.snapshot.snapshots]),
    scenarios: Object.freeze([...input.snapshot.scenarios]),
    assumptions: Object.freeze([...input.snapshot.assumptions]),
    distributions: Object.freeze([...input.snapshot.distributions]),
    intrinsicDistributions: Object.freeze([...input.snapshot.intrinsicDistributions]),
    marketImpliedExpectations: Object.freeze([...input.snapshot.marketImpliedExpectations]),
    contentHash,
    grantsExecutionAuthority: false,
  });
}

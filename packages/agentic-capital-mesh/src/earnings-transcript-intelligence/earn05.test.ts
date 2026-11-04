import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HELIOS_EARN05_MESH_TRANSCRIPT_BRIDGE_QUALIFIED,
  evaluateEarn05MeshQualification,
} from './qualification.ts';
import { createEarningsTranscriptMeshBridge } from './mesh-bridge.ts';
import { createFixtureEarningsTranscriptIntelligencePort } from './platform-port.ts';

describe('EARN05 agentic capital mesh bridge', () => {
  it('returns structured feature summary from fixture port', () => {
    const bridge = createEarningsTranscriptMeshBridge({
      port: createFixtureEarningsTranscriptIntelligencePort(),
    });
    const result = bridge.analyze({
      workOrderId: 'wo_test',
      subjectId: 'subject_test',
      transcriptId: 'earn05.fixture.q1fy2026',
      evidenceRefs: Object.freeze([
        Object.freeze({
          evidenceId: 'ev1',
          sourceRef: 'fixture:earn05',
          observedAt: '2026-05-15T21:00:00.000Z',
        }),
      ]),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.baselineOnly, true);
      assert.equal(result.specialistRole, 'EARNINGS_RESEARCH');
      assert.ok(result.featureSummary.analysisOutputHash.length > 0);
    }
  });

  it('qualifies mesh bridge wiring', () => {
    const qualification = evaluateEarn05MeshQualification();
    assert.equal(qualification.qualified, true);
    assert.equal(qualification.marker, HELIOS_EARN05_MESH_TRANSCRIPT_BRIDGE_QUALIFIED);
  });
});

/**
 * HELIOS EARN05 — earnings transcript intelligence mesh bridge integration.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { UtcInstant } from '../packages/domain/src/time.ts';

import {
  HELIOS_EARN05_MESH_TRANSCRIPT_BRIDGE_QUALIFIED,
  createEarningsTranscriptMeshBridge,
  evaluateEarn05MeshQualification,
} from '../packages/agentic-capital-mesh/src/earnings-transcript-intelligence/index.ts';
import { createEarn05TranscriptMeshFixturePort } from '../packages/platform/src/helios/earnings-intelligence/transcript/mesh-fixture-port.ts';

describe('HELIOS EARN05 transcript mesh bridge integration', () => {
  it('returns structured feature summary from platform fixture port', () => {
    const port = createEarn05TranscriptMeshFixturePort();
    const bridge = createEarningsTranscriptMeshBridge({ port });
    const result = bridge.analyze({
      workOrderId: 'wo_test',
      subjectId: 'subject_test',
      transcriptId: 'earn05.fixture.q1fy2026',
      evidenceRefs: Object.freeze([
        Object.freeze({
          evidenceId: 'ev1',
          sourceRef: 'fixture:earn05',
          observedAt: '2026-05-15T21:00:00.000Z' as UtcInstant,
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

  it('qualifies mesh bridge wiring against canonical platform analysis', () => {
    const qualification = evaluateEarn05MeshQualification({
      port: createEarn05TranscriptMeshFixturePort(),
    });
    assert.equal(qualification.qualified, true);
    assert.equal(qualification.marker, HELIOS_EARN05_MESH_TRANSCRIPT_BRIDGE_QUALIFIED);
  });
});

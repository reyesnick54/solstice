import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { UtcInstant } from './imports.ts';

import {
  HELIOS_EARN05_MESH_TRANSCRIPT_BRIDGE_QUALIFIED,
  evaluateEarn05MeshQualification,
} from './earnings-transcript-intelligence/qualification.ts';
import { createEarningsTranscriptMeshBridge } from './earnings-transcript-intelligence/mesh-bridge.ts';
import type { EarningsTranscriptIntelligencePort } from './earnings-transcript-intelligence/types.ts';

function mockPort(): EarningsTranscriptIntelligencePort {
  return Object.freeze({
    analyzeForMesh() {
      return Object.freeze({
        ok: true,
        specialistRole: 'EARNINGS_RESEARCH',
        baselineOnly: true,
        featureSummary: Object.freeze({
          managementTone: 0.1,
          uncertaintyScore: 0.2,
          forwardLookingScore: 0.3,
          semanticNovelty: 0.4,
          answeredQuestionRatio: 0.5,
          expectedSignOfConsensusError: 0,
          consensusConfidence: 0.6,
          qualificationMarker: 'HELIOS_EARN05_TRANSCRIPT_INTELLIGENCE_QUALIFIED',
          analysisOutputHash: 'abc123',
        }),
      });
    },
  });
}

describe('EARN05 agentic capital mesh bridge', () => {
  it('forwards analyze requests to the injected port', () => {
    const bridge = createEarningsTranscriptMeshBridge({
      port: mockPort(),
    });
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

  it('qualifies mesh bridge wiring when port matches platform marker', () => {
    const qualification = evaluateEarn05MeshQualification({ port: mockPort() });
    assert.equal(qualification.qualified, true);
    assert.equal(qualification.marker, HELIOS_EARN05_MESH_TRANSCRIPT_BRIDGE_QUALIFIED);
  });
});

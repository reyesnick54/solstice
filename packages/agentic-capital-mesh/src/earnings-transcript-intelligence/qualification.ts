import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { UtcInstant } from '../imports.ts';

import { EARN05_PLATFORM_OWNER } from './upstream-reference.ts';
import { createEarningsTranscriptMeshBridge } from './mesh-bridge.ts';
import type { EarningsTranscriptIntelligencePort } from './types.ts';

export const HELIOS_EARN05_MESH_TRANSCRIPT_BRIDGE_QUALIFIED =
  'HELIOS_EARN05_MESH_TRANSCRIPT_BRIDGE_QUALIFIED' as const;

export const HELIOS_EARN05_MESH_TRANSCRIPT_BRIDGE_BLOCKED =
  'HELIOS_EARN05_MESH_TRANSCRIPT_BRIDGE_BLOCKED' as const;

export type Earn05MeshQualificationResult = {
  readonly marker:
    | typeof HELIOS_EARN05_MESH_TRANSCRIPT_BRIDGE_QUALIFIED
    | typeof HELIOS_EARN05_MESH_TRANSCRIPT_BRIDGE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

function repoRoot(): string {
  return join(import.meta.dirname, '..', '..', '..', '..');
}

export function evaluateEarn05MeshQualification(input: {
  readonly port: EarningsTranscriptIntelligencePort;
}): Earn05MeshQualificationResult {
  const blockers: string[] = [];
  const root = repoRoot();
  const ownerPath = join(root, EARN05_PLATFORM_OWNER.modulePath);
  if (!existsSync(ownerPath)) {
    blockers.push('platform_owner_missing');
  }

  const bridge = createEarningsTranscriptMeshBridge({
    port: input.port,
  });
  const result = bridge.analyze({
    workOrderId: 'wo_earn05_qual',
    subjectId: 'subject_earn05',
    transcriptId: 'earn05.fixture.q1fy2026',
    evidenceRefs: Object.freeze([
      Object.freeze({
        evidenceId: 'ev_earn05_fixture',
        sourceRef: 'fixture:earn05:q1fy2026',
        observedAt: '2026-05-15T21:00:00.000Z' as UtcInstant,
      }),
    ]),
  });
  if (!result.ok) {
    blockers.push('mesh_bridge_analyze_failed');
  } else if (result.featureSummary.qualificationMarker !== EARN05_PLATFORM_OWNER.qualificationMarker) {
    blockers.push('platform_qualification_marker_mismatch');
  }

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_EARN05_MESH_TRANSCRIPT_BRIDGE_QUALIFIED
      : HELIOS_EARN05_MESH_TRANSCRIPT_BRIDGE_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}

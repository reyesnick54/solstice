import type { Clock } from '../../../config/src/clock.ts';
import { EvidenceVault } from '../../../evidence/src/vault.ts';
import { assertSafeTelemetryRecord } from './privacy.ts';
import type { IncidentEvidenceKind } from './types.ts';

export function sealIncidentEvidence(
  vault: EvidenceVault,
  kind: IncidentEvidenceKind,
  payload: Record<string, unknown>,
) {
  assertSafeTelemetryRecord(payload, 'evidence');
  return vault.seal(kind, payload);
}

export function createOpsEvidenceVault(clock: Clock): EvidenceVault {
  return new EvidenceVault(clock);
}

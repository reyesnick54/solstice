/**
 * Deliberate inventory of legacy / rehearsal paths and current
 * external evidence. Nothing here is fabricated. No legacy path
 * qualifies as a production candidate.
 */

import type { ExternalEvidenceInventoryItem, LegacyPathInventoryItem } from './types.ts';

export function legacyPathInventory(): readonly LegacyPathInventoryItem[] {
  return Object.freeze([
    Object.freeze({
      pathId: 'moonrey-v1-engineering-formula',
      title: 'MoonRey V1 engineering formula',
      classification: 'ENGINEERING_ONLY' as const,
      productionCandidateEligible: false,
    }),
    Object.freeze({
      pathId: 'sunrey-legacy-fixture-authorization',
      title: 'SunRey legacy fixture authorization',
      classification: 'ENGINEERING_ONLY' as const,
      productionCandidateEligible: false,
    }),
    Object.freeze({
      pathId: 'historical-economic-rc',
      title: 'Historical Economic RC (Chunk 78)',
      classification: 'HISTORICAL_REPLAY_ONLY' as const,
      productionCandidateEligible: false,
    }),
    Object.freeze({
      pathId: 'historical-rehearsal-parameter-values',
      title: 'Historical rehearsal parameter values',
      classification: 'REHEARSAL_ONLY' as const,
      productionCandidateEligible: false,
    }),
  ]);
}

export function currentExternalEvidenceInventory(): readonly ExternalEvidenceInventoryItem[] {
  return Object.freeze([
    item('external-security-review', 'external security review', 'EXTERNAL', 'no externally supplied security review is present on main'),
    item('provider-agreements', 'provider agreements', 'EXTERNAL', 'no real provider agreements are present'),
    item('data-licenses', 'data licenses', 'EXTERNAL', 'no production data licenses are present'),
    item('hsm-provider-evidence', 'HSM/provider evidence', 'EXTERNAL', 'simulation HSM is fixture evidence, not production authority'),
    item('legal-counsel', 'legal counsel', 'EXTERNAL', 'no counsel opinion is recorded'),
    item('licenses-registrations', 'licenses/registrations', 'EXTERNAL', 'no license or registration evidence is recorded'),
    item('regulatory-approvals', 'regulatory approvals', 'EXTERNAL', 'no regulatory approval is recorded'),
    item('partner-agreements', 'partner agreements', 'EXTERNAL', 'no partner agreement is recorded'),
    item('jurisdiction-approvals', 'jurisdiction approvals', 'EXTERNAL', 'no jurisdiction operating approval is recorded'),
  ]);
}

function item(
  evidenceId: string,
  title: string,
  evidenceClass: ExternalEvidenceInventoryItem['class'],
  notes: string,
): ExternalEvidenceInventoryItem {
  return Object.freeze({
    evidenceId,
    title,
    present: false,
    fabricated: false,
    class: evidenceClass,
    notes,
  });
}

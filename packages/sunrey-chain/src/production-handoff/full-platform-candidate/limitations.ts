/**
 * External and human evidence lanes stay explicit. Engineering
 * simulation cannot fabricate those records.
 */

import type { ExternalEvidenceItem } from './types.ts';

export function currentExternalEvidenceInventory(): readonly ExternalEvidenceItem[] {
  return Object.freeze([
    item('ext.licensed-bank', 'Licensed bank / payment-network membership', 'EXTERNAL', 'No real bank connected.'),
    item('ext.approved-exchange', 'Approved exchange authorization', 'EXTERNAL', 'Exchange remains simulation.'),
    item('ext.approved-vasp', 'Approved VASP authorization', 'EXTERNAL', 'No VASP approval supplied.'),
    item('ext.regulatory-approval', 'Legal / regulatory approvals', 'HUMAN', 'No counsel confirmation.'),
    item('ext.provider-contract', 'Real provider commercial contracts', 'EXTERNAL', 'Fixture transports only.'),
    item('ext.hsm-attestation', 'Real HSM attestation', 'EXTERNAL', 'Fixture HSM rehearsal only.'),
    item('ext.production-tokenomics', 'Production tokenomics approved', 'HUMAN', 'Rehearsal parameter packages only.'),
    item('ext.mainnet-authorization', 'Mainnet authorized', 'HUMAN', 'Human activation authorization absent.'),
    item('ext.security-audit', 'Independent security audit bundle', 'EXTERNAL', 'Audit evidence not supplied.'),
    item('ext.production-connectivity', 'Production provider connectivity', 'EXTERNAL', 'LIVE flags remain disabled.'),
  ]);
}

export function refuseFabricatedExternalEvidence(item: ExternalEvidenceItem): ExternalEvidenceItem {
  return Object.freeze({
    ...item,
    present: false,
    fabricated: false,
  });
}

export function attemptMarkExternalPresent(actorKind: string): string {
  return `external-evidence-cannot-be-fabricated:${actorKind}`;
}

function item(
  evidenceId: string,
  title: string,
  lane: ExternalEvidenceItem['lane'],
  notes: string,
): ExternalEvidenceItem {
  return Object.freeze({
    evidenceId,
    title,
    present: false,
    fabricated: false,
    lane,
    notes,
  });
}

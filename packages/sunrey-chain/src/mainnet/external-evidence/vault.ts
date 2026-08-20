/**
 * Seal safe external-evidence metadata through the Evidence Vault.
 * Confidential document bodies are never included.
 */

import type { EvidenceVault } from '../../../../evidence/src/vault.ts';

import { publicSafeView } from './report.ts';
import { EXTERNAL_EVIDENCE_VAULT_KIND, type ExternalProductionEvidenceRecord } from './types.ts';

export function sealExternalEvidenceCommitment(
  vault: EvidenceVault,
  record: ExternalProductionEvidenceRecord,
  nowUtc: string,
) {
  const view = publicSafeView(record, nowUtc);
  return vault.seal(EXTERNAL_EVIDENCE_VAULT_KIND, {
    recordId: view.recordId,
    evidenceClass: view.evidenceClass,
    contentDigest: view.contentDigest,
    commitmentHash: view.commitmentHash,
    verificationState: view.verificationState,
    freshness: view.freshness,
    fixture: view.fixture,
    engineeringOnly: view.engineeringOnly,
    confidentialDocumentPresent: false,
    rawDocumentOnChain: false,
    publicChainSafe: true,
  });
}

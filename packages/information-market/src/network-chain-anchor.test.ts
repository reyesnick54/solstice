import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { SunReyChainService } from '../../sunrey-chain/src/service.ts';
import { runHinChainAnchorFoundationDemo } from './network/chain-anchor/demo.ts';
import { provisionHinChainAnchorFixture, realizeHinUse, unwrapAnchor } from './network/chain-anchor/fixtures.ts';
import {
  HIN_CHAIN_ANCHOR_INVARIANTS,
  HIN_CHAIN_ANCHOR_OWNER,
  buildConsentAnchorSchema,
  buildContributionProofAnchorSchema,
  buildRevocationAnchorSchema,
  commitHinDomain,
  humanInformationAnchorKey,
} from './network/chain-anchor/index.ts';
import { HumanInformationNetworkEngine } from './network/engine.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

describe('Chunk 139 HIN → SunRey Chain anchoring foundation', () => {
  it('1. consent maps to CONSENT_RECEIPT schema', () => {
    const net = provisionHinChainAnchorFixture();
    const record = unwrapAnchor(
      net.adapter.createAnchorIntent({
        kind: 'CONSENT_GRANT',
        sourceRecordId: net.approved.grant.grantId,
      }),
    );
    const intent = net.adapter.getIntent(record.anchorId);
    assert.equal(record.chainRecordType, 'CONSENT_RECEIPT');
    assert.equal(intent?.recordType, 'CONSENT_RECEIPT');
    assert.equal(intent?.schema.fields.consentHash, net.approved.grant.consentHash);
    assert.equal(intent?.sourceSubsystem, 'information-market');
    assert.equal(record.state, 'INTENT_CREATED');
  });

  it('2. revocation maps to CONSENT_REVOCATION', () => {
    const net = provisionHinChainAnchorFixture();
    const revocation = unwrapAnchor(net.engine.revokeInformationConsent({ grantId: net.approved.grant.grantId }));
    const record = unwrapAnchor(
      net.adapter.createAnchorIntent({
        kind: 'CONSENT_REVOCATION',
        sourceRecordId: revocation.revocationId,
      }),
    );
    assert.equal(record.chainRecordType, 'CONSENT_REVOCATION');
    assert.equal(net.adapter.getIntent(record.anchorId)?.recordType, 'CONSENT_REVOCATION');
  });

  it('3. right state maps to EVIDENCE_ANCHOR', () => {
    const net = provisionHinChainAnchorFixture();
    const record = unwrapAnchor(
      net.adapter.createAnchorIntent({
        kind: 'INFORMATION_RIGHT_STATE',
        sourceRecordId: net.approved.right.rightId,
      }),
    );
    assert.equal(record.chainRecordType, 'EVIDENCE_ANCHOR');
    assert.equal(net.adapter.getIntent(record.anchorId)?.schema.fields.evidenceKind, 'INFORMATION_RIGHT_STATE');
    assert.equal(net.adapter.getIntent(record.anchorId)?.schema.fields.transfersOwnership, false);
  });

  it('4. purpose grant maps to EVIDENCE_ANCHOR', () => {
    const net = provisionHinChainAnchorFixture();
    const record = unwrapAnchor(
      net.adapter.createAnchorIntent({
        kind: 'PURPOSE_GRANT',
        sourceRecordId: net.approved.right.purposeGrantId,
      }),
    );
    assert.equal(record.chainRecordType, 'EVIDENCE_ANCHOR');
    assert.equal(net.adapter.getIntent(record.anchorId)?.schema.fields.evidenceKind, 'PURPOSE_GRANT');
  });

  it('5. usage receipt maps to COMPUTATION_RECEIPT', () => {
    const net = provisionHinChainAnchorFixture();
    const { receipt } = realizeHinUse(net);
    const record = unwrapAnchor(
      net.adapter.createAnchorIntent({
        kind: 'USAGE_RECEIPT',
        sourceRecordId: receipt.receiptId,
      }),
    );
    assert.equal(record.chainRecordType, 'COMPUTATION_RECEIPT');
    assert.equal(net.adapter.getIntent(record.anchorId)?.recordType, 'COMPUTATION_RECEIPT');
  });

  it('6. clean-room result commitment only', () => {
    const net = provisionHinChainAnchorFixture();
    const { job, result } = realizeHinUse(net);
    const record = unwrapAnchor(
      net.adapter.createAnchorIntent({
        kind: 'CLEAN_ROOM_COMPUTATION',
        sourceRecordId: job.computationRequestId,
      }),
    );
    const fields = net.adapter.getIntent(record.anchorId)?.schema.fields ?? {};
    assert.equal(record.chainRecordType, 'COMPUTATION_RECEIPT');
    assert.equal(typeof fields.resultCommitment, 'string');
    assert.equal(JSON.stringify(fields).includes(String(result.privacySafeValue)), false);
    assert.equal(JSON.stringify(fields).includes('rawRows'), false);
  });

  it('7. provenance maps to PROVENANCE', () => {
    const net = provisionHinChainAnchorFixture();
    const record = unwrapAnchor(
      net.adapter.createAnchorIntent({
        kind: 'PROVENANCE',
        sourceRecordId: net.descriptor.descriptorId,
      }),
    );
    assert.equal(record.chainRecordType, 'PROVENANCE');
    assert.equal(net.adapter.getIntent(record.anchorId)?.recordType, 'PROVENANCE');
  });

  it('8. verified contribution maps to PROOF_OF_CONTRIBUTION', () => {
    const net = provisionHinChainAnchorFixture();
    const { receipt } = realizeHinUse(net);
    const recorded = unwrapAnchor(net.contribution.submitRealizedUse({ receiptId: receipt.receiptId }));
    const record = unwrapAnchor(
      net.adapter.createAnchorIntent({
        kind: 'HUMAN_CONTRIBUTION_PROOF',
        sourceRecordId: recorded.contributionId,
        contributionId: recorded.contributionId,
      }),
    );
    const intent = net.adapter.getIntent(record.anchorId);
    assert.equal(record.chainRecordType, 'PROOF_OF_CONTRIBUTION');
    assert.equal(intent?.schema.fields.doesNotMint, true);
    assert.equal(record.mintsAsset, false);
  });

  it('9. unverified contribution is rejected', () => {
    const net = provisionHinChainAnchorFixture();
    const attempt = net.adapter.createAnchorIntent({
      kind: 'HUMAN_CONTRIBUTION_PROOF',
      sourceRecordId: 'contrib_unverified',
      contributionId: 'contrib_unverified',
    });
    assert.equal(attempt.ok, false);
    if (!attempt.ok) {
      assert.equal(attempt.error.code, 'HIN_ANCHOR_CONTRIBUTION_NOT_VERIFIED');
    }
  });

  it('10. compensation settlement requires a real canonical settlementRef', () => {
    const net = provisionHinChainAnchorFixture();
    const { compensation } = realizeHinUse(net);
    const missing = net.adapter.createAnchorIntent({
      kind: 'COMPENSATION_SETTLEMENT_REFERENCE',
      sourceRecordId: compensation.instructionId,
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.error.code, 'HIN_ANCHOR_SETTLEMENT_NOT_CANONICAL');
    }
    const invented = net.adapter.createAnchorIntent({
      kind: 'COMPENSATION_SETTLEMENT_REFERENCE',
      sourceRecordId: compensation.instructionId,
      canonicalSettlement: {
        journalId: compensation.settlementRef ?? 'settle_invented',
        transferId: 'xfer_invented',
        assetCommitment: 'commit_invented',
      },
    });
    assert.equal(invented.ok, false);
    if (!invented.ok) {
      assert.equal(invented.error.code, 'HIN_ANCHOR_SETTLEMENT_NOT_CANONICAL');
    }
    const canonical = unwrapAnchor(
      net.adapter.createAnchorIntent({
        kind: 'COMPENSATION_SETTLEMENT_REFERENCE',
        sourceRecordId: compensation.instructionId,
        canonicalSettlement: {
          journalId: 'jrn_canonical_settlement',
          transferId: 'xfer_canonical_settlement',
          assetCommitment: 'cmt_canonical_settlement',
        },
      }),
    );
    assert.equal(canonical.chainRecordType, 'DIGITAL_ASSET_SETTLEMENT');
    assert.equal(net.adapter.getIntent(canonical.anchorId)?.schema.fields.authoritativeLedger, 'canonical-internal-ledger');
    assert.equal(net.adapter.getIntent(canonical.anchorId)?.schema.fields.chainBalanceAuthoritative, false);
  });

  it('11. raw personal data is rejected', () => {
    const net = provisionHinChainAnchorFixture();
    const attempt = net.adapter.createAnchorIntent({
      kind: 'CONSENT_GRANT',
      sourceRecordId: net.approved.grant.grantId,
      extraPayload: { rawPayload: 'home address and private communications' },
    });
    assert.equal(attempt.ok, false);
    if (!attempt.ok) {
      assert.equal(attempt.error.code, 'HIN_ANCHOR_PRIVACY_VIOLATION');
    }
  });

  it('12. legal name is rejected', () => {
    const net = provisionHinChainAnchorFixture();
    const attempt = net.adapter.createAnchorIntent({
      kind: 'CONSENT_GRANT',
      sourceRecordId: net.approved.grant.grantId,
      extraPayload: { legalName: 'Ada Lovelace' },
    });
    assert.equal(attempt.ok, false);
    if (!attempt.ok) {
      assert.equal(attempt.error.code, 'HIN_ANCHOR_PRIVACY_VIOLATION');
    }
  });

  it('13. health data is rejected', () => {
    const net = provisionHinChainAnchorFixture();
    const attempt = net.adapter.createAnchorIntent({
      kind: 'INFORMATION_RIGHT_STATE',
      sourceRecordId: net.approved.right.rightId,
      extraPayload: { healthRecord: 'diagnosis notes' },
    });
    assert.equal(attempt.ok, false);
    if (!attempt.ok) {
      assert.equal(attempt.error.code, 'HIN_ANCHOR_PRIVACY_VIOLATION');
    }
  });

  it('14. raw PDV is rejected', () => {
    const net = provisionHinChainAnchorFixture();
    const attempt = net.adapter.createAnchorIntent({
      kind: 'PROVENANCE',
      sourceRecordId: net.descriptor.descriptorId,
      extraPayload: { rawPdv: 'pdv payload row' },
    });
    assert.equal(attempt.ok, false);
    if (!attempt.ok) {
      assert.equal(attempt.error.code, 'HIN_ANCHOR_PRIVACY_VIOLATION');
    }
  });

  it('15. credentials are rejected', () => {
    const net = provisionHinChainAnchorFixture();
    const attempt = net.adapter.createAnchorIntent({
      kind: 'USAGE_RECEIPT',
      sourceRecordId: realizeHinUse(net).receipt.receiptId,
      extraPayload: { apiKey: 'sk-live-secret', privateKey: 'hex' },
    });
    assert.equal(attempt.ok, false);
    if (!attempt.ok) {
      assert.equal(attempt.error.code, 'HIN_ANCHOR_PRIVACY_VIOLATION');
    }
  });

  it('16. commitments are deterministic', () => {
    const left = commitHinDomain('hin.anchor.consent.v1', {
      grantId: 'g1',
      consentHash: 'h1',
      policyVersion: 'hin-policy-v1',
    });
    const right = commitHinDomain('hin.anchor.consent.v1', {
      policyVersion: 'hin-policy-v1',
      consentHash: 'h1',
      grantId: 'g1',
    });
    assert.equal(left, right);
  });

  it('17. idempotency keys are deterministic', () => {
    const left = humanInformationAnchorKey({
      kind: 'CONSENT_GRANT',
      sourceRecordId: 'g1',
      sourceRecordVersion: 'hin-policy-v1',
      payloadCommitment: 'p1',
    });
    const right = humanInformationAnchorKey({
      kind: 'CONSENT_GRANT',
      sourceRecordId: 'g1',
      sourceRecordVersion: 'hin-policy-v1',
      payloadCommitment: 'p1',
    });
    assert.equal(left, right);
  });

  it('18. a changed source version creates a distinct anchor', () => {
    const net = provisionHinChainAnchorFixture();
    const first = unwrapAnchor(
      net.adapter.createAnchorIntent({
        kind: 'INFORMATION_RIGHT_STATE',
        sourceRecordId: net.approved.right.rightId,
      }),
    );
    unwrapAnchor(net.engine.revokeInformationConsent({ grantId: net.approved.grant.grantId }));
    const second = unwrapAnchor(
      net.adapter.createAnchorIntent({
        kind: 'INFORMATION_RIGHT_STATE',
        sourceRecordId: net.approved.right.rightId,
      }),
    );
    assert.notEqual(first.anchorId, second.anchorId);
    assert.notEqual(first.payloadCommitment, second.payloadCommitment);
    assert.notEqual(first.sourceRecordVersion, second.sourceRecordVersion);
  });

  it('19. the same source version does not create a duplicate semantic anchor', () => {
    const net = provisionHinChainAnchorFixture();
    const first = unwrapAnchor(
      net.adapter.createAnchorIntent({
        kind: 'CONSENT_GRANT',
        sourceRecordId: net.approved.grant.grantId,
      }),
    );
    const second = unwrapAnchor(
      net.adapter.createAnchorIntent({
        kind: 'CONSENT_GRANT',
        sourceRecordId: net.approved.grant.grantId,
      }),
    );
    assert.equal(first.anchorId, second.anchorId);
    assert.equal(first.intentId, second.intentId);
    assert.equal(net.adapter.listAnchors().length, 1);
  });

  it('20. an anchor cannot mint', () => {
    const net = provisionHinChainAnchorFixture();
    const record = unwrapAnchor(
      net.adapter.createAnchorIntent({
        kind: 'CONSENT_GRANT',
        sourceRecordId: net.approved.grant.grantId,
      }),
    );
    const proof = buildContributionProofAnchorSchema({
      contributionCommitment: 'cmt',
      subjectReference: 'sub',
      purpose: 'purpose',
      receiptReference: 'receipt',
    });
    assert.equal(proof.ok, true);
    if (proof.ok) {
      assert.equal(proof.value.fields.doesNotMint, true);
    }
    assert.equal(record.mintsAsset, false);
    assert.equal(record.createsMonetaryAuthority, false);
    assert.equal(HIN_CHAIN_ANCHOR_INVARIANTS.ANCHOR_MINTS_SUNREY, false);
    assert.equal(HIN_CHAIN_ANCHOR_INVARIANTS.ANCHOR_MINTS_MOONREY, false);
  });

  it('21. an anchor cannot transfer ownership', () => {
    const net = provisionHinChainAnchorFixture();
    const record = unwrapAnchor(
      net.adapter.createAnchorIntent({
        kind: 'INFORMATION_RIGHT_STATE',
        sourceRecordId: net.approved.right.rightId,
      }),
    );
    assert.equal(record.transfersOwnership, false);
    assert.equal(HIN_CHAIN_ANCHOR_INVARIANTS.CHAIN_ANCHOR_TRANSFERS_OWNERSHIP, false);
    assert.equal(HIN_CHAIN_ANCHOR_INVARIANTS.CHAIN_ANCHOR_IS_RIGHTS_EVIDENCE, true);
    assert.equal(net.approved.right.ownershipTransferred, false);
  });

  it('22. SunReyChainService remains the canonical chain owner', () => {
    const net = provisionHinChainAnchorFixture();
    assert.equal(net.adapter.chain instanceof SunReyChainService, true);
    assert.equal(net.adapter.chainOwner, 'packages/sunrey-chain');
    assert.equal(existsSync(join(ROOT, 'packages/hin-chain')), false);
    assert.equal(existsSync(join(ROOT, 'packages/information-blockchain')), false);
    assert.equal(existsSync(join(ROOT, 'packages/privacy-chain')), false);
    assert.equal(existsSync(join(ROOT, 'packages/consent-chain')), false);
    assert.equal(existsSync(join(ROOT, 'packages/human-data-ledger')), false);
    const consent = unwrapAnchor(
      buildConsentAnchorSchema({
        consentId: 'c',
        consentVersion: 'v1',
        consentHash: 'h',
        purposeId: 'p',
        purposeVersion: 'v1',
        subjectReference: 's',
        recipientClass: 'RESEARCH_INSTITUTION',
        scopeCommitment: 'sc',
        effectiveState: 'ACTIVE',
        expirationReference: 'e',
        timestamp: '2026-08-20T08:00:00.000Z',
      }),
    );
    const created = net.chain.createIntent({
      recordType: 'CONSENT_RECEIPT',
      sourceSubsystem: 'information-market',
      sourceRecordReference: 'direct',
      purpose: 'prove-canonical-owner',
      schema: consent,
      policyVersion: 'hin-policy-v1',
      jurisdictionCell: 'GB:SIM',
      correlationId: 'canonical-owner',
    });
    assert.equal(created.ok, true);
  });

  it('23. HIN remains the canonical rights owner', () => {
    const net = provisionHinChainAnchorFixture();
    unwrapAnchor(
      net.adapter.createAnchorIntent({
        kind: 'INFORMATION_RIGHT_STATE',
        sourceRecordId: net.approved.right.rightId,
      }),
    );
    assert.equal(net.adapter.rightsOwner, 'packages/information-market');
    assert.equal(net.engine instanceof HumanInformationNetworkEngine, true);
    assert.equal(net.engine.store.rights.get(net.approved.right.rightId)?.rightId, net.approved.right.rightId);
    assert.equal(HIN_CHAIN_ANCHOR_OWNER.HIN_RIGHTS_OWNER, 'packages/information-market');
    const revocation = unwrapAnchor(net.engine.revokeInformationConsent({ grantId: net.approved.grant.grantId }));
    assert.equal(net.engine.store.rights.get(net.approved.right.rightId)?.status, 'REVOKED');
    assert.equal(revocation.historicalSettlementErased, false);
  });

  it('runs the foundation demo without requiring finality', () => {
    const result = runHinChainAnchorFoundationDemo();
    assert.equal(result.intentCreated, true);
    assert.equal(result.chainRecordType, 'CONSENT_RECEIPT');
    assert.equal(result.CHAIN_OWNER, 'packages/sunrey-chain');
    assert.equal(result.HIN_RIGHTS_OWNER, 'packages/information-market');
    assert.equal(result.RAW_PERSONAL_DATA_ON_CHAIN, false);
    assert.equal(result.ANCHOR_TRANSFERS_OWNERSHIP, false);
    assert.equal(result.ANCHOR_MINTS_SUNREY, false);
    assert.equal(result.ANCHOR_MINTS_MOONREY, false);
    assert.equal(result.PRODUCTION_ACTIVE, false);
  });

  it('does not rewrite historical HIN records when anchoring', () => {
    const net = provisionHinChainAnchorFixture();
    const before = net.engine.store.grants.get(net.approved.grant.grantId);
    unwrapAnchor(
      net.adapter.createAnchorIntent({
        kind: 'CONSENT_GRANT',
        sourceRecordId: net.approved.grant.grantId,
      }),
    );
    const after = net.engine.store.grants.get(net.approved.grant.grantId);
    assert.deepEqual(after, before);
  });

  it('rejects an unknown source and maps revocation schema', () => {
    const net = provisionHinChainAnchorFixture();
    const missing = net.adapter.createAnchorIntent({
      kind: 'CONSENT_GRANT',
      sourceRecordId: 'higrant_missing',
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.error.code, 'HIN_ANCHOR_SOURCE_NOT_FOUND');
    }
    const schema = buildRevocationAnchorSchema({
      consentId: 'c',
      consentVersion: 'v1',
      revocationId: 'r',
      subjectReference: 's',
      revokedAt: '2026-08-20T08:00:00.000Z',
      priorReceiptCommitment: 'p',
    });
    assert.equal(schema.ok, true);
    if (schema.ok) {
      assert.equal(schema.value.recordType, 'CONSENT_REVOCATION');
    }
  });
});

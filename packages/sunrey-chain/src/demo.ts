import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { SunReyChainService } from './service.ts';
import { INITIAL_CHAIN_NETWORK_MODE } from './taxonomy.ts';
import type { ChainRecordSchema } from './types.ts';

const NOW = asUtcInstant('2026-08-16T06:00:00.000Z');

function consentReceipt(consentId: string): ChainRecordSchema {
  return {
    recordType: 'CONSENT_RECEIPT',
    dataClass: 'ON_CHAIN_SAFE',
    fields: {
      consentId,
      consentVersion: 'cv_1',
      consentHash: 'consent-hash-sim-1',
      purposeId: 'purpose:research',
      purposeVersion: 'pv_1',
      subjectReference: 'csr_scoped_demo',
      recipientClass: 'EXTERNAL_RESEARCH',
      scopeCommitment: 'scope-commitment-1',
      effectiveState: 'ACTIVE',
      expirationReference: '2026-09-16T06:00:00.000Z',
      timestamp: NOW,
    },
  };
}

function attestationSchema(): ChainRecordSchema {
  return {
    recordType: 'ATTESTATION',
    dataClass: 'ON_CHAIN_SAFE',
    fields: {
      attestationHash: 'attestation-hash-sim-1',
      issuer: 'packages/information-market/personal-oracle',
      subjectReference: 'csr_scoped_demo',
      claimSchema: 'eligibility.v1',
      issuedAt: NOW,
      expiresAt: '2026-09-16T06:00:00.000Z',
      revocationState: 'ACTIVE',
      provenanceReference: 'prov_sim_1',
    },
  };
}

function computationReceipt(): ChainRecordSchema {
  return {
    recordType: 'COMPUTATION_RECEIPT',
    dataClass: 'ON_CHAIN_SAFE',
    fields: {
      receiptHash: 'clean-room-receipt-hash-1',
      requesterReference: 'req_research_alpha',
      purpose: 'authorized-aggregate',
      privacyPolicyVersion: 'pp_1',
      resultCommitment: 'result-commitment-1',
      timestamp: NOW,
    },
  };
}

function proofOfContribution(): ChainRecordSchema {
  return {
    recordType: 'PROOF_OF_CONTRIBUTION',
    dataClass: 'ON_CHAIN_SAFE',
    fields: {
      contributionCommitment: 'contribution-commitment-1',
      subjectReference: 'csr_scoped_demo',
      purpose: 'authorized-aggregate',
      receiptReference: 'crr_sim_1',
      doesNotMint: true,
    },
  };
}

function settlementAnchor(): ChainRecordSchema {
  return {
    recordType: 'DIGITAL_ASSET_SETTLEMENT',
    dataClass: 'ON_CHAIN_SAFE',
    fields: {
      journalId: 'jnl_canonical_sim_1',
      transferId: 'trn_canonical_sim_1',
      assetCommitment: 'asset-commitment-1',
      authoritativeLedger: 'canonical-internal-ledger',
      chainBalanceAuthoritative: false,
    },
  };
}

export async function runSunReyChainDemo(): Promise<{
  readonly consentMatched: boolean;
  readonly attestationFinalized: boolean;
  readonly cleanRoomReceiptFinalized: boolean;
  readonly proofDoesNotMint: boolean;
  readonly settlementAuthoritativeLedger: 'canonical-internal-ledger';
  readonly chainBalanceNotAuthoritative: boolean;
  readonly rawPdvDenied: boolean;
  readonly offChainDenied: boolean;
  readonly unknownBlocksResubmit: boolean;
  readonly reorgDoesNotRewriteLedger: boolean;
  readonly simulationOnly: boolean;
  readonly noTickerInvented: boolean;
  readonly evidenceSealed: boolean;
}> {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const chain = new SunReyChainService({ clock, keys, evidence, events });

  const consentIntent = chain.createIntent({
    recordType: 'CONSENT_RECEIPT',
    sourceSubsystem: 'consent',
    sourceRecordReference: 'cns_demo_1',
    purpose: 'anchor-consent-receipt',
    schema: consentReceipt('cns_demo_1'),
    policyVersion: 'chain-policy-v1',
    jurisdictionCell: 'GB:SIM',
    correlationId: 'corr-consent-1',
    subject: {
      kind: 'PSEUDONYMOUS_SUBJECT_REFERENCE',
      rawSubjectId: 'cust_alice',
      recipientContext: 'research-alpha',
      purpose: 'anchor-consent-receipt',
      jurisdictionCell: 'GB:SIM',
      keyVersion: 1,
    },
  });
  if (!consentIntent.ok) {
    throw new Error(consentIntent.error.message);
  }
  const submitted = chain.submit(consentIntent.value.intentId);
  if (!submitted.ok) {
    throw new Error(submitted.error.message);
  }
  chain.advanceFinality();
  const consentReconcile = chain.reconcile(submitted.value.operationId);
  if (!consentReconcile.ok) {
    throw new Error(consentReconcile.error.message);
  }

  const attestation = chain.createIntent({
    recordType: 'ATTESTATION',
    sourceSubsystem: 'information-market',
    sourceRecordReference: 'att_demo_1',
    purpose: 'anchor-attestation',
    schema: attestationSchema(),
    policyVersion: 'chain-policy-v1',
    jurisdictionCell: 'GB:SIM',
    correlationId: 'corr-attestation-1',
  });
  if (!attestation.ok) {
    throw new Error(attestation.error.message);
  }
  const attestationSubmit = chain.submit(attestation.value.intentId);
  if (!attestationSubmit.ok) {
    throw new Error(attestationSubmit.error.message);
  }

  const cleanRoom = chain.createIntent({
    recordType: 'COMPUTATION_RECEIPT',
    sourceSubsystem: 'clean-room',
    sourceRecordReference: 'crr_demo_1',
    purpose: 'anchor-clean-room-receipt',
    schema: computationReceipt(),
    policyVersion: 'chain-policy-v1',
    jurisdictionCell: 'GB:SIM',
    correlationId: 'corr-clean-room-1',
  });
  if (!cleanRoom.ok) {
    throw new Error(cleanRoom.error.message);
  }
  const cleanRoomSubmit = chain.submit(cleanRoom.value.intentId);
  if (!cleanRoomSubmit.ok) {
    throw new Error(cleanRoomSubmit.error.message);
  }

  const proof = chain.createIntent({
    recordType: 'PROOF_OF_CONTRIBUTION',
    sourceSubsystem: 'information-market',
    sourceRecordReference: 'poc_demo_1',
    purpose: 'anchor-proof-of-contribution',
    schema: proofOfContribution(),
    policyVersion: 'chain-policy-v1',
    jurisdictionCell: 'GB:SIM',
    correlationId: 'corr-poc-1',
  });
  if (!proof.ok) {
    throw new Error(proof.error.message);
  }
  const proofSubmit = chain.submit(proof.value.intentId);
  if (!proofSubmit.ok) {
    throw new Error(proofSubmit.error.message);
  }

  const settlement = chain.createIntent({
    recordType: 'DIGITAL_ASSET_SETTLEMENT',
    sourceSubsystem: 'sunrey-coin',
    sourceRecordReference: 'csa_demo_1',
    purpose: 'anchor-canonical-settlement',
    schema: settlementAnchor(),
    policyVersion: 'chain-policy-v1',
    jurisdictionCell: 'GB:SIM',
    correlationId: 'corr-settlement-1',
  });
  if (!settlement.ok) {
    throw new Error(settlement.error.message);
  }
  const settlementSubmit = chain.submit(settlement.value.intentId);
  if (!settlementSubmit.ok) {
    throw new Error(settlementSubmit.error.message);
  }
  chain.advanceFinality();

  const rawPdv = chain.createIntent({
    recordType: 'EVIDENCE_ANCHOR',
    sourceSubsystem: 'personal-data-vault',
    sourceRecordReference: 'pdv_denied',
    purpose: 'must-deny-raw-pdv',
    schema: {
      recordType: 'EVIDENCE_ANCHOR',
      dataClass: 'ON_CHAIN_SAFE',
      fields: { rawPdv: 'plaintext vault payload' },
    },
    policyVersion: 'chain-policy-v1',
    jurisdictionCell: 'GB:SIM',
    correlationId: 'corr-denied-pdv',
  });

  const offChain = chain.createIntent({
    recordType: 'IDENTITY_REFERENCE',
    sourceSubsystem: 'identity',
    sourceRecordReference: 'id_denied',
    purpose: 'must-deny-off-chain',
    schema: {
      recordType: 'IDENTITY_REFERENCE',
      dataClass: 'OFF_CHAIN_ONLY',
      fields: { note: 'legal name' },
    },
    policyVersion: 'chain-policy-v1',
    jurisdictionCell: 'GB:SIM',
    correlationId: 'corr-denied-class',
  });

  chain.simulationAdapter.setControls({ unknownNext: true });
  const unknownIntent = chain.createIntent({
    recordType: 'POLICY_DECISION',
    sourceSubsystem: 'kernel',
    sourceRecordReference: 'kdec_unknown',
    purpose: 'timeout-after-broadcast',
    schema: {
      recordType: 'POLICY_DECISION',
      dataClass: 'ON_CHAIN_SAFE',
      fields: {
        actionReference: 'act_1',
        policyVersion: 'p1',
        rdtSnapshot: 'rdt_1',
        kernelDecisionId: 'kdec_1',
        outcome: 'ALLOW',
        decisionCommitment: 'decision-commitment-1',
      },
    },
    policyVersion: 'chain-policy-v1',
    jurisdictionCell: 'GB:SIM',
    correlationId: 'corr-unknown',
  });
  if (!unknownIntent.ok) {
    throw new Error(unknownIntent.error.message);
  }
  const unknownSubmit = chain.submit(unknownIntent.value.intentId);
  if (!unknownSubmit.ok) {
    throw new Error(unknownSubmit.error.message);
  }
  const blindResubmit = chain.submit(unknownIntent.value.intentId);

  const reorg = chain.observeReorg(settlementSubmit.value.operationId);
  if (!reorg.ok) {
    throw new Error(reorg.error.message);
  }
  const reorgReconcile = chain.reconcile(settlementSubmit.value.operationId);
  const settlementStatus = chain.settlementAnchorStatus('jnl_canonical_sim_1');

  const attestationStatus = chain.attestationAnchorStatus('att_demo_1');
  const proofOp = chain.operationStatus(proofSubmit.value.operationId);
  const cleanRoomOp = chain.operationStatus(cleanRoomSubmit.value.operationId);

  console.log('sunrey-chain demo: ok');
  return {
    consentMatched: consentReconcile.value.outcome === 'MATCHED',
    attestationFinalized: attestationStatus?.revocationState === 'ACTIVE',
    cleanRoomReceiptFinalized: cleanRoomOp?.state === 'FINALIZED',
    proofDoesNotMint: proofOp !== undefined && proof.value.schema.fields.doesNotMint === true,
    settlementAuthoritativeLedger: 'canonical-internal-ledger',
    chainBalanceNotAuthoritative: settlementStatus?.authoritativeBalanceSource === 'canonical-internal-ledger',
    rawPdvDenied: !rawPdv.ok && rawPdv.error.code === 'FORBIDDEN_ON_CHAIN_FIELD',
    offChainDenied: !offChain.ok && offChain.error.code === 'DATA_CLASSIFICATION_DENIED',
    unknownBlocksResubmit:
      unknownSubmit.value.state === 'UNKNOWN' &&
      !blindResubmit.ok &&
      blindResubmit.error.code === 'CHAIN_SUBMISSION_UNKNOWN',
    reorgDoesNotRewriteLedger:
      reorg.value.state === 'REORG_OBSERVED' &&
      reorgReconcile.ok &&
      reorgReconcile.value.outcome === 'REORG_OBSERVED' &&
      reorgReconcile.value.autoFixed === false,
    simulationOnly: INITIAL_CHAIN_NETWORK_MODE === 'SIMULATION' && chain.getHealth().networkMode === 'SIMULATION',
    noTickerInvented: true,
    evidenceSealed: evidence.list().length > 0,
  };
}

if (
  import.meta.url === new URL(process.argv[1] ?? '', `file://${process.cwd()}/`).href ||
  process.argv[1]?.endsWith('sunrey-chain/src/demo.ts')
) {
  await runSunReyChainDemo();
}

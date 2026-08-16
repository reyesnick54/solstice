import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { runSunReyChainDemo } from './demo.ts';
import { scopedSubjectCommitment } from './hash.ts';
import { SunReyChainService } from './service.ts';
import { ENGINEERING_FINALITY_POLICY, INITIAL_CHAIN_NETWORK_MODE } from './taxonomy.ts';
import type { ChainRecordSchema } from './types.ts';

const NOW = asUtcInstant('2026-08-16T06:00:00.000Z');
const SRC = join(import.meta.dirname);

function service(): SunReyChainService {
  const clock = new FrozenClock(NOW);
  return new SunReyChainService({
    clock,
    keys: createSimulationKeyProvider({ clock: { now: () => clock.now() } }),
    evidence: new EvidenceVault(clock),
    events: new DomainEventLog(),
  });
}

function safeSchema(recordType: ChainRecordSchema['recordType'], fields: ChainRecordSchema['fields']): ChainRecordSchema {
  return { recordType, dataClass: 'ON_CHAIN_SAFE', fields };
}

describe('sunrey chain', () => {
  it('runs the deterministic trust-layer scenario', async () => {
    const result = await runSunReyChainDemo();
    assert.equal(result.consentMatched, true);
    assert.equal(result.attestationFinalized, true);
    assert.equal(result.cleanRoomReceiptFinalized, true);
    assert.equal(result.proofDoesNotMint, true);
    assert.equal(result.settlementAuthoritativeLedger, 'canonical-internal-ledger');
    assert.equal(result.chainBalanceNotAuthoritative, true);
    assert.equal(result.rawPdvDenied, true);
    assert.equal(result.offChainDenied, true);
    assert.equal(result.unknownBlocksResubmit, true);
    assert.equal(result.reorgDoesNotRewriteLedger, true);
    assert.equal(result.simulationOnly, true);
    assert.equal(result.noTickerInvented, true);
    assert.equal(result.evidenceSealed, true);
  });

  it('scopes subject references and refuses raw sensitive material', () => {
    const chain = service();
    const left = scopedSubjectCommitment({
      kind: 'PSEUDONYMOUS_SUBJECT_REFERENCE',
      rawSubjectId: 'cust_alice',
      recipientContext: 'research-alpha',
      purpose: 'anchor-consent-receipt',
      jurisdictionCell: 'GB:SIM',
      keyVersion: 1,
    });
    const right = scopedSubjectCommitment({
      kind: 'PSEUDONYMOUS_SUBJECT_REFERENCE',
      rawSubjectId: 'cust_alice',
      recipientContext: 'research-beta',
      purpose: 'anchor-consent-receipt',
      jurisdictionCell: 'GB:SIM',
      keyVersion: 1,
    });
    assert.notEqual(left, right);

    const denied = chain.createIntent({
      recordType: 'EVIDENCE_ANCHOR',
      sourceSubsystem: 'personal-data-vault',
      sourceRecordReference: 'pdv_1',
      purpose: 'deny-private-key',
      schema: safeSchema('EVIDENCE_ANCHOR', { privateKey: 'hex' }),
      policyVersion: 'v1',
      jurisdictionCell: 'GB:SIM',
      correlationId: 'corr-key',
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.error.code, 'FORBIDDEN_ON_CHAIN_FIELD');
    }
  });

  it('returns the same operation on idempotent resubmit and blocks unknown resubmit', () => {
    const chain = service();
    const created = chain.createIntent({
      recordType: 'CONSENT_RECEIPT',
      sourceSubsystem: 'consent',
      sourceRecordReference: 'cns_1',
      purpose: 'anchor',
      schema: safeSchema('CONSENT_RECEIPT', {
        consentId: 'cns_1',
        consentVersion: '1',
        consentHash: 'h1',
        purposeId: 'p1',
        purposeVersion: '1',
        subjectReference: 'csr_1',
        recipientClass: 'RESEARCH',
        scopeCommitment: 's1',
        effectiveState: 'ACTIVE',
        expirationReference: NOW,
        timestamp: NOW,
      }),
      policyVersion: 'v1',
      jurisdictionCell: 'GB:SIM',
      correlationId: 'corr-1',
    });
    if (!created.ok) {
      throw new Error(created.error.message);
    }
    const first = chain.submit(created.value.intentId);
    const second = chain.submit(created.value.intentId);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (first.ok && second.ok) {
      assert.equal(first.value.operationId, second.value.operationId);
      assert.equal(first.value.state, 'ACCEPTED');
    }

    chain.simulationAdapter.setControls({ unknownNext: true });
    const unknownIntent = chain.createIntent({
      recordType: 'POLICY_DECISION',
      sourceSubsystem: 'kernel',
      sourceRecordReference: 'kdec_1',
      purpose: 'timeout',
      schema: safeSchema('POLICY_DECISION', {
        actionReference: 'a1',
        policyVersion: 'v1',
        rdtSnapshot: 'r1',
        kernelDecisionId: 'k1',
        outcome: 'ALLOW',
        decisionCommitment: 'd1',
      }),
      policyVersion: 'v1',
      jurisdictionCell: 'GB:SIM',
      correlationId: 'corr-unknown',
    });
    if (!unknownIntent.ok) {
      throw new Error(unknownIntent.error.message);
    }
    const unknown = chain.submit(unknownIntent.value.intentId);
    assert.equal(unknown.ok, true);
    if (unknown.ok) {
      assert.equal(unknown.value.state, 'UNKNOWN');
    }
    const blocked = chain.submit(unknownIntent.value.intentId);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.equal(blocked.error.code, 'CHAIN_SUBMISSION_UNKNOWN');
    }
  });

  it('advances engineering finality and keeps reorg from rewriting financial state', () => {
    const chain = service();
    const created = chain.createIntent({
      recordType: 'DIGITAL_ASSET_SETTLEMENT',
      sourceSubsystem: 'sunrey-coin',
      sourceRecordReference: 'csa_1',
      purpose: 'anchor-settlement',
      schema: safeSchema('DIGITAL_ASSET_SETTLEMENT', {
        journalId: 'jnl_1',
        transferId: 'trn_1',
        assetCommitment: 'a1',
        authoritativeLedger: 'canonical-internal-ledger',
        chainBalanceAuthoritative: false,
      }),
      policyVersion: 'v1',
      jurisdictionCell: 'GB:SIM',
      correlationId: 'corr-settle',
    });
    if (!created.ok) {
      throw new Error(created.error.message);
    }
    const submitted = chain.submit(created.value.intentId);
    if (!submitted.ok) {
      throw new Error(submitted.error.message);
    }
    chain.advanceFinality(ENGINEERING_FINALITY_POLICY.minimumConfirmations);
    const finalized = chain.getOperation(submitted.value.operationId);
    assert.equal(finalized?.state, 'FINALIZED');
    const matched = chain.reconcile(submitted.value.operationId);
    assert.equal(matched.ok, true);
    if (matched.ok) {
      assert.equal(matched.value.outcome, 'MATCHED');
      assert.equal(matched.value.autoFixed, false);
    }
    const reorg = chain.observeReorg(submitted.value.operationId);
    assert.equal(reorg.ok, true);
    if (reorg.ok) {
      assert.equal(reorg.value.state, 'REORG_OBSERVED');
    }
    const afterReorg = chain.reconcile(submitted.value.operationId);
    assert.equal(afterReorg.ok, true);
    if (afterReorg.ok) {
      assert.equal(afterReorg.value.outcome, 'REORG_OBSERVED');
      assert.equal(afterReorg.value.notes.includes('canonical ledger unchanged'), true);
    }
    const status = chain.settlementAnchorStatus('jnl_1');
    assert.equal(status?.authoritativeBalanceSource, 'canonical-internal-ledger');
    assert.equal(INITIAL_CHAIN_NETWORK_MODE, 'SIMULATION');
    assert.equal(ENGINEERING_FINALITY_POLICY.counselStatus, 'RESEARCH_REQUIRED');
    assert.equal(ENGINEERING_FINALITY_POLICY.productionThresholdSelected, false);
  });

  it('does not import ledger posting, Execution Authority, or coin mint in production sources', () => {
    for (const entry of readdirSync(SRC)) {
      if (!entry.endsWith('.ts') || entry.endsWith('.test.ts') || entry === 'demo.ts') {
        continue;
      }
      const source = readFileSync(join(SRC, entry), 'utf8');
      assert.equal(source.includes('postJournal'), false, entry);
      assert.equal(source.includes('AuthorityIssuer'), false, entry);
      assert.equal(source.includes('ExecutionAuthority'), false, entry);
      assert.equal(/from ['"].*sunrey-coin/.test(source), false, entry);
    }
  });
});

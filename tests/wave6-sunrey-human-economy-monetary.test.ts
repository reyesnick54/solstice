/**
 * Wave 6 — SunRey Human Economy monetary pipeline tests.
 *
 * Development/simulation scenarios and failure cases. Production economics
 * remain disabled.
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ProtocolNativeSupplyAuthority } from '../packages/sunrey-chain/src/native-assets/economic-controls.ts';
import { expectedTotal } from '../packages/sunrey-chain/src/economics/supply.ts';
import { emptyClaimRegistry } from '../packages/sunrey-chain/src/economics/proof-bound/claims.ts';
import {
  emptyConsumptionStore,
  isMonetizationKeyConsumed,
  persistConsumptionStore,
  loadConsumptionStore,
  replayConsumptionLog,
  serializeConsumptionStore,
  deserializeConsumptionStore,
} from '../packages/sunrey-chain/src/economics/proof-bound/consumption.ts';
import {
  executeHumanEconomySunReyIssuance,
  type HumanEconomyIssuanceInput,
  type HumanEconomyPipelineContext,
} from '../packages/sunrey-chain/src/economics/human-economy/pipeline.ts';
import {
  FORBIDDEN_MONETARY_AUTHORITIES,
  validateGovernanceAuthorization,
} from '../packages/sunrey-chain/src/economics/human-economy/governance.ts';
import {
  deriveProposedSunReyQuantity,
  productionIssuanceDisabled,
} from '../packages/sunrey-chain/src/economics/human-economy/monetary-policy.ts';
import { PRODUCTION_SUNREY_ISSUANCE_FORMULA_APPROVED } from '../packages/sunrey-chain/src/economics/human-economy/types.ts';
import { createPeveValuationRef } from '../packages/sunrey-chain/src/economics/human-economy/proposal.ts';
import { receiptExplainsCirculation } from '../packages/sunrey-chain/src/economics/human-economy/receipt.ts';
import {
  emptyClaimChallengeRegistry,
  registerClaimChallenge,
  transitionClaimChallenge,
} from '../packages/sunrey-chain/src/economics/human-economy/challenges.ts';
import {
  appendCorrectionRecord,
  automaticCorrectiveBurnForbidden,
  emptyCorrectionRegistry,
} from '../packages/sunrey-chain/src/economics/human-economy/corrections.ts';
import {
  emptyDomainCircuitBreakerRegistry,
  isDomainVerificationPaused,
  pauseDomainVerification,
  circuitBreakerDoesNotHaltBlockchain,
  circuitBreakerDoesNotHaltMoonRey,
  circuitBreakerDoesNotHaltOrdinaryTransfers,
} from '../packages/sunrey-chain/src/economics/human-economy/circuit-breakers.ts';
import {
  emptyHumanEconomyMonitoringStore,
  metricsExcludeSensitivePersonalData,
  snapshotMetrics,
} from '../packages/sunrey-chain/src/economics/human-economy/monitoring.ts';
import {
  fixtureContributionEvent,
  fixturePseudonymousActor,
  fixtureVerificationReceipt,
  HUMAN_ECONOMY_CONTRIBUTION_DOMAINS,
} from '../packages/sunrey-chain/src/economics/human-economy/fixtures.ts';
import type { HumanContributionDomain } from '../packages/sunrey-chain/src/economics/human-economy/types.ts';

const NOW = 1_700_000_000n;

function createContext(): HumanEconomyPipelineContext {
  return {
    authority: new ProtocolNativeSupplyAuthority(),
    claimRegistry: emptyClaimRegistry(),
    consumption: emptyConsumptionStore(),
    challenges: emptyClaimChallengeRegistry(),
    circuitBreakers: emptyDomainCircuitBreakerRegistry(),
    monitoring: emptyHumanEconomyMonitoringStore(),
    blockHeight: 1,
  };
}

function baseInput(domain: HumanContributionDomain, seed: string, peveReferenceValue = 500n): HumanEconomyIssuanceInput {
  const event = fixtureContributionEvent(domain, seed);
  return {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: `acct_${seed}`,
    contributionDomain: domain,
    economicClaimId: `claim.${domain.toLowerCase()}.${seed}`,
    claimFingerprint: event.fingerprint,
    subjectCommitment: fixturePseudonymousActor(seed).actorCommitment,
    canonicalContributionEvent: event,
    pseudonymousActor: fixturePseudonymousActor(seed),
    verificationReceipt: fixtureVerificationReceipt(seed),
    peveReferenceValue,
    governance: {
      authorizationId: `gov.${seed}`,
      authorizedQuantity: '200',
      governancePolicyVersion: 'sunrey.human.governance.v1',
      authorizedBy: 'HUMAN_GOVERNANCE',
    },
    nowUnixSeconds: NOW,
  };
}

describe('Wave 6 Task 1 — audit: no second monetary pipeline', () => {
  it('routes all issuance through Wave 3 proof-bound executeProofBoundSunReyIssuance', () => {
    const ctx = createContext();
    const result = executeHumanEconomySunReyIssuance(ctx, baseInput('RESEARCH', 'audit.1'));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.receipt.receiptKind, 'SUNREY_HUMAN_ECONOMY_ISSUANCE');
      assert.ok(result.supplyTotal > 0n);
    }
  });
});

describe('Wave 6 Task 2 — SunRey issuance proposal', () => {
  it('formalizes proposal with all required references and schema version', () => {
    const ctx = createContext();
    const result = executeHumanEconomySunReyIssuance(ctx, baseInput('WORK', 'proposal.1'));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.proposal.schema, 'sunrey.human-economy.issuance-proposal.v1');
      assert.equal(result.proposal.schemaVersion, 1);
      assert.ok(result.proposal.canonicalContributionEvent.contributionEventId);
      assert.ok(result.proposal.pseudonymousActor.actorCommitment);
      assert.ok(result.proposal.verificationReceipt.receiptId);
      assert.ok(result.proposal.evidenceProofRef);
      assert.ok(result.proposal.rightsProofRef);
      assert.ok(result.proposal.policyProofRef);
      assert.ok(result.proposal.peveValuation.valuationId);
      assert.ok(result.proposal.monetaryPolicy.policyId);
      assert.ok(result.proposal.monetizationKey);
      assert.equal(result.proposal.quantityDerivedFromPeve, false);
    }
  });
});

describe('Wave 6 Task 3 — PEVE / monetary policy boundary', () => {
  it('keeps PEVE reference value separate from proposed SunRey quantity', () => {
    const peve = createPeveValuationRef({
      valuationId: 'peve.boundary',
      methodologyId: 'HIN_VALUATION',
      methodologyVersion: 'hin.valuation.v1',
      referenceValue: '500',
      denomination: 'REFERENCE_UNITS',
    });
    const derived = deriveProposedSunReyQuantity({ peve, network: 'DEVELOPMENT' });
    assert.equal(derived.ok, true);
    if (derived.ok) {
      assert.equal(derived.peveReferenceValue, 500n);
      assert.equal(derived.proposedSunReyQuantity, 200n);
      assert.equal(derived.quantityDerivedFromPeve, false);
    }
  });

  it('rejects PEVE used directly as SunRey amount', () => {
    const peve = createPeveValuationRef({
      valuationId: 'peve.direct',
      methodologyId: 'HIN_VALUATION',
      methodologyVersion: 'hin.valuation.v1',
      referenceValue: '500',
      denomination: 'REFERENCE_UNITS',
    });
    const derived = deriveProposedSunReyQuantity({ peve, network: 'DEVELOPMENT', usePeveAsQuantity: true });
    assert.equal(derived.ok, false);
    if (!derived.ok) assert.equal(derived.code, 'PEVE_EQUALS_SUNREY_QUANTITY_FORBIDDEN');
  });

  it('keeps production issuance disabled', () => {
    assert.equal(PRODUCTION_SUNREY_ISSUANCE_FORMULA_APPROVED, false);
    assert.equal(productionIssuanceDisabled(), true);
    const peve = createPeveValuationRef({
      valuationId: 'peve.mainnet',
      methodologyId: 'HIN_VALUATION',
      methodologyVersion: 'hin.valuation.v1',
      referenceValue: '500',
      denomination: 'REFERENCE_UNITS',
    });
    const derived = deriveProposedSunReyQuantity({ peve, network: 'MAINNET' });
    assert.equal(derived.ok, false);
    if (!derived.ok) assert.equal(derived.code, 'PRODUCTION_SUNREY_ISSUANCE_FORMULA_NOT_APPROVED');
  });
});

describe('Wave 6 Task 4 — governance', () => {
  it('rejects forbidden monetary authorities acting alone', () => {
    for (const actor of FORBIDDEN_MONETARY_AUTHORITIES) {
      const result = validateGovernanceAuthorization({
        authorizationId: `auth.${actor}`,
        authorizedQuantity: '100',
        governancePolicyVersion: 'v1',
        authorizedBy: actor,
      });
      assert.equal(result.ok, false, `expected ${actor} to be rejected`);
      if (!result.ok) assert.equal(result.code, 'FORBIDDEN_MONETARY_AUTHORITY');
    }
  });

  it('accepts canonical HUMAN_GOVERNANCE authorization', () => {
    const result = validateGovernanceAuthorization({
      authorizationId: 'gov.valid',
      authorizedQuantity: '200',
      governancePolicyVersion: 'sunrey.human.governance.v1',
      authorizedBy: 'HUMAN_GOVERNANCE',
    });
    assert.equal(result.ok, true);
  });
});

describe('Wave 6 Task 5 — one-time claim consumption', () => {
  it('prevents the same claim from issuing SunRey twice', () => {
    const ctx = createContext();
    const input = baseInput('EDUCATION', 'once.1');
    const first = executeHumanEconomySunReyIssuance(ctx, input);
    assert.equal(first.ok, true);
    const second = executeHumanEconomySunReyIssuance(ctx, input);
    assert.equal(second.ok, false);
    if (!second.ok) assert.equal(second.code, 'CLAIM_ALREADY_MONETIZED');
  });

  it('survives restart via durable consumption replay', () => {
    const ctx = createContext();
    const input = baseInput('COMPUTATION', 'restart.1');
    const first = executeHumanEconomySunReyIssuance(ctx, input);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const dir = mkdtempSync(join(tmpdir(), 'wave6-consumption-'));
    const file = join(dir, 'consumption.json');
    try {
      persistConsumptionStore(file, ctx.consumption, 1, 'state.commit');
      const loaded = loadConsumptionStore(file);
      assert.ok(loaded);
      assert.equal(isMonetizationKeyConsumed(loaded!.store, first.proposal.monetizationKey), true);
      const replayed = replayConsumptionLog(loaded!.store.appendLog);
      assert.equal(isMonetizationKeyConsumed(replayed, first.proposal.monetizationKey), true);
      const serialized = serializeConsumptionStore(ctx.consumption, 1, 'state.commit');
      const deserialized = deserializeConsumptionStore(serialized);
      assert.equal(isMonetizationKeyConsumed(deserialized, first.proposal.monetizationKey), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('Wave 6 Task 6 — SunRey economic receipt', () => {
  it('answers why SunRey entered circulation without raw personal data', () => {
    const ctx = createContext();
    const result = executeHumanEconomySunReyIssuance(ctx, baseInput('RESEARCH', 'receipt.1'));
    assert.equal(result.ok, true);
    if (result.ok) {
      const explanation = receiptExplainsCirculation(result.receipt);
      assert.match(explanation.why, /entered circulation/);
      assert.equal(result.receipt.containsRawPersonalData, false);
      assert.ok(result.receipt.evidenceRoot);
      assert.ok(result.receipt.rightsRoot);
      assert.ok(result.receipt.policyRoot);
      assert.ok(result.receipt.monetaryStateRoot);
      assert.equal(result.receipt.peveReferenceValue, '500');
      assert.equal(result.receipt.sunReyQuantity, '200');
    }
  });
});

describe('Wave 6 Task 7–8 — claim challenges and post-finality correction', () => {
  it('records append-only challenge and correction without auto burn', () => {
    const ctx = createContext();
    const input = baseInput('WORK', 'challenge.1');
    const issued = executeHumanEconomySunReyIssuance(ctx, input);
    assert.equal(issued.ok, true);
    if (!issued.ok) return;
    const filed = registerClaimChallenge(ctx.challenges!, {
      economicClaimId: input.economicClaimId,
      reason: 'ATTESTATION_REVOKED',
      filedBy: 'HUMAN_GOVERNANCE',
      relatedTransactionId: issued.transactionId,
      filedAtUtc: '2026-09-02T01:00:00.000Z',
    });
    transitionClaimChallenge(ctx.challenges!, filed.challenge.challengeId, 'UPHELD');
    const correction = appendCorrectionRecord(emptyCorrectionRegistry(), {
      economicClaimId: input.economicClaimId,
      challengeId: filed.challenge.challengeId,
      relatedTransactionId: issued.transactionId,
      correctionKind: 'CHALLENGE_UPHELD',
      recordedAtUtc: '2026-09-02T02:00:00.000Z',
    });
    assert.equal(correction.automaticBurnForbidden, true);
    assert.equal(automaticCorrectiveBurnForbidden(), true);
  });
});

describe('Wave 6 Task 9–11 — reputation, circuit breakers, monitoring', () => {
  it('pauses domain verification without halting blockchain, MoonRey, or transfers', () => {
    const registry = emptyDomainCircuitBreakerRegistry();
    pauseDomainVerification(registry, {
      contributionDomain: 'RESEARCH',
      reason: 'attestation provider compromised',
      pausedAtUtc: '2026-09-02T00:00:00.000Z',
      pausedBy: 'HUMAN_GOVERNANCE',
    });
    assert.equal(isDomainVerificationPaused(registry, 'RESEARCH'), true);
    assert.equal(isDomainVerificationPaused(registry, 'WORK'), false);
    assert.equal(circuitBreakerDoesNotHaltBlockchain(), true);
    assert.equal(circuitBreakerDoesNotHaltMoonRey(), true);
    assert.equal(circuitBreakerDoesNotHaltOrdinaryTransfers(), true);
  });

  it('records monitoring metrics without sensitive personal information', () => {
    const ctx = createContext();
    executeHumanEconomySunReyIssuance(ctx, baseInput('RESEARCH', 'metrics.1'));
    const snapshot = snapshotMetrics(ctx.monitoring!);
    assert.equal(snapshot.contributionsSubmitted, 1);
    assert.equal(snapshot.contributionsVerified, 1);
    assert.equal(snapshot.peveCalculations, 1);
    assert.equal(snapshot.sunReyProposals, 1);
    assert.equal(metricsExcludeSensitivePersonalData(snapshot), true);
  });
});

describe('Wave 6 Task 12 — development end-to-end scenarios', () => {
  for (const domain of HUMAN_ECONOMY_CONTRIBUTION_DOMAINS) {
    it(`verified ${domain.toLowerCase()} contribution issues SunRey through full pipeline`, () => {
      const ctx = createContext();
      const before = expectedTotal(ctx.authority.book('SUNREY_COIN'));
      const result = executeHumanEconomySunReyIssuance(ctx, baseInput(domain, `e2e.${domain}`));
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.proposal.status, 'ISSUED');
        assert.ok(expectedTotal(ctx.authority.book('SUNREY_COIN')) > before);
      }
    });
  }
});

describe('Wave 6 Task 13 — failure tests', () => {
  it('rejects raw data only', () => {
    const ctx = createContext();
    const result = executeHumanEconomySunReyIssuance(ctx, { ...baseInput('RESEARCH', 'fail.raw'), rawUserData: true });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'RAW_USER_DATA');
  });

  it('rejects unverified contribution', () => {
    const ctx = createContext();
    const result = executeHumanEconomySunReyIssuance(ctx, {
      ...baseInput('WORK', 'fail.unverified'),
      contributionVerified: false,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'UNVERIFIED_CONTRIBUTION');
  });

  it('rejects duplicate contribution fingerprint', () => {
    const ctx = createContext();
    const shared = baseInput('EDUCATION', 'dup.a');
    assert.equal(executeHumanEconomySunReyIssuance(ctx, shared).ok, true);
    const duplicate = {
      ...baseInput('EDUCATION', 'dup.b'),
      claimFingerprint: shared.claimFingerprint,
      economicClaimId: 'claim.education.dup.b',
    };
    const result = executeHumanEconomySunReyIssuance(ctx, duplicate);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'CLAIM_FINGERPRINT_DUPLICATE');
  });

  it('rejects AI governance approval', () => {
    const result = validateGovernanceAuthorization({
      authorizationId: 'gov.ai',
      authorizedQuantity: '100',
      governancePolicyVersion: 'v1',
      authorizedBy: 'AI',
    });
    assert.equal(result.ok, false);
  });

  it('rejects missing governance', () => {
    const ctx = createContext();
    const input = baseInput('COMPUTATION', 'fail.nogov');
    const result = executeHumanEconomySunReyIssuance(ctx, {
      ...input,
      governance: { ...input.governance, authorizationId: '' },
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'GOVERNANCE_AUTHORIZATION_MISSING');
  });

  it('rejects invalid consent / wrong purpose / inactive policy / tampered evidence', () => {
    const ctx = createContext();
    assert.equal(
      executeHumanEconomySunReyIssuance(ctx, { ...baseInput('RESEARCH', 'fail.rights'), rightsInactive: true }).ok,
      false,
    );
    assert.equal(
      executeHumanEconomySunReyIssuance(ctx, { ...baseInput('RESEARCH', 'fail.purpose'), rightsWrongPurpose: true })
        .ok,
      false,
    );
    assert.equal(
      executeHumanEconomySunReyIssuance(ctx, { ...baseInput('RESEARCH', 'fail.policy'), wrongPeveMethodology: true })
        .ok,
      false,
    );
    const tampered = executeHumanEconomySunReyIssuance(ctx, {
      ...baseInput('RESEARCH', 'fail.tamper'),
      tamperedEvidence: true,
    });
    assert.equal(tampered.ok, false);
    if (!tampered.ok) assert.equal(tampered.code, 'EVIDENCE_COMMITMENT_TAMPERED');
  });

  it('rejects domain verification when circuit breaker paused', () => {
    const ctx = createContext();
    pauseDomainVerification(ctx.circuitBreakers!, {
      contributionDomain: 'RESEARCH',
      reason: 'provider compromised',
      pausedAtUtc: '2026-09-02T00:00:00.000Z',
      pausedBy: 'HUMAN_GOVERNANCE',
    });
    const result = executeHumanEconomySunReyIssuance(ctx, baseInput('RESEARCH', 'fail.breaker'));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'DOMAIN_VERIFICATION_PAUSED');
  });

  it('rejects reused claim after first successful issuance', () => {
    const ctx = createContext();
    const input = baseInput('WORK', 'fail.reuse');
    assert.equal(executeHumanEconomySunReyIssuance(ctx, input).ok, true);
    const reused = executeHumanEconomySunReyIssuance(ctx, {
      ...input,
      governance: { ...input.governance, authorizationId: 'gov.reuse.new' },
    });
    assert.equal(reused.ok, false);
    if (!reused.ok) assert.equal(reused.code, 'CLAIM_ALREADY_MONETIZED');
  });
});

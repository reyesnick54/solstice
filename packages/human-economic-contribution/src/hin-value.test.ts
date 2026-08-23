import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import { subjectRefFor } from './ids.ts';
import { HUMAN_CONTRIBUTION_ISOLATION } from './isolation.ts';
import {
  HIN_AI_ROLE,
  HIN_CATEGORY_REGISTRY,
  HIN_PRODUCT_CATEGORIES,
  HIN_VERIFICATION_STATES,
  HinEconomicValueEngine,
  aiClassifyCategory,
  refuseAiAuthority,
  refuseHinMint,
} from './hin-value/index.ts';
import type { HinActor, HinSubmitInput } from './hin-value/index.ts';

const NOW = asUtcInstant('2026-08-23T12:00:00.000Z');
const SUBJECT = subjectRefFor('synthetic-contributor-ada');
const SOURCE: HinActor = { kind: 'AUTHORIZED_SOURCE', actorId: 'hin.source.1' };
const VERIFIER: HinActor = { kind: 'AUTHORIZED_VERIFIER', actorId: 'hin.verifier.1' };
const FRONTEND: HinActor = { kind: 'FRONTEND', actorId: 'lovable' };
const AGENT: HinActor = { kind: 'AGENT', actorId: 'agent.1' };
const AI: HinActor = { kind: 'AI', actorId: 'model.1' };
const GOVERNANCE: HinActor = { kind: 'GOVERNANCE', actorId: 'gov.1' };

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { code: string; message: string } }): T {
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}

function submit(engine: HinEconomicValueEngine, overrides: Partial<HinSubmitInput> = {}, actor: HinActor = SOURCE) {
  return engine.submitFromAuthorizedSource(
    {
      subject: SUBJECT,
      category: 'RESEARCH_CONTRIBUTION',
      sourceReference: 'research.session.1',
      observedAt: NOW,
      createdAt: NOW,
      quantity: 1n,
      qualityBps: 8_000n,
      confidenceBps: 8_000n,
      purpose: 'AGGREGATED_RESEARCH',
      consentReference: 'consent.research.1',
      ...overrides,
    },
    actor,
  );
}

describe('Phase H HIN Economic Value Engine', () => {
  it('keeps the canonical registry owner and does not mint', () => {
    assert.equal(HUMAN_CONTRIBUTION_ISOLATION.owner, 'packages/human-economic-contribution');
    assert.equal(HUMAN_CONTRIBUTION_ISOLATION.mintingImplemented, false);
    assert.equal(HIN_CATEGORY_REGISTRY.productionActivated, false);
    assert.equal(HIN_PRODUCT_CATEGORIES.includes('KNOWLEDGE'), true);
    assert.equal(HIN_VERIFICATION_STATES.includes('SYSTEM_VERIFIED'), true);
    const mint = refuseHinMint();
    assert.equal(mint.ok, false);
    if (!mint.ok) {
      assert.equal(mint.error.code, 'MINT_FORBIDDEN');
    }
  });

  it('records an authorized-source contribution with provenance and no raw personal data', () => {
    const engine = new HinEconomicValueEngine();
    const recorded = unwrap(submit(engine));
    assert.equal(recorded.category, 'RESEARCH_CONTRIBUTION');
    assert.equal(recorded.canonicalClass, 'RESEARCH_PARTICIPATION');
    assert.equal(recorded.containsRawPersonalData, false);
    assert.equal(recorded.sunReyQuantity, null);
    assert.equal(recorded.mintRequested, false);
    assert.ok(recorded.provenance.source);
    assert.ok(recorded.provenance.method);
    assert.ok(recorded.provenance.observedAt);
    assert.ok(recorded.provenance.integrityDigest);
    assert.ok(recorded.evidenceDigest.length > 0);
    assert.equal('email' in recorded, false);
    assert.equal('legalName' in recorded, false);
  });

  it('verifies through an authorized verifier and computes a deterministic economic value input', () => {
    const engine = new HinEconomicValueEngine();
    const recorded = unwrap(submit(engine));
    assert.notEqual(recorded.verification, 'SYSTEM_VERIFIED');
    const verified = unwrap(engine.verify(recorded.contributionId, VERIFIER, NOW));
    assert.equal(verified.verification, 'SYSTEM_VERIFIED');
    const value = engine.computeValueInput(recorded.contributionId, NOW);
    assert.equal(value.ok, true);
    if (value.ok) {
      assert.equal(value.value.isMintAmount, false);
      assert.equal(value.value.isSunReyQuantity, false);
      assert.equal(value.value.isMarketPrice, false);
      assert.equal(value.value.methodologyId, 'hin-evi-governed-schedule');
      assert.equal(value.value.normalizedValue > 0n, true);
      assert.ok(value.value.provenanceDigest.length > 0);
    }
  });

  it('prevents duplicate and replayed source events', () => {
    const engine = new HinEconomicValueEngine();
    unwrap(submit(engine));
    const replay = submit(engine);
    assert.equal(replay.ok, false);
    if (!replay.ok) {
      assert.ok(replay.error.code === 'REPLAYED_EVENT' || replay.error.code === 'DUPLICATE_CONTRIBUTION');
    }
  });

  it('refuses anonymous contributions and consent-bound categories without consent', () => {
    const engine = new HinEconomicValueEngine();
    const anonymous = submit(engine, { subject: subjectRefFor('anonymous') });
    assert.equal(anonymous.ok, false);
    if (!anonymous.ok) {
      assert.equal(anonymous.error.code, 'ANONYMOUS_CONTRIBUTION_FORBIDDEN');
    }
    const noConsent = submit(engine, { sourceReference: 'data.1', category: 'DATA_CONTRIBUTION', consentReference: undefined, rightsReference: 'right.1' });
    assert.equal(noConsent.ok, false);
    if (!noConsent.ok) {
      assert.equal(noConsent.error.code, 'CONSENT_REQUIRED');
    }
  });

  it('applies quality weighting, methodology caps, and quality thresholds', () => {
    const engine = new HinEconomicValueEngine();
    const low = unwrap(submit(engine, { qualityBps: 1_000n, sourceReference: 'research.low' }));
    unwrap(engine.verify(low.contributionId, VERIFIER, NOW));
    const refused = engine.computeValueInput(low.contributionId, NOW);
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.error.code, 'QUALITY_BELOW_THRESHOLD');
    }
    const huge = unwrap(
      submit(engine, {
        sourceReference: 'research.huge',
        quantity: 1_000_000n,
        qualityBps: 8_000n,
      }),
    );
    unwrap(engine.verify(huge.contributionId, VERIFIER, NOW));
    const capped = unwrap(engine.computeValueInput(huge.contributionId, NOW));
    assert.equal(capped.normalizedValue <= 10_000n, true);
    assert.ok(engine.anomalyFlags().some((flag) => flag.code === 'QUANTITY_SPIKE' && flag.determinesMint === false));
  });

  it('supports disputes and keeps historical evidence after invalidation', () => {
    const engine = new HinEconomicValueEngine();
    const recorded = unwrap(submit(engine));
    unwrap(engine.verify(recorded.contributionId, VERIFIER, NOW));
    const dispute = unwrap(
      engine.challenge(
        { contributionId: recorded.contributionId, kind: 'CHALLENGE_CONTRIBUTION', reasonCode: 'SOURCE_CONTESTED', at: NOW },
        GOVERNANCE,
      ),
    );
    assert.equal(dispute.state, 'OPEN');
    assert.equal(dispute.historicalEvidencePreserved, true);
    const disputed = engine.get(recorded.contributionId);
    assert.equal(disputed?.verification, 'DISPUTED');
    const upheld = unwrap(engine.resolveDispute({ disputeId: dispute.disputeId, outcome: 'UPHELD', at: NOW }, GOVERNANCE));
    assert.equal(upheld.state, 'UPHELD');
    const invalidated = engine.get(recorded.contributionId);
    assert.equal(invalidated?.verification, 'INVALIDATED');
    assert.ok(engine.registry.getRecord(recorded.contributionId));
    assert.equal(engine.proposeIssuanceBasis(recorded.contributionId).ok, false);
  });

  it('suppresses geographic aggregates below the privacy threshold', () => {
    const engine = new HinEconomicValueEngine();
    for (let index = 0; index < 3; index += 1) {
      const recorded = unwrap(
        submit(engine, {
          subject: subjectRefFor(`geo-${index}`),
          sourceReference: `research.geo.${index}`,
          jurisdiction: 'GB',
        }),
      );
      unwrap(engine.verify(recorded.contributionId, VERIFIER, NOW));
    }
    const metrics = engine.metrics();
    assert.equal(metrics.suppression.individualRecordsExposed, false);
    assert.equal(metrics.geographicSummaries.length, 0);
    assert.equal(metrics.suppression.jurisdictionsSuppressed >= 1, true);
    assert.equal(metrics.verifiedContributors, 3);
    assert.equal(JSON.stringify(metrics).includes('geo-0'), false);
  });

  it('separates economic value inputs from SunRey issuance and refuses mint', () => {
    const engine = new HinEconomicValueEngine();
    const recorded = unwrap(submit(engine));
    unwrap(engine.verify(recorded.contributionId, VERIFIER, NOW));
    unwrap(engine.computeValueInput(recorded.contributionId, NOW));
    const proposal = unwrap(engine.proposeIssuanceBasis(recorded.contributionId));
    assert.equal(proposal.kind, 'ECONOMIC_INPUT_ISSUANCE_BASIS');
    assert.equal(proposal.mintRequested, false);
    assert.equal(proposal.sunReyQuantity, null);
    assert.equal(proposal.requiresPhaseGGovernance, true);
    assert.equal(proposal.requiresNativeAssetAuthority, true);
    assert.equal(engine.authorizeMint().ok, false);
  });

  it('refuses Agent minting, Agent verification, frontend verification, and AI authority', () => {
    const engine = new HinEconomicValueEngine();
    const recorded = unwrap(submit(engine));
    assert.equal(engine.verify(recorded.contributionId, FRONTEND, NOW).ok, false);
    assert.equal(engine.verify(recorded.contributionId, AGENT, NOW).ok, false);
    assert.equal(engine.verify(recorded.contributionId, AI, NOW).ok, false);
    const agentSubmit = submit(engine, { sourceReference: 'agent.1' }, AGENT);
    assert.equal(agentSubmit.ok, false);
    assert.equal(HIN_AI_ROLE.mayDeclareVerified, false);
    assert.equal(HIN_AI_ROLE.maySetMintAmount, false);
    assert.equal(refuseAiAuthority(AI, 'mint').ok, false);
    assert.equal(aiClassifyCategory({ proposedCategory: 'RESEARCH_CONTRIBUTION' }).ok, true);
    assert.equal(aiClassifyCategory({ proposedCategory: 'BIOMETRIC_WORTH' }).ok, false);
  });

  it('exposes a customer contribution view without promising issuance', () => {
    const engine = new HinEconomicValueEngine();
    const recorded = unwrap(submit(engine));
    unwrap(engine.verify(recorded.contributionId, VERIFIER, NOW));
    unwrap(engine.computeValueInput(recorded.contributionId, NOW));
    const summary = engine.customerSummary(SUBJECT);
    assert.equal(summary.issuancePromised, false);
    assert.equal(summary.compensation.mintRequested, false);
    assert.equal(summary.verified.length, 1);
    assert.equal(summary.economicValueInputs[0]?.isMintAmount, false);
    assert.equal(summary.productionActivated, false);
  });
});

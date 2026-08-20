import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_EXCHANGE_ENABLED, LIVE_MONEY_ENABLED } from '../../config/src/flags.ts';
import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';

import { defaultDimensionCatalog } from './mainnet/dimensions.ts';
import { DEFAULT_PRODUCTION_POLICY, ENGINEERING_ONLY_POLICY, evaluateReadiness } from './mainnet/evaluator.ts';
import {
  AI_CAN_VERIFY_EXTERNAL_EVIDENCE,
  CONFIDENTIAL_DOCUMENT_ON_CHAIN,
  EXPIRED_EVIDENCE_COUNTS,
  ExternalEvidenceRegistry,
  FIXTURE_COUNTS_AS_EXTERNAL,
  isExternalProductionEvidenceClass,
  PRODUCTION_ACTIVE,
  REVOKED_EVIDENCE_COUNTS,
  STRING_SLOT_SATISFIES_EXTERNAL_READINESS,
  VERIFIED_EVIDENCE_SCOPE_BOUND,
  VERIFIED_FOR_PRODUCTION_STATE_EXISTS,
  bindReadinessRecordToRegistry,
  confidentialContentsAbsentFromPublicView,
  counselOpinionDraft,
  externalEvidenceCommitmentHash,
  externalLookingDraft,
  fixtureSecurityAuditDraft,
  providerAgreementDraft,
  publicSafeView,
  recordCommitmentHash,
  regulatoryApprovalDraft,
  requiredVerifierRoles,
  sealExternalEvidenceCommitment,
  stringSlotSatisfiesExternalReadiness,
  supersededPreservesHistory,
  verificationSurvivesSemanticChange,
} from './mainnet/index.ts';
import { activationFirewallConsumesRegistryOnly, currentRepositorySnapshot, evaluateProductionEconomicActivation, withSnapshot } from './economics/production-activation/index.ts';
import { evaluateEligibility, runHsmContractSuite } from './providers/index.ts';

const NOW = '2026-08-20T00:00:00.000Z';
const ROOT = join(import.meta.dirname, '..', '..', '..');

const HUMAN_SECURITY = {
  kind: 'HUMAN' as const,
  actorId: 'human.security.1',
  role: 'SECURITY_AUTHORITY' as const,
};
const HUMAN_COUNSEL = {
  kind: 'HUMAN' as const,
  actorId: 'human.counsel.1',
  role: 'COUNSEL' as const,
};
const HUMAN_REGULATOR = {
  kind: 'HUMAN' as const,
  actorId: 'regulator.1',
  role: 'REGULATOR' as const,
};
const HUMAN_COMMERCIAL = {
  kind: 'HUMAN' as const,
  actorId: 'human.commercial.1',
  role: 'COMMERCIAL_REVIEWER' as const,
};

function must<T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }): T {
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

describe('Chunk 160 external production evidence registry', () => {
  it('1. record hash is deterministic', () => {
    const draft = externalLookingDraft();
    const first = externalEvidenceCommitmentHash({
      ...draft,
      scope: {
        label: 'SUNREY_CHAIN/EXTERNAL_SECURITY_REVIEW',
        global: false,
        jurisdictions: ['US'],
        activationDomains: ['SUNREY_CHAIN'],
        providerDomains: [],
      },
      jurisdictions: ['US'],
      activationDomains: ['SUNREY_CHAIN'],
      providerDomains: [],
      issuedAtUtc: draft.issuedAtUtc ?? null,
      validFromUtc: draft.validFromUtc ?? null,
      expiresAtUtc: draft.expiresAtUtc ?? null,
      reviewDueAtUtc: draft.reviewDueAtUtc ?? null,
      fixture: false,
      engineeringOnly: false,
      confidential: true,
      version: 1,
      previousVersionId: null,
    });
    const second = externalEvidenceCommitmentHash({
      ...draft,
      scope: {
        label: 'SUNREY_CHAIN/EXTERNAL_SECURITY_REVIEW',
        global: false,
        jurisdictions: ['US'],
        activationDomains: ['SUNREY_CHAIN'],
        providerDomains: [],
      },
      jurisdictions: ['US'],
      activationDomains: ['SUNREY_CHAIN'],
      providerDomains: [],
      issuedAtUtc: draft.issuedAtUtc ?? null,
      validFromUtc: draft.validFromUtc ?? null,
      expiresAtUtc: draft.expiresAtUtc ?? null,
      reviewDueAtUtc: draft.reviewDueAtUtc ?? null,
      fixture: false,
      engineeringOnly: false,
      confidential: true,
      version: 1,
      previousVersionId: null,
    });
    assert.equal(first, second);
    assert.match(first, /^[0-9a-f]{64}$/);
  });

  it('2-4. scope, jurisdiction, and expiration are bound into the hash', () => {
    const registry = new ExternalEvidenceRegistry();
    const record = must(registry.register(externalLookingDraft()));
    const baseline = record.commitmentHash;
    const scopeChanged = must(
      registry.register(externalLookingDraft({ recordId: 'hash-scope', scope: { label: 'other', jurisdictions: ['US'] } })),
    );
    const jurisdictionChanged = must(
      registry.register(
        externalLookingDraft({ recordId: 'hash-jurisdiction', scope: { label: record.scope.label, jurisdictions: ['GB'] } }),
      ),
    );
    const expirationChanged = must(
      registry.register(externalLookingDraft({ recordId: 'hash-exp', expiresAtUtc: '2028-01-01T00:00:00.000Z' })),
    );
    assert.notEqual(scopeChanged.commitmentHash, baseline);
    assert.notEqual(jurisdictionChanged.commitmentHash, baseline);
    assert.notEqual(expirationChanged.commitmentHash, baseline);
  });

  it('5. modified scope invalidates verification', () => {
    const registry = new ExternalEvidenceRegistry();
    const record = must(registry.register(externalLookingDraft()));
    const verified = must(registry.verify(record.recordId, HUMAN_SECURITY, NOW));
    assert.equal(verified.verificationState, 'VERIFIED_EXTERNAL');
    assert.equal(verificationSurvivesSemanticChange(verified), true);
    const changed = must(registry.replaceFields(record.recordId, { scope: { label: 'CHANGED', jurisdictions: ['US'] } }));
    assert.equal(changed.verificationState, 'PROVIDED_UNVERIFIED');
    assert.equal(changed.verificationBindingHash, null);
    assert.equal(verificationSurvivesSemanticChange(changed), false);
  });

  it('6. fixture cannot satisfy production', () => {
    const registry = new ExternalEvidenceRegistry();
    const fixture = must(registry.register(fixtureSecurityAuditDraft()));
    const verified = must(registry.verify(fixture.recordId, HUMAN_SECURITY, NOW));
    assert.equal(verified.fixture, true);
    assert.equal(verified.engineeringOnly, true);
    assert.equal(verified.verificationState, 'VERIFIED_ENGINEERING_FIXTURE');
    assert.equal(
      registry.productionEligible({
        evidenceClass: 'EXTERNAL_SECURITY_AUDIT',
        subjectId: 'EXTERNAL_SECURITY_REVIEW',
        nowUtc: NOW,
        production: true,
      }),
      false,
    );
    assert.equal(FIXTURE_COUNTS_AS_EXTERNAL, false);
    assert.equal(VERIFIED_FOR_PRODUCTION_STATE_EXISTS, false);
  });

  it('7. AI cannot verify', () => {
    const registry = new ExternalEvidenceRegistry();
    const record = must(registry.register(externalLookingDraft()));
    for (const actor of [
      { kind: 'AI' as const, actorId: 's3m-primary', role: 'SECURITY_AUTHORITY' as const },
      { kind: 'S3M' as const, actorId: 's3m', role: 'SECURITY_AUTHORITY' as const },
      { kind: 'GROK' as const, actorId: 'grok', role: 'SECURITY_AUTHORITY' as const },
      { kind: 'AUTOMATION' as const, actorId: 'bot-1', role: 'SECURITY_AUTHORITY' as const },
    ]) {
      const result = registry.verify(record.recordId, actor, NOW);
      assert.equal(result.ok, false, actor.kind);
    }
    assert.equal(AI_CAN_VERIFY_EXTERNAL_EVIDENCE, false);
  });

  it('8. external audit needs a proper verifier role', () => {
    const registry = new ExternalEvidenceRegistry();
    const record = must(registry.register(externalLookingDraft()));
    const commercial = registry.verify(record.recordId, HUMAN_COMMERCIAL, NOW);
    assert.equal(commercial.ok, false);
    const security = must(registry.verify(record.recordId, HUMAN_SECURITY, NOW));
    assert.equal(security.verificationState, 'VERIFIED_EXTERNAL');
    assert.deepEqual([...requiredVerifierRoles('EXTERNAL_SECURITY_AUDIT')].sort(), ['EXTERNAL_AUDITOR', 'SECURITY_AUTHORITY']);
  });

  it('9. counsel opinion needs a proper verifier role', () => {
    const registry = new ExternalEvidenceRegistry();
    const record = must(registry.register(counselOpinionDraft()));
    const security = registry.verify(record.recordId, HUMAN_SECURITY, NOW);
    assert.equal(security.ok, false);
    const counsel = must(registry.verify(record.recordId, HUMAN_COUNSEL, NOW));
    assert.equal(counsel.verificationState, 'VERIFIED_EXTERNAL');
  });

  it('10. regulatory evidence cannot be self-declared by software', () => {
    const registry = new ExternalEvidenceRegistry();
    const record = must(registry.register(regulatoryApprovalDraft()));
    const software = registry.verify(
      record.recordId,
      { kind: 'AUTOMATION', actorId: 'service.compliance', role: 'REGULATOR' },
      NOW,
    );
    assert.equal(software.ok, false);
    const counsel = registry.verify(record.recordId, HUMAN_COUNSEL, NOW);
    assert.equal(counsel.ok, false);
    const regulator = must(registry.verify(record.recordId, HUMAN_REGULATOR, NOW));
    assert.equal(regulator.verificationState, 'VERIFIED_EXTERNAL');
  });

  it('11. provider agreement is scoped correctly', () => {
    const registry = new ExternalEvidenceRegistry();
    const record = must(registry.register(providerAgreementDraft()));
    must(registry.verify(record.recordId, HUMAN_COMMERCIAL, NOW));
    assert.equal(
      registry.productionEligible({
        evidenceClass: 'SERVICE_CONTRACT',
        subjectId: 'rail-provider-1',
        providerDomain: 'PAYMENT_RAIL',
        jurisdiction: 'US',
        nowUtc: NOW,
        production: true,
      }),
      true,
    );
    assert.equal(
      registry.productionEligible({
        evidenceClass: 'SERVICE_CONTRACT',
        subjectId: 'rail-provider-1',
        providerDomain: 'FX_LIQUIDITY',
        jurisdiction: 'US',
        nowUtc: NOW,
        production: true,
      }),
      false,
    );
    assert.equal(
      registry.productionEligible({
        evidenceClass: 'SERVICE_CONTRACT',
        subjectId: 'rail-provider-1',
        providerDomain: 'PAYMENT_RAIL',
        jurisdiction: 'GB',
        nowUtc: NOW,
        production: true,
      }),
      false,
    );
    assert.equal(VERIFIED_EVIDENCE_SCOPE_BOUND, true);
  });

  it('12. expired evidence blocks readiness', () => {
    const registry = new ExternalEvidenceRegistry();
    const record = must(registry.register(externalLookingDraft({ expiresAtUtc: '2026-01-01T00:00:00.000Z' })));
    const verify = registry.verify(record.recordId, HUMAN_SECURITY, NOW);
    assert.equal(verify.ok, false);
    const live = must(registry.register(externalLookingDraft({ recordId: 'live-then-expire' })));
    const verified = must(registry.verify(live.recordId, HUMAN_SECURITY, NOW));
    const slot = defaultDimensionCatalog().find((row) => row.requirementId === 'REQ-EXT-SEC-001');
    assert.ok(slot);
    const focused = { ...DEFAULT_PRODUCTION_POLICY, requiredDimensions: ['EXTERNAL_SECURITY_REVIEW'] as const };
    const ready = evaluateReadiness([bindReadinessRecordToRegistry(slot, verified)], [], focused, {
      registry,
      nowUtc: NOW,
    });
    assert.equal(ready, 'AWAITING_HUMAN_AUTHORIZATION');
    const expired = must(registry.replaceFields(live.recordId, { expiresAtUtc: '2026-01-01T00:00:00.000Z' }));
    registry.refresh(NOW);
    const blocked = evaluateReadiness([bindReadinessRecordToRegistry(slot, expired)], [], focused, {
      registry,
      nowUtc: NOW,
    });
    assert.equal(blocked, 'AWAITING_EXTERNAL_EVIDENCE');
    assert.equal(EXPIRED_EVIDENCE_COUNTS, false);
  });

  it('13. revoked evidence blocks readiness', () => {
    const registry = new ExternalEvidenceRegistry();
    const record = must(registry.register(externalLookingDraft()));
    const verified = must(registry.verify(record.recordId, HUMAN_SECURITY, NOW));
    const slot = defaultDimensionCatalog().find((row) => row.requirementId === 'REQ-EXT-SEC-001');
    assert.ok(slot);
    const focused = { ...DEFAULT_PRODUCTION_POLICY, requiredDimensions: ['EXTERNAL_SECURITY_REVIEW'] as const };
    must(registry.revoke(record.recordId, NOW, 'contract terminated'));
    const blocked = evaluateReadiness([bindReadinessRecordToRegistry(slot, verified)], [], focused, {
      registry,
      nowUtc: NOW,
    });
    assert.equal(blocked, 'AWAITING_EXTERNAL_EVIDENCE');
    assert.equal(REVOKED_EVIDENCE_COUNTS, false);
  });

  it('14. superseded evidence preserves history', () => {
    const registry = new ExternalEvidenceRegistry();
    const first = must(registry.register(externalLookingDraft()));
    must(registry.verify(first.recordId, HUMAN_SECURITY, NOW));
    const pair = must(
      registry.supersede(first.recordId, externalLookingDraft({ recordId: 'ext-ev-security-audit-v2' }), NOW),
    );
    assert.equal(pair.previous.verificationState, 'SUPERSEDED');
    assert.equal(registry.get(first.recordId)?.verificationState, 'SUPERSEDED');
    assert.equal(pair.next.previousVersionId, first.recordId);
    assert.equal(supersededPreservesHistory(pair.previous, pair.next), true);
    assert.equal(registry.list().length, 2);
  });

  it('15. confidential contents are absent from public view', () => {
    const registry = new ExternalEvidenceRegistry();
    const record = must(registry.register(externalLookingDraft({ confidential: true })));
    const view = publicSafeView(record, NOW);
    assert.equal(view.confidentialDocumentPresent, false);
    assert.equal(view.rawDocumentOnChain, false);
    assert.equal(view.issuerOrSource, null);
    assert.equal(view.referenceLocator, null);
    assert.equal(confidentialContentsAbsentFromPublicView(record, NOW), true);
    assert.equal(CONFIDENTIAL_DOCUMENT_ON_CHAIN, false);
    const vault = new EvidenceVault(new FrozenClock(asUtcInstant(NOW)));
    const sealed = sealExternalEvidenceCommitment(vault, record, NOW);
    assert.equal(JSON.stringify(sealed.payload).includes('WHEREAS'), false);
    assert.equal((sealed.payload as { confidentialDocumentPresent: boolean }).confidentialDocumentPresent, false);
  });

  it('16. verified registry reference integrates with mainnet readiness', () => {
    const registry = new ExternalEvidenceRegistry();
    const record = must(registry.register(externalLookingDraft()));
    const verified = must(registry.verify(record.recordId, HUMAN_SECURITY, NOW));
    const slot = defaultDimensionCatalog().find((row) => row.requirementId === 'REQ-EXT-SEC-001');
    assert.ok(slot);
    assert.equal(stringSlotSatisfiesExternalReadiness({ reviewReference: 'slot-only', reportHash: 'abc', status: 'HUMAN_VERIFIED' }), false);
    assert.equal(STRING_SLOT_SATISFIES_EXTERNAL_READINESS, false);
    const focused = { ...DEFAULT_PRODUCTION_POLICY, requiredDimensions: ['EXTERNAL_SECURITY_REVIEW'] as const };
    const unbound = evaluateReadiness([slot], [], focused, { nowUtc: NOW });
    assert.equal(unbound, 'AWAITING_EXTERNAL_EVIDENCE');
    const bound = evaluateReadiness([bindReadinessRecordToRegistry(slot, verified)], [], focused, {
      registry,
      nowUtc: NOW,
    });
    assert.equal(bound, 'AWAITING_HUMAN_AUTHORIZATION');
    assert.notEqual(evaluateReadiness(defaultDimensionCatalog(), [], DEFAULT_PRODUCTION_POLICY), 'AUTHORIZED_CANDIDATE');
    assert.equal(evaluateReadiness(defaultDimensionCatalog(), [], ENGINEERING_ONLY_POLICY), 'AWAITING_HUMAN_AUTHORIZATION');
  });

  it('17. provider acceptance consumes current evidence', () => {
    const registry = new ExternalEvidenceRegistry();
    const contract = must(
      registry.register(
        providerAgreementDraft({
          recordId: 'hsm-contract',
          subjectId: 'hsm-local',
          scope: { label: 'HSM', providerDomains: ['HSM'], jurisdictions: ['US'] },
        }),
      ),
    );
    must(registry.verify(contract.recordId, HUMAN_COMMERCIAL, NOW));
    const suite = runHsmContractSuite();
    const withoutRegistry = evaluateEligibility({
      providerId: suite.providerId,
      domain: suite.domain,
      configured: true,
      suite,
      evidence: [],
      humanAccepted: true,
      humanReviewerKind: 'HUMAN',
      nowUtc: NOW,
    });
    assert.equal(withoutRegistry.productionEligible, false);
    const withStaleRegistry = evaluateEligibility({
      providerId: suite.providerId,
      domain: suite.domain,
      configured: true,
      suite,
      evidence: [],
      humanAccepted: true,
      humanReviewerKind: 'HUMAN',
      nowUtc: NOW,
      externalRegistry: {
        productionEligible: (query) => {
          if (!isExternalProductionEvidenceClass(query.evidenceClass)) {
            return false;
          }
          return registry.productionEligible({
            evidenceClass: query.evidenceClass,
            subjectType: query.subjectType as import('./mainnet/external-evidence/types.ts').ExternalEvidenceSubjectType | undefined,
            subjectId: query.subjectId,
            jurisdiction: query.jurisdiction,
            providerDomain: query.providerDomain,
            nowUtc: query.nowUtc,
            production: query.production,
          });
        },
      },
    });
    assert.equal(withStaleRegistry.productionEligible, false);
    assert.ok(withStaleRegistry.missingRequirements.some((row) => row.includes('REGISTRY_NOT_CURRENT') || row.includes('MISSING')));
  });

  it('18. activation firewall remains evaluator-only', () => {
    const registry = new ExternalEvidenceRegistry();
    must(registry.register(fixtureSecurityAuditDraft()));
    const snapshot = withSnapshot(currentRepositorySnapshot(), {
      externalEvidenceRegistry: registry.snapshot(NOW),
    });
    const decision = evaluateProductionEconomicActivation(snapshot);
    assert.equal(decision.productionActivated, false);
    assert.equal(decision.liveFlagsChanged, false);
    const consumed = activationFirewallConsumesRegistryOnly(snapshot);
    assert.equal(consumed.evaluatorOnly, true);
    assert.equal(consumed.productionActivated, false);
    assert.equal(consumed.registryConsumed, true);
    assert.equal(consumed.fixtureSatisfiesProduction, false);
    assert.equal('activateProduction' in decision, false);
  });

  it('19-20. no LIVE flags changed and production remains inactive', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
    assert.equal(PRODUCTION_ACTIVE, false);
    assert.equal(recordCommitmentHash(must(new ExternalEvidenceRegistry().register(externalLookingDraft()))).length, 64);
  });

  it('declares the chunk without competing packages', () => {
    assert.equal(existsSync(join(ROOT, 'docs/architecture/chunks/chunk-160.json')), true);
    assert.equal(existsSync(join(ROOT, 'docs/operations/chunk-160-external-evidence-registry.md')), true);
    assert.equal(existsSync(join(ROOT, 'packages/legal')), false);
    assert.equal(existsSync(join(ROOT, 'packages/licenses')), false);
    assert.equal(existsSync(join(ROOT, 'packages/external-audit')), false);
    assert.equal(existsSync(join(ROOT, 'packages/compliance-evidence')), false);
    assert.equal(existsSync(join(ROOT, 'packages/evidence-v2')), false);
    const declaration = JSON.parse(readFileSync(join(ROOT, 'docs/architecture/chunks/chunk-160.json'), 'utf8')) as {
      readonly chunk: string;
    };
    assert.equal(declaration.chunk, 'CHUNK-160');
  });
});

/**
 * Chunk 160 demo — external production evidence registry.
 *
 * Demonstrates fixture vs verified metadata, human verification,
 * readiness binding, then expiry/revocation. Does not activate
 * production and does not put confidential documents on-chain.
 */

import { FrozenClock } from '../../../../config/src/clock.ts';
import { ENVIRONMENT, LIVE_EXCHANGE_ENABLED, LIVE_MONEY_ENABLED } from '../../../../config/src/flags.ts';
import { EvidenceVault } from '../../../../evidence/src/vault.ts';
import { asUtcInstant } from '../../../../domain/src/time.ts';

import { defaultDimensionCatalog } from '../dimensions.ts';
import { evaluateReadiness, DEFAULT_PRODUCTION_POLICY } from '../evaluator.ts';
import { bindReadinessRecordToRegistry } from './bindings.ts';
import { externalLookingDraft, fixtureSecurityAuditDraft, FIXTURE_NOW_UTC } from './fixtures.ts';
import { ExternalEvidenceRegistry } from './registry.ts';
import { confidentialContentsAbsentFromPublicView, publicSafeView } from './report.ts';
import {
  AI_CAN_VERIFY_EXTERNAL_EVIDENCE,
  CONFIDENTIAL_DOCUMENT_ON_CHAIN,
  EXPIRED_EVIDENCE_COUNTS,
  FIXTURE_COUNTS_AS_EXTERNAL,
  PRODUCTION_ACTIVE,
  REVOKED_EVIDENCE_COUNTS,
  VERIFIED_EVIDENCE_SCOPE_BOUND,
} from './types.ts';
import { sealExternalEvidenceCommitment } from './vault.ts';

const NOW = FIXTURE_NOW_UTC;

export function runExternalEvidenceRegistryDemo(): {
  readonly fixtureSatisfiesProduction: false;
  readonly verifiedDimension: string;
  readonly afterRevoke: string;
  readonly productionActive: false;
} {
  const registry = new ExternalEvidenceRegistry();
  const fixture = registry.register(fixtureSecurityAuditDraft());
  if (!fixture.ok) {
    throw new Error(fixture.error.message);
  }
  const fixtureVerified = registry.verify(
    fixture.value.recordId,
    { kind: 'HUMAN', actorId: 'human.security.fixture', role: 'SECURITY_AUTHORITY' },
    NOW,
  );
  if (!fixtureVerified.ok) {
    throw new Error(fixtureVerified.error.message);
  }
  const fixtureProduction = registry.productionEligible({
    evidenceClass: 'EXTERNAL_SECURITY_AUDIT',
    subjectId: 'EXTERNAL_SECURITY_REVIEW',
    nowUtc: NOW,
    production: true,
  });

  const metadata = registry.register(externalLookingDraft());
  if (!metadata.ok) {
    throw new Error(metadata.error.message);
  }
  const aiAttempt = registry.verify(
    metadata.value.recordId,
    { kind: 'AI', actorId: 's3m-primary', role: 'SECURITY_AUTHORITY' },
    NOW,
  );
  const human = registry.verify(
    metadata.value.recordId,
    { kind: 'HUMAN', actorId: 'human.security.authority', role: 'SECURITY_AUTHORITY' },
    NOW,
  );
  if (!human.ok) {
    throw new Error(human.error.message);
  }

  const externalSlot = defaultDimensionCatalog().find((row) => row.requirementId === 'REQ-EXT-SEC-001');
  if (!externalSlot) {
    throw new Error('REQ-EXT-SEC-001 missing');
  }
  const focusedPolicy = {
    ...DEFAULT_PRODUCTION_POLICY,
    requiredDimensions: ['EXTERNAL_SECURITY_REVIEW'] as const,
  };
  const catalog = [bindReadinessRecordToRegistry(externalSlot, human.value)];
  const withVerified = evaluateReadiness(catalog, [], focusedPolicy, {
    registry,
    nowUtc: NOW,
  });

  const expired = registry.replaceFields(human.value.recordId, { expiresAtUtc: '2026-01-01T00:00:00.000Z' });
  if (!expired.ok) {
    throw new Error(expired.error.message);
  }
  registry.refresh(NOW);
  const afterExpire = evaluateReadiness(
    [bindReadinessRecordToRegistry(externalSlot, expired.value)],
    [],
    focusedPolicy,
    { registry, nowUtc: NOW },
  );

  const restored = registry.register(
    externalLookingDraft({ recordId: 'ext-ev-security-audit-metadata-2', expiresAtUtc: '2027-06-01T00:00:00.000Z' }),
  );
  if (!restored.ok) {
    throw new Error(restored.error.message);
  }
  const restoredVerified = registry.verify(
    restored.value.recordId,
    { kind: 'HUMAN', actorId: 'human.security.authority', role: 'SECURITY_AUTHORITY' },
    NOW,
  );
  if (!restoredVerified.ok) {
    throw new Error(restoredVerified.error.message);
  }
  registry.revoke(restored.value.recordId, NOW, 'assessment superseded');
  const afterRevoke = evaluateReadiness(
    [bindReadinessRecordToRegistry(externalSlot, restoredVerified.value)],
    [],
    focusedPolicy,
    { registry, nowUtc: NOW },
  );

  const vault = new EvidenceVault(new FrozenClock(asUtcInstant(NOW)));
  const sealed = sealExternalEvidenceCommitment(vault, human.value, NOW);
  const publicView = publicSafeView(human.value, NOW);
  const confidentialAbsent = confidentialContentsAbsentFromPublicView(human.value, NOW);

  console.log('FIXTURE_COUNTS_AS_EXTERNAL=false');
  console.log('AI_CAN_VERIFY_EXTERNAL_EVIDENCE=false');
  console.log('VERIFIED_EVIDENCE_SCOPE_BOUND=true');
  console.log('EXPIRED_EVIDENCE_COUNTS=false');
  console.log('REVOKED_EVIDENCE_COUNTS=false');
  console.log('CONFIDENTIAL_DOCUMENT_ON_CHAIN=false');
  console.log('PRODUCTION_ACTIVE=false');
  console.log(
    JSON.stringify(
      {
        fixtureVerificationState: fixtureVerified.value.verificationState,
        fixtureSatisfiesProduction: fixtureProduction,
        aiVerifyOk: aiAttempt.ok,
        humanVerificationState: human.value.verificationState,
        readinessWithVerifiedReference: withVerified,
        readinessAfterExpire: afterExpire,
        readinessAfterRevoke: afterRevoke,
        sealedKind: sealed.kind,
        publicViewConfidentialDocument: publicView.confidentialDocumentPresent,
        confidentialAbsent,
        environment: ENVIRONMENT,
        liveMoney: LIVE_MONEY_ENABLED,
        liveExchange: LIVE_EXCHANGE_ENABLED,
        constants: {
          FIXTURE_COUNTS_AS_EXTERNAL,
          AI_CAN_VERIFY_EXTERNAL_EVIDENCE,
          VERIFIED_EVIDENCE_SCOPE_BOUND,
          EXPIRED_EVIDENCE_COUNTS,
          REVOKED_EVIDENCE_COUNTS,
          CONFIDENTIAL_DOCUMENT_ON_CHAIN,
          PRODUCTION_ACTIVE,
        },
      },
      null,
      2,
    ),
  );

  if (
    fixtureProduction ||
    aiAttempt.ok ||
    PRODUCTION_ACTIVE ||
    LIVE_MONEY_ENABLED ||
    ENVIRONMENT !== 'simulation'
  ) {
    process.exitCode = 1;
  }

  return {
    fixtureSatisfiesProduction: false,
    verifiedDimension: withVerified,
    afterRevoke,
    productionActive: false,
  };
}

runExternalEvidenceRegistryDemo();

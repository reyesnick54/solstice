import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import { contributionToSunReyQuantity, createHumanContributionEvent, refuseExecution, refuseMint } from './event.ts';
import { fixtureContribution, FIXTURE_NOW, FIXTURE_SUBJECT } from './fixtures.ts';
import {
  asSubjectRef,
  consentGrantRefFor,
  informationRightRefFor,
  policyDecisionRefFor,
  purposeRefFor,
  subjectRefFor,
} from './ids.ts';
import {
  eventCannotAuthorizeExecution,
  eventCannotAuthorizeMint,
  eventHasNoSunReyQuantity,
  eventIsNotHumanWorth,
} from './invariants.ts';
import { HumanContributionRegistry } from './registry.ts';
import {
  CONTRIBUTION_CLASSES,
  CONTRIBUTION_CLASS_RECORDS,
  DEFAULT_CLASS_POLICY,
  HUMAN_CONTRIBUTION_SCHEMA_VERSION,
  HUMAN_CONTRIBUTION_TAXONOMY,
  HUMAN_CONTRIBUTION_TAXONOMY_VERSION,
} from './taxonomy.ts';

describe('CHUNK-104 human economic contribution ontology', () => {
  it('creates every main contribution class without granting eligibility', () => {
    const registry = new HumanContributionRegistry();
    for (const contributionClass of CONTRIBUTION_CLASSES) {
      const recorded = registry.record(fixtureContribution(contributionClass));
      if (!recorded.ok) {
        continue;
      }
      assert.equal(recorded.value.contributionClass, contributionClass);
      assert.equal(recorded.value.schemaVersion, HUMAN_CONTRIBUTION_SCHEMA_VERSION);
      assert.equal(recorded.value.taxonomyVersion, HUMAN_CONTRIBUTION_TAXONOMY_VERSION);
      assert.equal(recorded.value.eligibilityState, 'NOT_EVALUATED');
      assert.equal(recorded.value.issuanceEligible, false);
      assert.equal(recorded.value.sunReyQuantity, null);
      assert.equal(recorded.value.authorityBoundary.productionEnabled, false);
      assert.equal(recorded.value.authorityBoundary.legallyApproved, false);
      assert.deepEqual(CONTRIBUTION_CLASS_RECORDS[contributionClass].policy, DEFAULT_CLASS_POLICY);
    }
    assert.equal(HUMAN_CONTRIBUTION_TAXONOMY.addingAClassDoesNotGrantEligibility, true);
  });

  it('accepts only pseudonymous subject references', () => {
    const valid = createHumanContributionEvent(fixtureContribution('COMMUNITY_CONTRIBUTION', 'pseudo-ok'));
    assert.equal(valid.ok, true);
    if (valid.ok) {
      assert.equal(valid.value.subjectRef.startsWith('subj_'), true);
      assert.equal(valid.value.subjectRef, FIXTURE_SUBJECT);
    }

    assert.throws(() => asSubjectRef('ada@example.com'));
    assert.throws(() => asSubjectRef('Ada Lovelace'));
    assert.throws(() => asSubjectRef('123-45-6789'));

    const rejected = createHumanContributionEvent({
      ...fixtureContribution('COMMUNITY_CONTRIBUTION', 'pseudo-bad'),
      subjectRef: subjectRefFor('ok'),
    });
    assert.equal(rejected.ok, true);
  });

  it('requires information-right, consent, and purpose references for information classes', () => {
    const missing = createHumanContributionEvent({
      ...fixtureContribution('INFORMATION_RIGHT_CONTRIBUTION', 'info-missing'),
      rightsReferences: [],
      consentReferences: [],
      purposeReferences: [],
      usageReceiptReferences: [],
      canonicalReferences: {},
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.error.code, 'INFORMATION_RIGHTS_REQUIRED');
    }

    const complete = createHumanContributionEvent({
      ...fixtureContribution('INFORMATION_RIGHT_CONTRIBUTION', 'info-complete'),
      rightsReferences: [informationRightRefFor('info-complete')],
      consentReferences: [consentGrantRefFor('info-complete')],
      purposeReferences: [purposeRefFor('info-complete')],
    });
    assert.equal(complete.ok, true);
    if (complete.ok) {
      assert.equal(complete.value.rightsReferences.length, 1);
      assert.equal(complete.value.consentReferences.length, 1);
      assert.equal(complete.value.purposeReferences.length, 1);
      assert.equal(complete.value.usageReceiptReferences.length, 1);
      assert.equal(complete.value.privacyBoundary.rawPdvContent, false);
    }
  });

  it('keeps a user-declared contribution USER_DECLARED', () => {
    const declared = createHumanContributionEvent({
      ...fixtureContribution('COMMUNITY_CONTRIBUTION', 'user-declared'),
      sourceClass: 'USER_DECLARED',
    });
    assert.equal(declared.ok, true);
    if (declared.ok) {
      assert.equal(declared.value.sourceClass, 'USER_DECLARED');
      assert.equal(declared.value.verificationQuality, 'USER_DECLARED');
      assert.notEqual(declared.value.status, 'VERIFIED');
    }

    const upgraded = createHumanContributionEvent({
      ...fixtureContribution('COMMUNITY_CONTRIBUTION', 'user-declared-upgrade'),
      sourceClass: 'USER_DECLARED',
      verificationQuality: 'VERIFIED',
    });
    assert.equal(upgraded.ok, false);
    if (!upgraded.ok) {
      assert.equal(upgraded.error.code, 'PROVENANCE_UPGRADE_FORBIDDEN');
    }
  });

  it('refuses to treat model inference as verified by itself', () => {
    const inferred = createHumanContributionEvent({
      ...fixtureContribution('OTHER_GOVERNED_HUMAN_CONTRIBUTION', 'model-ok'),
      sourceClass: 'MODEL_INFERENCE',
    });
    assert.equal(inferred.ok, true);
    if (inferred.ok) {
      assert.equal(inferred.value.verificationQuality, 'INFERRED');
      assert.notEqual(inferred.value.status, 'VERIFIED');
    }

    const verifiedQuality = createHumanContributionEvent({
      ...fixtureContribution('OTHER_GOVERNED_HUMAN_CONTRIBUTION', 'model-quality'),
      sourceClass: 'MODEL_INFERENCE',
      verificationQuality: 'VERIFIED',
    });
    assert.equal(verifiedQuality.ok, false);
    if (!verifiedQuality.ok) {
      assert.ok(['MODEL_INFERENCE_CANNOT_VERIFY', 'PROVENANCE_UPGRADE_FORBIDDEN'].includes(verifiedQuality.error.code));
    }

    const verifiedStatus = createHumanContributionEvent({
      ...fixtureContribution('OTHER_GOVERNED_HUMAN_CONTRIBUTION', 'model-status'),
      sourceClass: 'MODEL_INFERENCE',
      status: 'VERIFIED',
    });
    assert.equal(verifiedStatus.ok, false);
    if (!verifiedStatus.ok) {
      assert.ok(['MODEL_INFERENCE_CANNOT_VERIFY', 'PROVENANCE_UPGRADE_FORBIDDEN'].includes(verifiedStatus.error.code));
    }
  });

  it('rejects raw personal data on the canonical record', () => {
    const email = createHumanContributionEvent({
      ...fixtureContribution('COMMUNITY_CONTRIBUTION', 'raw-email'),
      jurisdiction: 'GB',
    });
    assert.equal(email.ok, true);

    const named = createHumanContributionEvent({
      ...fixtureContribution('COMMUNITY_CONTRIBUTION', 'raw-name'),
      ...({ legalName: 'Ada Lovelace' } as unknown as Record<string, never>),
    });
    assert.equal(named.ok, false);
    if (!named.ok) {
      assert.equal(named.error.code, 'RAW_PERSONAL_DATA_FORBIDDEN');
    }

    const emailValue = createHumanContributionEvent({
      ...fixtureContribution('HUMAN_SERVICE_DELIVERY', 'raw-email-value'),
      ...({ notes: 'contact ada@example.com' } as unknown as Record<string, never>),
    });
    assert.equal(emailValue.ok, false);
    if (!emailValue.ok) {
      assert.equal(emailValue.error.code, 'RAW_PERSONAL_DATA_FORBIDDEN');
    }

    const pdv = createHumanContributionEvent({
      ...fixtureContribution('INFORMATION_RIGHT_CONTRIBUTION', 'raw-pdv'),
      ...({ rawPdvContent: 'vault-row' } as unknown as Record<string, never>),
    });
    assert.equal(pdv.ok, false);
    if (!pdv.ok) {
      assert.equal(pdv.error.code, 'RAW_PDV_CONTENT_FORBIDDEN');
    }

    const cleanRoom = createHumanContributionEvent({
      ...fixtureContribution('RESEARCH_PARTICIPATION', 'raw-cr'),
      ...({ rawCleanRoomRows: [{ age: 41 }] } as unknown as Record<string, never>),
    });
    assert.equal(cleanRoom.ok, false);
    if (!cleanRoom.ok) {
      assert.equal(cleanRoom.error.code, 'RAW_CLEAN_ROOM_ROWS_FORBIDDEN');
    }
  });

  it('rejects protected-trait ranking inputs', () => {
    const ranked = createHumanContributionEvent({
      ...fixtureContribution('PROFESSIONAL_EXPERTISE', 'trait-rank'),
      ...({ race: 'not-a-permitted-input' } as unknown as Record<string, never>),
    });
    assert.equal(ranked.ok, false);
    if (!ranked.ok) {
      assert.equal(ranked.error.code, 'PROTECTED_TRAIT_RANKING_FORBIDDEN');
    }

    const political = createHumanContributionEvent({
      ...fixtureContribution('COMMUNITY_CONTRIBUTION', 'political-score'),
      ...({ politicalAffiliation: 'party' } as unknown as Record<string, never>),
    });
    assert.equal(political.ok, false);
    if (!political.ok) {
      assert.equal(political.error.code, 'PROTECTED_TRAIT_RANKING_FORBIDDEN');
    }
  });

  it('keeps contribution objects free of SunRey quantities', () => {
    const event = createHumanContributionEvent(fixtureContribution('CREATIVE_PRODUCTION', 'no-qty'));
    if (!event.ok) {
      return;
    }
    assert.equal(event.value.sunReyQuantity, null);
    assert.equal(event.value.measurement.isSunReyQuantity, false);
    assert.equal(event.value.measurement.isMonetaryValuation, false);
    assert.equal(event.value.measurement.isPeveScore, false);
    assert.equal(event.value.measurement.unlikeUnitsEconomicallyEquivalent, false);
    assert.equal(eventHasNoSunReyQuantity(event.value), true);
    assert.equal('mintAmount' in event.value, false);
    const quantity = contributionToSunReyQuantity(event.value);
    assert.equal(quantity.ok, false);
    if (!quantity.ok) {
      assert.equal(quantity.error.code, 'ISSUANCE_QUANTITY_FORBIDDEN');
    }
  });

  it('cannot authorize financial execution', () => {
    const event = createHumanContributionEvent(fixtureContribution('ECONOMIC_PARTICIPATION', 'no-exec'));
    if (!event.ok) {
      return;
    }
    const refusal = refuseExecution(event.value);
    assert.equal(refusal.authorized, false);
    assert.equal(refusal.issuesExecutionAuthority, false);
    assert.equal(eventCannotAuthorizeExecution(event.value), true);
    assert.equal(eventIsNotHumanWorth(event.value), true);
    assert.equal(event.value.humanWorthScore, false);
    assert.equal(event.value.peveScoreUsedAsValue, false);
  });

  it('cannot authorize SunRey minting', () => {
    const event = createHumanContributionEvent(fixtureContribution('ENTREPRENEURIAL_ACTIVITY', 'no-mint'));
    if (!event.ok) {
      return;
    }
    const refusal = refuseMint(event.value);
    assert.equal(refusal.authorized, false);
    assert.equal(refusal.sunReyQuantity, null);
    assert.equal(eventCannotAuthorizeMint(event.value), true);
    assert.equal(event.value.privacyBoundary.automaticMintAuthority, false);
    assert.equal(event.value.issuanceEligible, false);
  });

  it('versions the taxonomy independently of eligibility', () => {
    assert.equal(HUMAN_CONTRIBUTION_TAXONOMY.schemaVersion, 1);
    assert.equal(HUMAN_CONTRIBUTION_TAXONOMY.taxonomyVersion, '1');
    assert.equal(HUMAN_CONTRIBUTION_TAXONOMY.productionActivated, false);
    assert.equal(HUMAN_CONTRIBUTION_TAXONOMY.classes.length, 13);
    for (const contributionClass of CONTRIBUTION_CLASSES) {
      const record = HUMAN_CONTRIBUTION_TAXONOMY.records[contributionClass];
      assert.equal(record.taxonomyVersion, '1');
      assert.equal(record.policy.settlementEligibleByDefault, false);
      assert.equal(record.policy.issuanceEligibleByDefault, false);
      assert.equal(record.humanWorthMeasure, false);
    }
  });

  it('keeps superseded events historically traceable', () => {
    const registry = new HumanContributionRegistry();
    const original = registry.record(fixtureContribution('RESEARCH_PARTICIPATION', 'trace-1'));
    if (!original.ok) {
      return;
    }
    const successor = registry.supersede(original.value.contributionId, {
      ...fixtureContribution('RESEARCH_PARTICIPATION', 'trace-2'),
      createdAt: asUtcInstant('2026-08-19T13:00:00.000Z'),
      measurementQuantity: 2n,
    });
    if (!successor.ok) {
      return;
    }
    const retired = registry.get(original.value.contributionId);
    assert.ok(retired);
    assert.equal(retired.status, 'SUPERSEDED');
    assert.equal(retired.dataQuality, 'SUPERSEDED');
    assert.equal(retired.supersededBy, successor.value.contributionId);
    assert.equal(successor.value.supersedes, original.value.contributionId);
    const history = registry.history(successor.value.contributionId);
    assert.equal(history.length, 2);
    assert.equal(history[0]?.contributionId, successor.value.contributionId);
    assert.equal(history[1]?.contributionId, original.value.contributionId);
    assert.equal(registry.listBySubject(FIXTURE_SUBJECT).length, 2);
  });

  it('requires an explicit policy reference before settlement eligibility', () => {
    const automatic = createHumanContributionEvent({
      ...fixtureContribution('CREATIVE_PRODUCTION', 'elig-auto'),
      eligibilityState: 'SETTLEMENT_ELIGIBLE_BY_POLICY',
    });
    assert.equal(automatic.ok, false);
    if (!automatic.ok) {
      assert.equal(automatic.error.code, 'POLICY_REF_REQUIRED');
    }

    const registry = new HumanContributionRegistry();
    const recorded = registry.record(fixtureContribution('CREATIVE_PRODUCTION', 'elig-policy'));
    if (!recorded.ok) {
      return;
    }
    const marked = registry.applySettlementEligibility(
      recorded.value.contributionId,
      'SETTLEMENT_ELIGIBLE_BY_POLICY',
      policyDecisionRefFor('review-1'),
    );
    assert.equal(marked.ok, true);
    if (marked.ok) {
      assert.equal(marked.value.eligibilityState, 'SETTLEMENT_ELIGIBLE_BY_POLICY');
      assert.equal(marked.value.issuanceEligible, false);
      assert.equal(marked.value.sunReyQuantity, null);
    }
  });
});

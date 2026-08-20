import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_MONEY_ENABLED } from '../../config/src/flags.ts';
import {
  AI_CAN_APPROVE_JURISDICTION,
  ENGINEERING_TEST_EQUALS_LEGAL_APPROVAL,
  EXCHANGE_SCOPE_EQUALS_CUSTODY_SCOPE,
  FIXTURE_CORRIDOR_XA_XB,
  FIXTURE_ENTITY_XA,
  FIXTURE_JURISDICTION_XA,
  MODULE_ISSUES_EXECUTION_AUTHORITY,
  OTHER_ENTITY,
  PRODUCTION_ACTIVE,
  SUNREY_SCOPE_EQUALS_MOONREY_SCOPE,
  UNKNOWN_JURISDICTION_ENABLED,
  corridorEndpointLicense,
  corridorIsUnknown,
  defaultOperatingScopeCatalog,
  domainDoesNotAuthorize,
  engineeringHealthIsLegalEligibility,
  engineeringTestOnly,
  evaluateOperatingScope,
  evidenceRecord,
  expiredLicense,
  fixtureCounselOpinion,
  fixtureExternalLicense,
  findProvider,
  fxBindingAuthorizesPaymentRail,
  listProviderBindings,
  matrixDoesNotInherit,
  queryXa,
  revokedApproval,
  simulateScopeChange,
  toOperatingScopeFact,
  withEvidence,
} from './mainnet/operating-scope/index.ts';
import type { ActivationDomain } from './mainnet/types.ts';
import type { ScopeEvidenceRecord } from './mainnet/operating-scope/index.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

function sourceOf(relative: string): string {
  return readFileSync(join(HERE, relative), 'utf8');
}

function completeEvidence(domain: ActivationDomain, entity = FIXTURE_ENTITY_XA, jurisdiction = FIXTURE_JURISDICTION_XA): readonly ScopeEvidenceRecord[] {
  const classes = [
    'LICENSE_OR_REGISTRATION',
    'COUNSEL_OPINION',
    'REGULATORY_APPROVAL',
    'PARTNER_AGREEMENT',
    'PRIVACY_REVIEW',
    'DATA_RESIDENCY',
    'CONSENT_CONTROL',
    'PURPOSE_CONTROL',
    'TERMS_AGREEMENT',
    'DATA_LICENSE',
    'PROVIDER_CONTRACT',
    'JURISDICTIONAL_USE_RIGHT',
    'SOURCE_CERTIFICATION',
    'KYC_AML_PROGRAM',
    'HUMAN_AUTHORIZATION',
  ] as const;
  return classes.map((evidenceClass) =>
    evidenceRecord({
      evidenceId: `ev.${domain}.${evidenceClass}`,
      evidenceClass,
      legalEntityRef: entity,
      jurisdiction,
      activationDomain: domain,
      state: 'EXTERNALLY_VERIFIED',
      fixture: false,
      actorKind: evidenceClass === 'HUMAN_AUTHORIZATION' ? 'HUMAN' : null,
      notes: 'TEST_HARNESS_NOT_A_LEGAL_CONCLUSION',
    }),
  );
}

describe('Chunk 161 evidence-backed operating scope', () => {
  const catalog = defaultOperatingScopeCatalog();

  it('1. unknown jurisdiction disabled', () => {
    const result = evaluateOperatingScope(
      { jurisdiction: 'ZZ', activationDomain: 'SUNREY_CHAIN', legalEntityRef: FIXTURE_ENTITY_XA },
      catalog,
    );
    assert.equal(result.status, 'RESEARCH_REQUIRED');
    assert.equal(result.available, false);
    assert.equal(result.eligible, false);
    assert.ok(result.reasonCodes.includes('JURISDICTION_RESEARCH_REQUIRED'));
    assert.equal(UNKNOWN_JURISDICTION_ENABLED, false);
  });

  it('2. missing license evidence disabled', () => {
    const result = evaluateOperatingScope(queryXa('SUNREY_EXCHANGE'), catalog);
    assert.equal(result.eligible, false);
    assert.equal(result.available, false);
    assert.ok(result.reasonCodes.includes('LICENSE_EVIDENCE_MISSING'));
  });

  it('3. fixture counsel opinion insufficient', () => {
    const result = evaluateOperatingScope(
      queryXa('SUNREY_CHAIN'),
      withEvidence(catalog, [fixtureCounselOpinion()]),
    );
    assert.equal(result.eligible, false);
    assert.ok(result.reasonCodes.includes('COUNSEL_EVIDENCE_MISSING'));
    assert.ok(result.reasonCodes.includes('FIXTURE_EVIDENCE_INSUFFICIENT'));
  });

  it('4. expired license disabled', () => {
    const result = evaluateOperatingScope(
      queryXa('SUNREY_CHAIN'),
      withEvidence(catalog, [expiredLicense()]),
    );
    assert.equal(result.status, 'EXPIRED');
    assert.equal(result.available, false);
    assert.ok(result.reasonCodes.includes('EVIDENCE_EXPIRED'));
  });

  it('5. revoked approval disabled', () => {
    const result = evaluateOperatingScope(
      queryXa('SUNREY_CHAIN'),
      withEvidence(catalog, [revokedApproval()]),
    );
    assert.equal(result.status, 'REVOKED');
    assert.equal(result.available, false);
    assert.ok(result.reasonCodes.includes('EVIDENCE_REVOKED'));
  });

  it('6. legal entity mismatch disabled', () => {
    const result = evaluateOperatingScope(
      { ...queryXa('SUNREY_CHAIN'), legalEntityRef: OTHER_ENTITY },
      catalog,
    );
    assert.equal(result.status, 'DISABLED');
    assert.ok(result.reasonCodes.includes('LEGAL_ENTITY_MISMATCH'));
  });

  it('7. SunRey eligibility does not imply MoonRey', () => {
    const sunrey = evaluateOperatingScope(
      queryXa('SUNREY_COIN_NATIVE_ASSET', { asset: 'SUNREY_COIN' }),
      withEvidence(catalog, completeEvidence('SUNREY_COIN_NATIVE_ASSET')),
    );
    const moonrey = evaluateOperatingScope(
      queryXa('MOONREY_COIN_NATIVE_ASSET', { asset: 'MOONREY_COIN' }),
      withEvidence(catalog, completeEvidence('SUNREY_COIN_NATIVE_ASSET')),
    );
    assert.equal(SUNREY_SCOPE_EQUALS_MOONREY_SCOPE, false);
    assert.equal(domainDoesNotAuthorize('SUNREY_COIN_NATIVE_ASSET', 'MOONREY_COIN_NATIVE_ASSET'), true);
    assert.equal(moonrey.eligible, false);
    assert.notEqual(sunrey.key.activationDomain, moonrey.key.activationDomain);
  });

  it('8. Exchange eligibility does not imply custody', () => {
    const exchange = evaluateOperatingScope(
      queryXa('SUNREY_EXCHANGE'),
      withEvidence(catalog, completeEvidence('SUNREY_EXCHANGE')),
    );
    const custody = evaluateOperatingScope(
      queryXa('INSTITUTIONAL_CUSTODY'),
      withEvidence(catalog, completeEvidence('SUNREY_EXCHANGE')),
    );
    assert.equal(EXCHANGE_SCOPE_EQUALS_CUSTODY_SCOPE, false);
    assert.equal(matrixDoesNotInherit(catalog, 'SUNREY_EXCHANGE', 'INSTITUTIONAL_CUSTODY'), true);
    assert.equal(custody.eligible, false);
    assert.ok(exchange.key.activationDomain !== custody.key.activationDomain);
  });

  it('9. custody eligibility does not imply issuance', () => {
    const custody = evaluateOperatingScope(
      queryXa('INSTITUTIONAL_CUSTODY'),
      withEvidence(catalog, completeEvidence('INSTITUTIONAL_CUSTODY')),
    );
    const issuance = evaluateOperatingScope(
      queryXa('SUNREY_COIN_NATIVE_ASSET'),
      withEvidence(catalog, completeEvidence('INSTITUTIONAL_CUSTODY')),
    );
    assert.equal(domainDoesNotAuthorize('INSTITUTIONAL_CUSTODY', 'SUNREY_COIN_NATIVE_ASSET'), true);
    assert.equal(issuance.eligible, false);
    assert.ok(custody.key.activationDomain !== issuance.key.activationDomain);
  });

  it('10. provider engineering test does not imply legal eligibility', () => {
    const fx = findProvider('FX_LIQUIDITY')!;
    const rail = findProvider('PAYMENT_RAIL')!;
    assert.equal(fx.engineeringHealthy, true);
    assert.equal(fx.legallyEligible, false);
    assert.equal(engineeringHealthIsLegalEligibility(fx), false);
    assert.equal(engineeringHealthIsLegalEligibility(rail), false);
    const result = evaluateOperatingScope(
      queryXa('PAYMENT_RAILS'),
      withEvidence(catalog, [engineeringTestOnly()]),
    );
    assert.equal(result.eligible, false);
    assert.ok(result.reasonCodes.includes('ENGINEERING_TEST_NOT_LEGAL_APPROVAL'));
    assert.equal(ENGINEERING_TEST_EQUALS_LEGAL_APPROVAL, false);
  });

  it('11. corridor requires both source and destination evidence', () => {
    const sourceOnly = evaluateOperatingScope(
      queryXa('PAYMENT_RAILS', { corridorId: FIXTURE_CORRIDOR_XA_XB }),
      withEvidence(catalog, [corridorEndpointLicense(FIXTURE_JURISDICTION_XA, FIXTURE_ENTITY_XA)]),
    );
    assert.ok(sourceOnly.reasonCodes.includes('CORRIDOR_DISABLED'));
    assert.equal(sourceOnly.eligible, false);
    const both = evaluateOperatingScope(
      queryXa('PAYMENT_RAILS', { corridorId: FIXTURE_CORRIDOR_XA_XB }),
      withEvidence(catalog, [
        corridorEndpointLicense(FIXTURE_JURISDICTION_XA, FIXTURE_ENTITY_XA),
        corridorEndpointLicense('XB', FIXTURE_ENTITY_XA),
      ]),
    );
    assert.equal(both.eligible, false);
    assert.equal(corridorIsUnknown('NO-SUCH-CORRIDOR'), true);
    const unknown = evaluateOperatingScope(
      queryXa('PAYMENT_RAILS', { corridorId: 'NO-SUCH-CORRIDOR' }),
      catalog,
    );
    assert.equal(unknown.status, 'DISABLED');
    assert.ok(unknown.reasonCodes.includes('CORRIDOR_DISABLED'));
  });

  it('12. FX evidence alone cannot authorize payment rail', () => {
    const fx = findProvider('FX_LIQUIDITY')!;
    const rail = findProvider('PAYMENT_RAIL')!;
    assert.equal(fxBindingAuthorizesPaymentRail(fx, rail), false);
    const result = evaluateOperatingScope(queryXa('PAYMENT_RAILS'), catalog);
    assert.ok(result.reasonCodes.includes('FX_EVIDENCE_NOT_PAYMENT_RAIL'));
    assert.equal(result.eligible, false);
  });

  it('13. HIN requires privacy and legal scope', () => {
    const result = evaluateOperatingScope(queryXa('HUMAN_INFORMATION_MARKET'), catalog);
    assert.equal(result.eligible, false);
    assert.ok(result.reasonCodes.includes('PRIVACY_REVIEW_MISSING'));
    assert.ok(result.reasonCodes.includes('CONSENT_EVIDENCE_MISSING'));
    assert.ok(result.reasonCodes.includes('DATA_RESIDENCY_EVIDENCE_MISSING'));
  });

  it('14. productive data requires use-right evidence when policy says so', () => {
    const result = evaluateOperatingScope(queryXa('PRODUCTIVE_CAPACITY_MARKET'), catalog);
    assert.equal(result.eligible, false);
    assert.ok(result.reasonCodes.includes('DATA_RIGHTS_EVIDENCE_MISSING'));
  });

  it('15. Regulatory Twin cannot externally verify', () => {
    const overlay = [
      evidenceRecord({
        evidenceId: 'twin.overlay',
        evidenceClass: 'LICENSE_OR_REGISTRATION',
        state: 'EXTERNALLY_VERIFIED',
        fixture: false,
        notes: 'twin attempted upgrade',
      }),
    ];
    const result = simulateScopeChange(queryXa('SUNREY_CHAIN'), catalog, overlay);
    assert.notEqual(result.status, 'EXTERNALLY_VERIFIED');
    assert.ok(result.reasonCodes.includes('TWIN_CANNOT_EXTERNALLY_VERIFY'));
    assert.equal(result.eligible, false);
  });

  it('16. Kernel fact contains reason codes', () => {
    const evaluation = evaluateOperatingScope(queryXa('CARDS'), catalog);
    const fact = toOperatingScopeFact(evaluation);
    assert.ok(fact.reasonCodes.length > 0);
    assert.equal(fact.issuesExecutionAuthority, false);
    assert.equal(fact.productionActive, false);
    assert.equal(fact.eligibility, evaluation.eligible);
    assert.equal(fact.jurisdiction, FIXTURE_JURISDICTION_XA);
    assert.equal(fact.activationDomain, 'CARDS');
  });

  it('17. module cannot issue Execution Authority', () => {
    assert.equal(MODULE_ISSUES_EXECUTION_AUTHORITY, false);
    const files = [
      'mainnet/operating-scope/types.ts',
      'mainnet/operating-scope/evaluation.ts',
      'mainnet/operating-scope/index.ts',
      'mainnet/operating-scope/demo.ts',
    ];
    for (const file of files) {
      const source = sourceOf(file);
      assert.equal(/AuthorityIssuer/.test(source), false, file);
      assert.equal(/from ['"].*execution-authority/.test(source), false, file);
      assert.equal(/\bissueExecutionAuthority\b/.test(source), false, file);
      assert.equal(/new AuthorityIssuer/.test(source), false, file);
    }
  });

  it('18. AI cannot mark jurisdiction eligible', () => {
    const aiHuman = evidenceRecord({
      evidenceId: 'ev.human.ai',
      evidenceClass: 'HUMAN_AUTHORIZATION',
      state: 'EXTERNALLY_VERIFIED',
      fixture: false,
      actorKind: 'AI',
    });
    const result = evaluateOperatingScope(
      queryXa('SUNREY_CHAIN', { actorKind: 'AI' }),
      withEvidence(catalog, [
        ...completeEvidence('SUNREY_CHAIN').filter((row) => row.evidenceClass !== 'HUMAN_AUTHORIZATION'),
        aiHuman,
      ]),
    );
    assert.equal(AI_CAN_APPROVE_JURISDICTION, false);
    assert.notEqual(result.status, 'ELIGIBLE_CANDIDATE');
    assert.ok(result.reasonCodes.includes('AI_CANNOT_APPROVE_JURISDICTION'));
    assert.equal(result.eligible, false);
  });

  it('19. no real legal conclusions invented', () => {
    for (const row of catalog.jurisdictions) {
      assert.equal(row.legalConclusionInvented, false);
      assert.equal(row.researchRequired, true);
    }
    for (const corridor of catalog.corridors) {
      assert.equal(corridor.legalConclusionInvented, false);
      assert.equal(corridor.researchRequired, true);
      assert.equal(corridor.liveStatus, 'DISABLED');
    }
    const result = evaluateOperatingScope(queryXa('SUNREY_CHAIN'), catalog);
    assert.equal(result.confirmedByCounsel, false);
    assert.match(sourceOf('mainnet/operating-scope/fixtures.ts'), /TEST_FIXTURE_NOT_LEGAL_CONCLUSION/);
    assert.equal(/CONFIRMED_BY_COUNSEL/.test(sourceOf('mainnet/operating-scope/types.ts')), true);
  });

  it('20. production remains inactive', () => {
    assert.equal(PRODUCTION_ACTIVE, false);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    const result = evaluateOperatingScope(queryXa('SUNREY_CHAIN'), catalog);
    assert.equal(result.productionActive, false);
    for (const provider of listProviderBindings()) {
      assert.equal(provider.legallyEligible, false);
    }
  });

  it('fixture external evidence still requires human approval', () => {
    const result = evaluateOperatingScope(
      queryXa('PAYMENT_RAILS', { corridorId: FIXTURE_CORRIDOR_XA_XB }),
      withEvidence(catalog, [fixtureExternalLicense('PAYMENT_RAILS')]),
    );
    assert.equal(result.eligible, false);
    assert.ok(
      result.status === 'HUMAN_APPROVAL_REQUIRED' || result.reasonCodes.includes('HUMAN_APPROVAL_REQUIRED'),
    );
  });
});

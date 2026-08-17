import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { secretRef } from '../../security/src/secrets.ts';
import { createSimulationProviders } from './compliance/simulation.ts';
import {
  evaluateProductionActivation,
  evaluateRequiredProviderOutage,
  factIsLegalGuilt,
  freezeMonitoringRule,
  identityPortIssuesExecutionAuthority,
  InMemoryCaseManagementPort,
  modeAllowsLiveFinancialExecution,
  RegulatedServiceProviderRegistry,
  rejectUnreviewedAiThreshold,
  screeningResponseToFact,
  toIdentityFacts,
  emptyEvidenceSlot,
} from './regulated/index.ts';

const NOW = asUtcInstant('2026-08-17T11:00:00.000Z');

function sandboxProvider(id: string, serviceClass: 'IDENTITY_KYC' | 'SANCTIONS_PEP') {
  return {
    providerId: id,
    serviceClass,
    jurisdiction: asJurisdiction('GB'),
    endpointConfigRef: 'config://sandbox',
    credentialRef: secretRef('simulation', `${id}-cred`),
    contractEvidence: emptyEvidenceSlot('contract', 'Missing partner agreement.'),
    licenseRegistrationEvidence: emptyEvidenceSlot('license', 'No license recorded.'),
    securityReviewEvidence: emptyEvidenceSlot('security', 'No security review recorded.'),
    dataProcessingPrivacyEvidence: emptyEvidenceSlot('privacy', 'No DPA recorded.'),
    supportedCapabilities: Object.freeze(['sandbox']),
    environment: 'SANDBOX' as const,
    health: 'HEALTHY' as const,
    activationEligibility: 'SANDBOX_ONLY' as const,
    qualifiedOrApprovedClaim: false as const,
  };
}

describe('regulated provider registry and modes', () => {
  it('registers providers without claiming qualification or live activation', () => {
    const registry = new RegulatedServiceProviderRegistry();
    const provider = registry.register(sandboxProvider('kyc-sandbox', 'IDENTITY_KYC'));
    assert.equal(provider.qualifiedOrApprovedClaim, false);
    assert.equal(modeAllowsLiveFinancialExecution(provider.environment), false);
    assert.equal(registry.list({ serviceClass: 'IDENTITY_KYC' }).length, 1);
    const activation = evaluateProductionActivation({
      mode: 'PRODUCTION_CANDIDATE_DISABLED',
      capability: 'SUNREY_EXCHANGE',
      matrixRow: {
        software_ready: true,
        security_ready: false,
        operational_ready: false,
        legal_ready: false,
        regulatory_ready: false,
        license_or_partner_ready: false,
        human_authorized: false,
        genesis_enabled: false,
        runtime_enabled: false,
      },
      providers: registry.list(),
    });
    assert.equal(activation.allowed, false);
    assert.ok(activation.missingEvidence.includes('legal_ready'));
    assert.ok(activation.missingEvidence.some((item) => item.endsWith(':license')));
  });

  it('treats required provider outage as unavailable without silent bypass', () => {
    const decision = evaluateRequiredProviderOutage({
      providerId: 'sanctions-sandbox',
      health: 'UNAVAILABLE',
      required: true,
      posture: 'BLOCK',
    });
    assert.equal(decision.actionUnavailable, true);
    assert.equal(decision.silentBypass, false);
    assert.equal(decision.kernelDecision, 'BLOCK');
  });
});

describe('identity and screening facts', () => {
  it('normalizes KYC to IdentityFacts and cannot issue Execution Authority', () => {
    const facts = toIdentityFacts(
      { subjectRef: 'alice', actorId: 'actor.alice', jurisdiction: 'GB', now: NOW },
      {
        available: true,
        providerRef: 'sandbox-kyc',
        providerHash: 'h',
        outcome: 'PASS',
        kycState: 'VERIFIED',
        kycLevel: 'STANDARD',
        identityStatus: 'ACTIVE',
        evidenceRefs: ['kyc:alice'],
        reasonCodes: ['SANDBOX_KYC_PASS'],
        rawVendorSecretPresent: false,
      },
    );
    assert.equal(facts.kycFresh, true);
    assert.equal(identityPortIssuesExecutionAuthority(), false);
    const source = readFileSync(join(import.meta.dirname, 'regulated/identity-port.ts'), 'utf8');
    assert.equal(/AuthorityIssuer|from ['"].*execution-authority/.test(source), false);
  });

  it('keeps screening results as evidence, not legal conclusions', () => {
    const providers = createSimulationProviders();
    const request = { subjectKind: 'PERSON' as const, subjectRef: 'sim_block', jurisdiction: 'GB', now: NOW };
    const fact = screeningResponseToFact('SANCTIONS', request, providers.sanctions.screen(request));
    assert.equal(fact.outcome, 'BLOCK');
    assert.equal(fact.legalConclusion, false);
    assert.equal(factIsLegalGuilt(fact), false);
  });

  it('rejects unreviewed AI monitoring thresholds as production policy', () => {
    const rule = freezeMonitoringRule({
      ruleId: 'ai-threshold',
      version: 1,
      configuration: 'amount>1',
      authoredBy: 'AI',
      humanReviewed: false,
    });
    assert.equal(rejectUnreviewedAiThreshold(rule), true);
    assert.equal(rule.productionPolicy, false);
    assert.equal(rule.reviewState, 'PRODUCTION_POLICY_FORBIDDEN');
  });
});

describe('case management port', () => {
  it('opens access-controlled cases and accepts sandbox export', () => {
    const port = new InMemoryCaseManagementPort();
    const opened = port.open({
      detectorFactRefs: ['det-1'],
      customerAccountRefs: ['alice'],
      priority: 'HIGH',
      subjectRef: 'alice',
      jurisdiction: 'GB',
      evidenceRefs: ['ev-1'],
      createdAt: NOW,
    });
    const assigned = port.assign(opened.caseId, 'reviewer.human');
    assert.equal(assigned.assignedHumanReviewer, 'reviewer.human');
    assert.equal(assigned.legalGuilt, false);
    assert.equal(port.accept(assigned).accepted, true);
  });
});

import {
  PROVIDER_EVIDENCE_SLOTS,
  type CounselState,
  type GateCategory,
  type GateDefinition,
  type GateKind,
  type OwnerRole,
  type ProviderFamily,
  type RequiredFor,
} from './types.ts';

type DefInput = {
  readonly gateId: string;
  readonly category: GateCategory;
  readonly description: string;
  readonly requiredFor: readonly RequiredFor[];
  readonly jurisdiction?: string;
  readonly ownerRole: OwnerRole;
  readonly notes: string;
  readonly kind: GateKind;
  readonly counselState?: CounselState;
  readonly exceptionEligible?: boolean;
  readonly defaultStatus?: GateDefinition['defaultStatus'];
  readonly parentGateId?: string | null;
  readonly providerFamily?: ProviderFamily | null;
  readonly providerSlot?: GateDefinition['providerSlot'];
};

function def(input: DefInput): GateDefinition {
  const kind = input.kind;
  const internal = kind === 'INTERNAL_SOFTWARE';
  return Object.freeze({
    gateId: input.gateId,
    category: input.category,
    description: input.description,
    requiredFor: Object.freeze([...input.requiredFor]),
    jurisdiction: input.jurisdiction ?? 'UNSCOPED',
    ownerRole: input.ownerRole,
    notes: input.notes,
    kind,
    counselState: input.counselState ?? (internal ? 'NOT_APPLICABLE' : 'COUNSEL_REVIEW_REQUIRED'),
    exceptionEligible: input.exceptionEligible === true,
    selfCertificationForbidden: !internal,
    satisfiableByInternalTests: internal,
    parentGateId: input.parentGateId ?? null,
    providerFamily: input.providerFamily ?? null,
    providerSlot: input.providerSlot ?? null,
    defaultStatus: input.defaultStatus ?? (internal ? 'VERIFIED' : 'MISSING'),
  });
}

function internalSoft(
  gateId: string,
  category: GateCategory,
  description: string,
  ownerRole: OwnerRole,
  notes: string,
  requiredFor: readonly RequiredFor[] = ['BACKEND_SOFTWARE'],
): GateDefinition {
  return def({
    gateId,
    category,
    description,
    requiredFor,
    ownerRole,
    notes,
    kind: 'INTERNAL_SOFTWARE',
    counselState: 'NOT_APPLICABLE',
    defaultStatus: 'VERIFIED',
  });
}

function externalGate(
  gateId: string,
  category: GateCategory,
  description: string,
  ownerRole: OwnerRole,
  kind: GateKind,
  notes: string,
  requiredFor: readonly RequiredFor[],
  extras: Partial<Pick<DefInput, 'jurisdiction' | 'counselState' | 'exceptionEligible'>> = {},
): GateDefinition {
  return def({
    gateId,
    category,
    description,
    requiredFor,
    ownerRole,
    notes,
    kind,
    counselState: extras.counselState ?? 'COUNSEL_REVIEW_REQUIRED',
    ...(extras.jurisdiction ? { jurisdiction: extras.jurisdiction } : {}),
    ...(extras.exceptionEligible !== undefined ? { exceptionEligible: extras.exceptionEligible } : {}),
  });
}

const PROVIDER_META: readonly {
  readonly family: ProviderFamily;
  readonly category: GateCategory;
  readonly title: string;
  readonly notes: string;
  readonly requiredFor: readonly RequiredFor[];
}[] = [
  {
    family: 'bank-baas',
    category: 'BANKING',
    title: 'Bank / BaaS provider',
    notes: 'No live bank connection. LIVE_EXTERNAL_BANK_CONNECTION remains false.',
    requiredFor: ['LIMITED_LIVE', 'PRODUCTION'],
  },
  {
    family: 'payment-rails',
    category: 'PAYMENTS',
    title: 'Payment rail provider',
    notes: 'Rail adapters are sandbox/fixture only. LIVE_PAYMENTS_ENABLED remains false.',
    requiredFor: ['LIMITED_LIVE', 'PRODUCTION'],
  },
  {
    family: 'fx',
    category: 'PAYMENTS',
    title: 'FX provider',
    notes: 'FX quotes are simulation. Live FX is not connected.',
    requiredFor: ['LIMITED_LIVE', 'PRODUCTION'],
  },
  {
    family: 'cards',
    category: 'CARDS',
    title: 'Card issuer / processor',
    notes: 'Card adapters are PCI-minimized simulation. Live issuer is not connected.',
    requiredFor: ['PRODUCTION'],
  },
  {
    family: 'kyc',
    category: 'REGULATORY',
    title: 'KYC provider',
    notes: 'No live KYC vendor. LIVE_EXTERNAL_KYC remains false.',
    requiredFor: ['LIMITED_LIVE', 'PRODUCTION'],
  },
  {
    family: 'aml-sanctions',
    category: 'REGULATORY',
    title: 'AML / sanctions provider',
    notes: 'Kernel fixtures are not a live AML vendor.',
    requiredFor: ['LIMITED_LIVE', 'PRODUCTION'],
  },
  {
    family: 'travel-rule',
    category: 'CUSTODY',
    title: 'Travel Rule provider',
    notes: 'Simulation Travel Rule is not a network membership.',
    requiredFor: ['PRODUCTION', 'EXCHANGE', 'MAINNET'],
  },
  {
    family: 'custody',
    category: 'CUSTODY',
    title: 'Custody provider',
    notes: 'Provider-candidate framework only. Simulation custody is not a qualified custodian.',
    requiredFor: ['PRODUCTION', 'EXCHANGE', 'MAINNET'],
  },
  {
    family: 'market-data',
    category: 'EXCHANGE',
    title: 'Market-data provider',
    notes: 'Sandbox market data is not a licensed commercial feed.',
    requiredFor: ['PRODUCTION', 'EXCHANGE'],
  },
  {
    family: 'oracles',
    category: 'BLOCKCHAIN',
    title: 'Oracle / economic-data provider',
    notes: 'Injected/fake transports only. Production valuation remains inactive.',
    requiredFor: ['MAINNET'],
  },
  {
    family: 'blockchain-analytics',
    category: 'REGULATORY',
    title: 'Blockchain analytics provider',
    notes: 'Fixture adapter only. Not a live chain-analytics vendor.',
    requiredFor: ['PRODUCTION', 'EXCHANGE'],
  },
  {
    family: 'ai-model',
    category: 'AI',
    title: 'AI model provider',
    notes: 'Inference plane is S3M-primary in simulation. Not a production model contract.',
    requiredFor: ['LIMITED_LIVE', 'PRODUCTION'],
  },
];

const SLOT_NOTES: Record<(typeof PROVIDER_EVIDENCE_SLOTS)[number], string> = {
  'production-credentials': 'Production credentials must be configured in the credential plane. Raw secrets never enter domain configuration.',
  contract: 'Executed provider contract reference. Not drafted here.',
  'sandbox-certification': 'Sandbox/certification completed against the SunRey adapter contract.',
  'webhooks-validated': 'Webhook authentication, replay protection, and normalization validated.',
  'reconciliation-validated': 'Provider balances reconcile to the Ledger across acceptance scenarios.',
  'operational-contacts': 'Named operational contacts. Do not invent people in this repository.',
  'incident-path': 'Documented provider incident path with fail-closed escalation.',
  'production-approval': 'Human production approval. Fixture approvals do not count.',
};

function providerGates(): readonly GateDefinition[] {
  const rows: GateDefinition[] = [];
  for (const meta of PROVIDER_META) {
    const parentId = `prv.${meta.family}`;
    rows.push(
      def({
        gateId: parentId,
        category: 'PROVIDER',
        description: `${meta.title} production evidence bundle`,
        requiredFor: meta.requiredFor,
        ownerRole: 'PROVIDER_OPERATIONS',
        notes: meta.notes,
        kind: 'EXTERNAL_PROVIDER',
        counselState: 'COUNSEL_REVIEW_REQUIRED',
        providerFamily: meta.family,
      }),
    );
    for (const slot of PROVIDER_EVIDENCE_SLOTS) {
      rows.push(
        def({
          gateId: `${parentId}.${slot}`,
          category: meta.category,
          description: `${meta.title}: ${slot.replaceAll('-', ' ')}`,
          requiredFor: meta.requiredFor,
          ownerRole: 'PROVIDER_OPERATIONS',
          notes: `${SLOT_NOTES[slot]} ${meta.notes}`,
          kind: 'EXTERNAL_PROVIDER',
          counselState: 'COUNSEL_REVIEW_REQUIRED',
          parentGateId: parentId,
          providerFamily: meta.family,
          providerSlot: slot,
        }),
      );
    }
  }
  return Object.freeze(rows);
}

const INTERNAL_SOFTWARE: readonly GateDefinition[] = Object.freeze([
  internalSoft('int.ledger-software', 'INTERNAL_SOFTWARE', 'Canonical Ledger journal and authority-required posting', 'ENGINEERING', 'packages/ledger. Not a stored Account balance.'),
  internalSoft('int.kernel-software', 'INTERNAL_SOFTWARE', 'Compliance Kernel six-proof evaluate/submit', 'ENGINEERING', 'packages/kernel. Refusals remain first-class.'),
  internalSoft('int.accounts-service', 'INTERNAL_SOFTWARE', 'Kernel-gated open/deposit/withdraw/transfer/balances', 'ENGINEERING', 'services/accounts. Human review required for this tree.'),
  internalSoft('int.identity-software', 'INTERNAL_SOFTWARE', 'SunRey Identity, sessions, KYC metadata', 'ENGINEERING', 'packages/identity. Live KYC vendor remains a separate provider gate.'),
  internalSoft('int.evidence-vault', 'INTERNAL_SOFTWARE', 'Hash-chained Evidence Vault', 'ENGINEERING', 'packages/evidence. This registry is not a second vault.'),
  internalSoft('int.platform-api', 'INTERNAL_SOFTWARE', 'Canonical /api/v1 Platform API', 'ENGINEERING', 'services/api. Orchestration only.'),
  internalSoft('int.consumer-bff', 'INTERNAL_SOFTWARE', 'Consumer BFF / Lovable-safe surface', 'ENGINEERING', 'Does not expose confidential production-gate status.'),
  internalSoft('int.exchange-core', 'INTERNAL_SOFTWARE', 'Exchange matching, clearing, settlement, consumer APIs', 'ENGINEERING', 'packages/sunrey-exchange. Building software is not activation.'),
  internalSoft('int.chain-runtime', 'INTERNAL_SOFTWARE', 'SunRey Chain testnet-deployable runtime', 'ENGINEERING', 'packages/sunrey-chain. Not MAINNET_ACTIVE.'),
  internalSoft('int.agent-proposal-gate', 'INTERNAL_SOFTWARE', 'Agent ProposalGate isolation', 'ENGINEERING', 'packages/sunrey-agent. Agent cannot execute or override gates.'),
  internalSoft('int.consent-pdv', 'INTERNAL_SOFTWARE', 'Consent firewall and Personal Data Vault', 'ENGINEERING', 'packages/consent + packages/personal-data-vault.'),
  internalSoft('int.hin-software', 'INTERNAL_SOFTWARE', 'Human Information Network simulation marketplace', 'ENGINEERING', 'packages/information-market. Not a live data marketplace.'),
  internalSoft('int.custody-simulation', 'INTERNAL_SOFTWARE', 'Simulation custody and Travel Rule ports', 'ENGINEERING', 'packages/custody. Not a qualified custodian.'),
  internalSoft('int.payments-simulation', 'INTERNAL_SOFTWARE', 'Payment platform and rail adapters in simulation', 'ENGINEERING', 'packages/payments. LIVE_PAYMENTS_ENABLED remains false.'),
  internalSoft('int.cards-simulation', 'INTERNAL_SOFTWARE', 'Card spending-control simulation', 'ENGINEERING', 'packages/cards. Live issuer is not connected.'),
  internalSoft('int.fx-simulation', 'INTERNAL_SOFTWARE', 'FX quote engine in simulation', 'ENGINEERING', 'Simulation quotes are not a licensed FX venue.'),
  internalSoft('int.ai-runtime', 'INTERNAL_SOFTWARE', 'Canonical AI inference runtime (S3M-primary)', 'ENGINEERING', 'packages/ai-runtime. Inference is not Execution Authority.'),
  internalSoft('int.persistence', 'INTERNAL_SOFTWARE', 'PostgreSQL adapter and recovery fixtures', 'ENGINEERING', 'packages/persistence. Not a second ledger.'),
  internalSoft('int.ci-quality-gate', 'INTERNAL_SOFTWARE', 'CI architectural, kernel-gating, and production-safety stages', 'ENGINEERING', 'Internal CI is not an external audit.'),
  internalSoft('int.surveillance-detectors', 'INTERNAL_SOFTWARE', 'Deterministic market-surveillance detectors', 'ENGINEERING', 'Detectors exist; an operations desk does not.'),
  internalSoft('int.travel-rule-fixture', 'INTERNAL_SOFTWARE', 'Travel Rule fixture adapter', 'ENGINEERING', 'Fixture is not a Travel Rule network membership.'),
  internalSoft('int.provider-runtime', 'INTERNAL_SOFTWARE', 'Universal provider runtime and production-binding schema', 'ENGINEERING', 'Adapter architecture is not a live provider.'),
  internalSoft('int.gate-exception-process', 'GOVERNANCE', 'Auditable human-governance exception process', 'GOVERNANCE_ADMIN', 'Exceptions exist as a typed, hashed process. They cannot satisfy external audits via internal tests.'),
  internalSoft('ai.kill-switches', 'AI', 'Agent/model kill-switch software path', 'AGENT_OPERATIONS', 'Software kill switches exist. Operational staffing and production approval remain external.', ['BACKEND_SOFTWARE', 'LIMITED_LIVE', 'PRODUCTION']),
  internalSoft('ai.human-escalation', 'AI', 'Human escalation path for Agent proposals', 'AGENT_OPERATIONS', 'ProposalGate requires a human path. Named operators are a staffing gate.', ['BACKEND_SOFTWARE', 'LIMITED_LIVE', 'PRODUCTION']),
]);

const REGULATORY: readonly GateDefinition[] = Object.freeze([
  externalGate('reg.banking-payment-permission', 'REGULATORY', 'Banking / payment permissions applicable to offered products', 'REGULATORY_AFFAIRS', 'EXTERNAL_REGULATORY', 'Do not encode a legal conclusion. Unknown corridors stay RESEARCH_REQUIRED.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('reg.money-transmission', 'REGULATORY', 'Money-transmission / payment-institution requirements', 'REGULATORY_AFFAIRS', 'EXTERNAL_REGULATORY', 'COUNSEL_REVIEW_REQUIRED. This repository does not grant a license.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('reg.investment-brokerage', 'REGULATORY', 'Investment / brokerage permissions', 'REGULATORY_AFFAIRS', 'EXTERNAL_REGULATORY', 'COUNSEL_REVIEW_REQUIRED. Grow/investment paths stay simulation.', ['PRODUCTION', 'FRONTEND_LAUNCH']),
  externalGate('reg.digital-asset-exchange', 'REGULATORY', 'Digital-asset / Exchange permissions', 'REGULATORY_AFFAIRS', 'EXTERNAL_REGULATORY', 'Unlicensed Exchange activation remains incomplete.', ['PRODUCTION', 'EXCHANGE']),
  externalGate('reg.custody-permission', 'REGULATORY', 'Custody permissions / qualifications', 'REGULATORY_AFFAIRS', 'EXTERNAL_REGULATORY', 'Simulation custody is not a qualified custodian.', ['PRODUCTION', 'EXCHANGE', 'MAINNET']),
  externalGate('reg.privacy-data-processing', 'REGULATORY', 'Privacy / data-processing permissions', 'DATA_PRIVACY', 'EXTERNAL_REGULATORY', 'Engineering classes are not GDPR/CCPA/PDPL categories.', ['LIMITED_LIVE', 'PRODUCTION', 'FRONTEND_LAUNCH']),
  externalGate('reg.consumer-protection', 'REGULATORY', 'Consumer-protection requirements', 'REGULATORY_AFFAIRS', 'EXTERNAL_REGULATORY', 'COUNSEL_REVIEW_REQUIRED. No jurisdiction conclusion is encoded.', ['LIMITED_LIVE', 'PRODUCTION', 'FRONTEND_LAUNCH']),
  externalGate('reg.financial-promotion', 'REGULATORY', 'Financial-promotion / marketing permissions', 'REGULATORY_AFFAIRS', 'EXTERNAL_REGULATORY', 'COUNSEL_REVIEW_REQUIRED. Do not mark CONFIRMED_BY_COUNSEL here.', ['PRODUCTION', 'FRONTEND_LAUNCH']),
  externalGate('reg.travel-rule', 'REGULATORY', 'Travel Rule obligations where required', 'COMPLIANCE_OPERATIONS', 'EXTERNAL_REGULATORY', 'Pending Travel Rule blocks withdrawal. No network is connected.', ['PRODUCTION', 'EXCHANGE']),
  externalGate('reg.market-surveillance', 'REGULATORY', 'Market-surveillance operational requirements', 'EXCHANGE_SURVEILLANCE', 'EXTERNAL_REGULATORY', 'Detectors exist; a licensed/staffed surveillance desk does not.', ['PRODUCTION', 'EXCHANGE']),
]);

const LEGAL: readonly GateDefinition[] = Object.freeze([
  externalGate('legal.opinions', 'LEGAL', 'Legal opinions referenced by the registry', 'LEGAL_COUNSEL', 'EXTERNAL_LEGAL', 'Registry slot only. Do not draft substantive legal conclusions here.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('legal.terms', 'LEGAL', 'Customer terms of service', 'LEGAL_COUNSEL', 'EXTERNAL_LEGAL', 'Reference slot for executed terms. Not drafted here.', ['LIMITED_LIVE', 'PRODUCTION', 'FRONTEND_LAUNCH']),
  externalGate('legal.privacy-policy', 'LEGAL', 'Privacy policy', 'LEGAL_COUNSEL', 'EXTERNAL_LEGAL', 'Reference slot. Not a counsel-approved policy.', ['LIMITED_LIVE', 'PRODUCTION', 'FRONTEND_LAUNCH']),
  externalGate('legal.customer-agreements', 'LEGAL', 'Customer agreements', 'LEGAL_COUNSEL', 'EXTERNAL_LEGAL', 'Account agreements are required before protected deposits move.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('legal.risk-disclosures', 'LEGAL', 'Risk disclosures', 'LEGAL_COUNSEL', 'EXTERNAL_LEGAL', 'Investment/Exchange/Agent disclosures remain unapproved.', ['PRODUCTION', 'FRONTEND_LAUNCH', 'EXCHANGE']),
  externalGate('legal.provider-contracts', 'LEGAL', 'Provider contracts', 'LEGAL_COUNSEL', 'EXTERNAL_LEGAL', 'Commercial contracts are external evidence, not fixtures.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('legal.dpa', 'LEGAL', 'Data-processing agreements', 'DATA_PRIVACY', 'EXTERNAL_LEGAL', 'DPAs are not fabricated. Privacy counsel remains outstanding.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('legal.market-rules', 'LEGAL', 'Exchange market rules', 'LEGAL_COUNSEL', 'EXTERNAL_LEGAL', 'Internal policy is not an approved rulebook.', ['PRODUCTION', 'EXCHANGE']),
  externalGate('legal.listing-rules', 'LEGAL', 'Listing rules / listing approvals', 'LEGAL_COUNSEL', 'EXTERNAL_LEGAL', 'Simulation listings are not counsel-approved.', ['PRODUCTION', 'EXCHANGE']),
  externalGate('legal.custody-agreements', 'LEGAL', 'Custody agreements', 'LEGAL_COUNSEL', 'EXTERNAL_LEGAL', 'Qualified-custody agreements are absent.', ['PRODUCTION', 'EXCHANGE', 'MAINNET']),
  externalGate('legal.agent-disclosures', 'LEGAL', 'Agent disclosures', 'LEGAL_COUNSEL', 'EXTERNAL_LEGAL', 'Agent proposes; it does not authorize. Disclosures remain unapproved.', ['LIMITED_LIVE', 'PRODUCTION', 'FRONTEND_LAUNCH']),
]);

const SECURITY: readonly GateDefinition[] = Object.freeze([
  externalGate('sec.external-architecture-review', 'SECURITY', 'External security architecture review', 'SECURITY', 'EXTERNAL_AUDIT', 'Internal review is not an external architecture review.', ['LIMITED_LIVE', 'PRODUCTION', 'MAINNET']),
  externalGate('sec.external-pentest', 'SECURITY', 'External penetration test', 'SECURITY', 'EXTERNAL_AUDIT', 'Internal test suites and the adversarial range are not a live pentest report.', ['LIMITED_LIVE', 'PRODUCTION', 'MAINNET']),
  externalGate('sec.protocol-chain-audit', 'SECURITY', 'Protocol / Chain audit', 'SECURITY', 'EXTERNAL_AUDIT', 'No fabricated protocol-audit evidence. Range work is isolated.', ['PRODUCTION', 'MAINNET']),
  externalGate('sec.exchange-review', 'SECURITY', 'Exchange security review', 'SECURITY', 'EXTERNAL_AUDIT', 'Internal red-team tests are not an external Exchange review.', ['PRODUCTION', 'EXCHANGE']),
  externalGate('sec.cryptography-review', 'SECURITY', 'Cryptography review', 'SECURITY', 'EXTERNAL_AUDIT', 'Development HSM simulator is not a cryptography review.', ['PRODUCTION', 'MAINNET']),
  externalGate('sec.critical-findings-remediated', 'SECURITY', 'Critical findings remediated', 'SECURITY', 'EXTERNAL_AUDIT', 'Remediation evidence must be attached by the external reviewer path.', ['LIMITED_LIVE', 'PRODUCTION', 'MAINNET']),
  externalGate('sec.dependency-baseline', 'SECURITY', 'Dependency / security baseline', 'SECURITY', 'EXTERNAL_AUDIT', 'CI secret-scan and lockfile checks are not an external baseline attestation.', ['PRODUCTION']),
  externalGate('sec.hsm-kms', 'SECURITY', 'Production HSM / KMS', 'SECURITY', 'EXTERNAL_PROVIDER', 'Development HSM simulator is not a launch key.', ['LIMITED_LIVE', 'PRODUCTION', 'MAINNET']),
  externalGate('sec.key-ceremony-readiness', 'SECURITY', 'Key-ceremony readiness', 'SECURITY', 'EXTERNAL_HUMAN', 'Ceremony candidate is not a real production key ceremony.', ['PRODUCTION', 'MAINNET']),
]);

const AI: readonly GateDefinition[] = Object.freeze([
  externalGate('ai.approved-model-provider', 'AI', 'Approved model provider', 'AGENT_OPERATIONS', 'EXTERNAL_PROVIDER', 'S3M-primary simulation is not a production model approval.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('ai.dpa-privacy-review', 'AI', 'DPA / privacy review for model processing', 'DATA_PRIVACY', 'EXTERNAL_LEGAL', 'Model-provider DPA is absent. COUNSEL_REVIEW_REQUIRED.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('ai.financial-agent-eval', 'AI', 'Financial Agent evaluation threshold', 'AGENT_OPERATIONS', 'EXTERNAL_HUMAN', 'Eval thresholds are operational evidence, not inferred from a prompt.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('ai.prompt-injection-suite', 'AI', 'Prompt-injection evaluation suite result', 'SECURITY', 'EXTERNAL_AUDIT', 'Internal unit tests are not an accepted prompt-injection assurance package.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('ai.hallucination-suite', 'AI', 'Hallucination evaluation suite result', 'AGENT_OPERATIONS', 'EXTERNAL_HUMAN', 'Suite results must be registered. Internal fixtures do not satisfy.', ['PRODUCTION']),
  externalGate('ai.red-team-result', 'AI', 'AI red-team result', 'SECURITY', 'EXTERNAL_AUDIT', 'Internal red-team tests are not an external AI red-team report.', ['PRODUCTION']),
  externalGate('ai.model-version-pinning', 'AI', 'Model version pinning', 'AGENT_OPERATIONS', 'EXTERNAL_PROVIDER', 'Pinned production model versions are not configured.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('ai.operational-monitoring', 'AI', 'Agent operational monitoring', 'AGENT_OPERATIONS', 'EXTERNAL_HUMAN', 'Monitoring software exists; staffed Agent operations do not.', ['LIMITED_LIVE', 'PRODUCTION']),
]);

const PRIVACY: readonly GateDefinition[] = Object.freeze([
  externalGate('priv.privacy-counsel', 'PRIVACY', 'Privacy counsel review', 'DATA_PRIVACY', 'EXTERNAL_LEGAL', 'COUNSEL_REVIEW_REQUIRED. Engineering classes are not legal categories.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('priv.consent-language', 'PRIVACY', 'Consent language', 'DATA_PRIVACY', 'EXTERNAL_LEGAL', 'Consent taxonomy exists; counsel-approved language does not.', ['LIMITED_LIVE', 'PRODUCTION', 'FRONTEND_LAUNCH']),
  externalGate('priv.retention-schedule', 'PRIVACY', 'Retention schedule', 'DATA_PRIVACY', 'EXTERNAL_LEGAL', 'Default engineering retention is not a counsel-approved schedule.', ['PRODUCTION']),
  externalGate('priv.rights-request-process', 'PRIVACY', 'Data-subject rights-request process', 'DATA_PRIVACY', 'EXTERNAL_HUMAN', 'Vault export/delete exist; staffed rights operations do not.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('priv.data-source-contracts', 'PRIVACY', 'Data-source contracts', 'DATA_PRIVACY', 'EXTERNAL_LEGAL', 'Source contracts are not present.', ['PRODUCTION']),
  externalGate('priv.data-licenses', 'DATA_MARKETPLACE', 'Data licenses', 'DATA_PRIVACY', 'EXTERNAL_LEGAL', 'HIN licenses remain simulation. Not a live marketplace.', ['PRODUCTION']),
  externalGate('priv.dpa', 'PRIVACY', 'Privacy DPA coverage', 'DATA_PRIVACY', 'EXTERNAL_LEGAL', 'Duplicates the legal.dpa slot for privacy-scoped evaluation.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('priv.marketplace-legal-structure', 'DATA_MARKETPLACE', 'Data-marketplace legal structure', 'LEGAL_COUNSEL', 'EXTERNAL_LEGAL', 'HIN marketplace software is not a licensed market structure.', ['PRODUCTION']),
  externalGate('priv.approved-valuation-methodology', 'DATA_MARKETPLACE', 'Approved HIN / contribution valuation methodology', 'LEGAL_COUNSEL', 'EXTERNAL_HUMAN', 'Candidate valuation policy is not production valuation.', ['PRODUCTION']),
  externalGate('priv.approved-compensation-methodology', 'DATA_MARKETPLACE', 'Approved compensation methodology', 'LEGAL_COUNSEL', 'EXTERNAL_HUMAN', 'Do not invent tokenomics or compensation rates here.', ['PRODUCTION']),
]);

const CHAIN: readonly GateDefinition[] = Object.freeze([
  externalGate('chain.final-genesis', 'BLOCKCHAIN', 'Final genesis', 'HUMAN_GOVERNANCE', 'EXTERNAL_HUMAN', 'Ceremony candidate is not genesis.', ['MAINNET']),
  externalGate('chain.economic-parameters', 'BLOCKCHAIN', 'Final economic parameters', 'HUMAN_GOVERNANCE', 'EXTERNAL_HUMAN', 'Chunk 71 remains the mint. Fixture packages cannot authorize production.', ['MAINNET']),
  externalGate('chain.native-asset-parameters', 'BLOCKCHAIN', 'Native-asset parameters', 'HUMAN_GOVERNANCE', 'EXTERNAL_HUMAN', 'SunRey Coin / MoonRey Coin production parameters remain unconfigured.', ['MAINNET']),
  externalGate('chain.governance-authorization', 'GOVERNANCE', 'Governance authorization', 'HUMAN_GOVERNANCE', 'EXTERNAL_HUMAN', 'LAUNCH_AUTHORIZATION_CANDIDATE is not MAINNET_ACTIVE.', ['MAINNET']),
  externalGate('chain.validator-operators', 'BLOCKCHAIN', 'Validator operators', 'SRE_ONCALL', 'EXTERNAL_HUMAN', 'Testnet lifecycle is not production operator acceptance.', ['MAINNET']),
  externalGate('chain.hsm-kms', 'BLOCKCHAIN', 'Chain HSM / KMS', 'SECURITY', 'EXTERNAL_PROVIDER', 'Simulation key provider is not a launch key.', ['MAINNET']),
  externalGate('chain.protocol-audit', 'BLOCKCHAIN', 'Protocol audit', 'SECURITY', 'EXTERNAL_AUDIT', 'External protocol review is not present.', ['MAINNET']),
  externalGate('chain.genesis-ceremony', 'GOVERNANCE', 'Genesis ceremony', 'HUMAN_GOVERNANCE', 'EXTERNAL_HUMAN', 'Dress rehearsal is not the ceremony. Do not execute here.', ['MAINNET']),
  externalGate('chain.infrastructure', 'INFRASTRUCTURE', 'Production infrastructure', 'SRE_ONCALL', 'EXTERNAL_PROVIDER', 'Simulation hosts are not production.', ['MAINNET', 'PRODUCTION']),
  externalGate('chain.monitoring', 'INFRASTRUCTURE', 'Chain monitoring', 'SRE_ONCALL', 'EXTERNAL_HUMAN', 'Monitoring catalogs exist; staffed on-call does not.', ['MAINNET', 'PRODUCTION']),
  externalGate('chain.on-call', 'OPERATIONS', 'On-call acceptance', 'SRE_ONCALL', 'EXTERNAL_HUMAN', 'Operator acceptance remains fixture / not real.', ['MAINNET', 'LIMITED_LIVE', 'PRODUCTION']),
  externalGate('chain.incident-response', 'OPERATIONS', 'Incident response', 'INCIDENT_COMMANDER', 'EXTERNAL_HUMAN', 'Runbooks exist; named incident commanders do not.', ['MAINNET', 'LIMITED_LIVE', 'PRODUCTION']),
  externalGate('chain.backup-recovery', 'INFRASTRUCTURE', 'Backup / recovery', 'SRE_ONCALL', 'EXTERNAL_HUMAN', 'Restore catalogs exist; a successful production restore evidence pack does not.', ['MAINNET', 'PRODUCTION']),
  externalGate('chain.mainnet-activation-approval', 'GOVERNANCE', 'Mainnet activation approval', 'HUMAN_GOVERNANCE', 'EXTERNAL_HUMAN', 'Building mainnet software is not activating mainnet.', ['MAINNET']),
]);

const EXCHANGE: readonly GateDefinition[] = Object.freeze([
  externalGate('ex.regulatory-authorization', 'EXCHANGE', 'Exchange regulatory authorization', 'REGULATORY_AFFAIRS', 'EXTERNAL_REGULATORY', 'Unlicensed activation remains incomplete.', ['PRODUCTION', 'EXCHANGE']),
  externalGate('ex.market-rules', 'EXCHANGE', 'Approved market rules', 'LEGAL_COUNSEL', 'EXTERNAL_LEGAL', 'Internal policy is not an approved rulebook.', ['PRODUCTION', 'EXCHANGE']),
  externalGate('ex.listing-approvals', 'EXCHANGE', 'Listing approvals', 'LEGAL_COUNSEL', 'EXTERNAL_HUMAN', 'Simulation listings are not counsel-approved.', ['PRODUCTION', 'EXCHANGE']),
  externalGate('ex.custody', 'EXCHANGE', 'Qualified Exchange custody', 'CUSTODY_OPERATIONS', 'EXTERNAL_PROVIDER', 'Simulation custody is not a qualified custodian.', ['PRODUCTION', 'EXCHANGE']),
  externalGate('ex.banking-settlement', 'EXCHANGE', 'Banking / settlement', 'TREASURY', 'EXTERNAL_PROVIDER', 'LIVE_BANKING_RAILS stays false.', ['PRODUCTION', 'EXCHANGE']),
  externalGate('ex.market-data', 'EXCHANGE', 'Licensed market data', 'PROVIDER_OPERATIONS', 'EXTERNAL_PROVIDER', 'Sandbox indicators are not licensed feeds.', ['PRODUCTION', 'EXCHANGE']),
  externalGate('ex.surveillance', 'EXCHANGE', 'Staffed market surveillance', 'EXCHANGE_SURVEILLANCE', 'EXTERNAL_HUMAN', 'Detectors exist; an operations desk does not.', ['PRODUCTION', 'EXCHANGE']),
  externalGate('ex.travel-rule', 'EXCHANGE', 'Exchange Travel Rule', 'COMPLIANCE_OPERATIONS', 'EXTERNAL_PROVIDER', 'No Travel Rule network is connected.', ['PRODUCTION', 'EXCHANGE']),
  externalGate('ex.compliance', 'EXCHANGE', 'Exchange compliance operations', 'COMPLIANCE_OPERATIONS', 'EXTERNAL_HUMAN', 'Kernel fixtures are not a compliance desk.', ['PRODUCTION', 'EXCHANGE']),
  externalGate('ex.staffing', 'EXCHANGE', 'Exchange operational staffing', 'EXCHANGE_SURVEILLANCE', 'EXTERNAL_HUMAN', 'Staffing is an external input. Named people are not assigned here.', ['PRODUCTION', 'EXCHANGE']),
  externalGate('ex.security-review', 'EXCHANGE', 'Exchange security review evidence', 'SECURITY', 'EXTERNAL_AUDIT', 'Internal tests are not an external review.', ['PRODUCTION', 'EXCHANGE']),
  externalGate('ex.incident-management', 'EXCHANGE', 'Exchange incident management', 'INCIDENT_COMMANDER', 'EXTERNAL_HUMAN', 'Procedures require named operators.', ['PRODUCTION', 'EXCHANGE']),
  externalGate('ex.production-capital-liquidity', 'EXCHANGE', 'Production capital / liquidity requirements', 'TREASURY', 'EXTERNAL_HUMAN', 'If applicable after counsel review. Not encoded as a legal conclusion.', ['PRODUCTION', 'EXCHANGE']),
]);

const STAFFING: readonly GateDefinition[] = Object.freeze([
  externalGate('ops.compliance-operations', 'OPERATIONS', 'Compliance operations role filled', 'COMPLIANCE_OPERATIONS', 'EXTERNAL_HUMAN', 'Role is defined. Named people are not assigned unless explicitly configured.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('ops.fraud', 'OPERATIONS', 'Fraud operations role filled', 'FRAUD', 'EXTERNAL_HUMAN', 'Role is defined. No named assignee in this repository.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('ops.payments', 'OPERATIONS', 'Payments operations role filled', 'PAYMENTS', 'EXTERNAL_HUMAN', 'Role is defined. No named assignee in this repository.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('ops.treasury', 'OPERATIONS', 'Treasury role filled', 'TREASURY', 'EXTERNAL_HUMAN', 'Role is defined. No named assignee in this repository.', ['PRODUCTION']),
  externalGate('ops.reconciliation', 'OPERATIONS', 'Reconciliation role filled', 'RECONCILIATION', 'EXTERNAL_HUMAN', 'Role is defined. No named assignee in this repository.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('ops.exchange-surveillance', 'OPERATIONS', 'Exchange surveillance role filled', 'EXCHANGE_SURVEILLANCE', 'EXTERNAL_HUMAN', 'Role is defined. No named assignee in this repository.', ['PRODUCTION', 'EXCHANGE']),
  externalGate('ops.custody-operations', 'OPERATIONS', 'Custody operations role filled', 'CUSTODY_OPERATIONS', 'EXTERNAL_HUMAN', 'Role is defined. No named assignee in this repository.', ['PRODUCTION', 'EXCHANGE']),
  externalGate('ops.sre-oncall', 'OPERATIONS', 'SRE / on-call role filled', 'SRE_ONCALL', 'EXTERNAL_HUMAN', 'Role is defined. No named assignee in this repository.', ['LIMITED_LIVE', 'PRODUCTION', 'MAINNET']),
  externalGate('ops.security', 'OPERATIONS', 'Security operations role filled', 'SECURITY', 'EXTERNAL_HUMAN', 'Role is defined. No named assignee in this repository.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('ops.customer-support', 'OPERATIONS', 'Customer support role filled', 'CUSTOMER_SUPPORT', 'EXTERNAL_HUMAN', 'Role is defined. No named assignee in this repository.', ['LIMITED_LIVE', 'PRODUCTION', 'FRONTEND_LAUNCH']),
  externalGate('ops.incident-commander', 'OPERATIONS', 'Incident commander role filled', 'INCIDENT_COMMANDER', 'EXTERNAL_HUMAN', 'Role is defined. No named assignee in this repository.', ['LIMITED_LIVE', 'PRODUCTION', 'MAINNET']),
  externalGate('ops.data-privacy', 'OPERATIONS', 'Data privacy role filled', 'DATA_PRIVACY', 'EXTERNAL_HUMAN', 'Role is defined. No named assignee in this repository.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('ops.agent-operations', 'OPERATIONS', 'Agent operations role filled', 'AGENT_OPERATIONS', 'EXTERNAL_HUMAN', 'Role is defined. No named assignee in this repository.', ['LIMITED_LIVE', 'PRODUCTION']),
]);

const TRAINING: readonly GateDefinition[] = Object.freeze([
  externalGate('train.operator-training', 'TRAINING', 'Operator training evidence', 'SRE_ONCALL', 'EXTERNAL_HUMAN', 'Training completion is external evidence.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('train.role-approval', 'TRAINING', 'Role approval evidence', 'GOVERNANCE_ADMIN', 'EXTERNAL_HUMAN', 'Role approval is a human governance record.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('train.privileged-access-approval', 'TRAINING', 'Privileged-access approval', 'SECURITY', 'EXTERNAL_HUMAN', 'Privileged access is not granted from this repository.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('train.runbook-acknowledgement', 'TRAINING', 'Runbook acknowledgement', 'INCIDENT_COMMANDER', 'EXTERNAL_HUMAN', 'Runbooks exist; signed acknowledgements do not.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('train.incident-exercises', 'TRAINING', 'Incident-exercise participation', 'INCIDENT_COMMANDER', 'EXTERNAL_HUMAN', 'Catalog drills are not a staffed incident exercise.', ['PRODUCTION']),
]);

const BUSINESS_CONTINUITY: readonly GateDefinition[] = Object.freeze([
  externalGate('bc.backup-restore', 'BUSINESS_CONTINUITY', 'Successful backup restore', 'SRE_ONCALL', 'EXTERNAL_HUMAN', 'Restore catalogs exist; a signed production restore pack does not.', ['PRODUCTION', 'MAINNET']),
  externalGate('bc.dr-rehearsal', 'BUSINESS_CONTINUITY', 'Successful DR rehearsal', 'SRE_ONCALL', 'EXTERNAL_HUMAN', 'Engineering rehearsal is not a production DR sign-off.', ['PRODUCTION', 'MAINNET']),
  externalGate('bc.incident-exercise', 'BUSINESS_CONTINUITY', 'Successful incident exercise', 'INCIDENT_COMMANDER', 'EXTERNAL_HUMAN', 'Fixture incident records are not a live exercise.', ['PRODUCTION']),
  externalGate('bc.provider-failure-exercise', 'BUSINESS_CONTINUITY', 'Successful provider-failure exercise', 'PROVIDER_OPERATIONS', 'EXTERNAL_HUMAN', 'Provider failure rehearsal evidence is absent.', ['PRODUCTION']),
  externalGate('bc.rollback-exercise', 'BUSINESS_CONTINUITY', 'Successful rollback exercise', 'SRE_ONCALL', 'EXTERNAL_HUMAN', 'Application rollback is not chain-history rollback. Evidence is absent.', ['PRODUCTION', 'MAINNET']),
]);

const RECONCILIATION: readonly GateDefinition[] = Object.freeze([
  externalGate('rec.ledger-balances', 'RECONCILIATION', 'Preproduction Ledger balance reconciliation', 'RECONCILIATION', 'EXTERNAL_HUMAN', 'Burn-in reconciliation is engineering, not a signed preproduction pack.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('rec.provider-balances', 'RECONCILIATION', 'Provider-balance reconciliation', 'RECONCILIATION', 'EXTERNAL_PROVIDER', 'No live provider balances exist to reconcile.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('rec.exchange', 'RECONCILIATION', 'Exchange reconciliation', 'RECONCILIATION', 'EXTERNAL_HUMAN', 'Sandbox books are not production Exchange reconciliation.', ['PRODUCTION', 'EXCHANGE']),
  externalGate('rec.custody', 'RECONCILIATION', 'Custody reconciliation', 'RECONCILIATION', 'EXTERNAL_PROVIDER', 'Simulation custody positions are not qualified-custody books.', ['PRODUCTION', 'EXCHANGE']),
  externalGate('rec.treasury', 'RECONCILIATION', 'Treasury reconciliation', 'TREASURY', 'EXTERNAL_HUMAN', 'Treasury acceptance evidence is absent.', ['PRODUCTION']),
  externalGate('rec.settlements', 'RECONCILIATION', 'Settlement reconciliation', 'RECONCILIATION', 'EXTERNAL_HUMAN', 'DVP simulation is not production settlement evidence.', ['PRODUCTION', 'EXCHANGE']),
]);

const CUSTOMER_EXPERIENCE: readonly GateDefinition[] = Object.freeze([
  internalSoft('cx.authentication', 'CUSTOMER_EXPERIENCE', 'Backend authentication/session contract for frontend launch', 'ENGINEERING', 'BFF auth surface exists. Frontend UI is not required in this repository.', ['BACKEND_SOFTWARE', 'FRONTEND_LAUNCH']),
  externalGate('cx.onboarding-kyc', 'CUSTOMER_EXPERIENCE', 'Onboarding / KYC launch readiness', 'COMPLIANCE_OPERATIONS', 'EXTERNAL_PROVIDER', 'Backend KYC metadata exists. Live KYC and counsel-approved onboarding copy do not.', ['FRONTEND_LAUNCH', 'LIMITED_LIVE', 'PRODUCTION']),
  internalSoft('cx.home', 'CUSTOMER_EXPERIENCE', 'Home aggregation contract', 'ENGINEERING', 'Consumer BFF home exists. Lovable UI is not required here.', ['BACKEND_SOFTWARE', 'FRONTEND_LAUNCH']),
  internalSoft('cx.money', 'CUSTOMER_EXPERIENCE', 'Money / balances contract', 'ENGINEERING', 'Ledger-derived balances only. No yield field.', ['BACKEND_SOFTWARE', 'FRONTEND_LAUNCH']),
  internalSoft('cx.send', 'CUSTOMER_EXPERIENCE', 'Send / payments contract', 'ENGINEERING', 'Payment platform is simulation. Live rails remain a provider gate.', ['BACKEND_SOFTWARE', 'FRONTEND_LAUNCH']),
  internalSoft('cx.fx', 'CUSTOMER_EXPERIENCE', 'FX contract', 'ENGINEERING', 'Simulation quotes. Live FX is a provider gate.', ['BACKEND_SOFTWARE', 'FRONTEND_LAUNCH']),
  internalSoft('cx.cards', 'CUSTOMER_EXPERIENCE', 'Cards contract', 'ENGINEERING', 'PCI-minimized dashboard. Live issuer is a provider gate.', ['BACKEND_SOFTWARE', 'FRONTEND_LAUNCH']),
  internalSoft('cx.grow', 'CUSTOMER_EXPERIENCE', 'Grow contract', 'ENGINEERING', 'Illustrations only. Not a promised return.', ['BACKEND_SOFTWARE', 'FRONTEND_LAUNCH']),
  internalSoft('cx.agent', 'CUSTOMER_EXPERIENCE', 'Agent contract', 'ENGINEERING', 'Agent proposes. It cannot self-approve or override gates.', ['BACKEND_SOFTWARE', 'FRONTEND_LAUNCH']),
  internalSoft('cx.exchange', 'CUSTOMER_EXPERIENCE', 'Exchange contract', 'ENGINEERING', 'Sandbox Exchange APIs. Live Exchange is gated separately.', ['BACKEND_SOFTWARE', 'FRONTEND_LAUNCH']),
  internalSoft('cx.vault', 'CUSTOMER_EXPERIENCE', 'Vault contract', 'ENGINEERING', 'Personal Data Vault BFF exists. Live monetization stays disabled.', ['BACKEND_SOFTWARE', 'FRONTEND_LAUNCH']),
  internalSoft('cx.profile-security', 'CUSTOMER_EXPERIENCE', 'Profile / security contract', 'ENGINEERING', 'Profile reads and preference PATCH only.', ['BACKEND_SOFTWARE', 'FRONTEND_LAUNCH']),
  internalSoft('cx.support', 'CUSTOMER_EXPERIENCE', 'Support contract', 'ENGINEERING', 'Backend can define the support requirement. Staffed support remains ops.customer-support.', ['BACKEND_SOFTWARE', 'FRONTEND_LAUNCH']),
  externalGate('cx.legal-disclosures', 'CUSTOMER_EXPERIENCE', 'Legal disclosures for frontend launch', 'LEGAL_COUNSEL', 'EXTERNAL_LEGAL', 'Disclosure copy is a legal evidence slot. Not drafted here.', ['FRONTEND_LAUNCH', 'LIMITED_LIVE', 'PRODUCTION']),
]);

const PRODUCT_DOMAIN: readonly GateDefinition[] = Object.freeze([
  externalGate('bank.operating-permission', 'BANKING', 'Banking operating permission for offered products', 'REGULATORY_AFFAIRS', 'EXTERNAL_REGULATORY', 'COUNSEL_REVIEW_REQUIRED. Not a license grant.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('pay.institution-permission', 'PAYMENTS', 'Payment-institution / EMI / MTL permission as applicable', 'REGULATORY_AFFAIRS', 'EXTERNAL_REGULATORY', 'Do not select a non-permitted route. Regulatory compatibility is a filter.', ['LIMITED_LIVE', 'PRODUCTION']),
  externalGate('card.issuer-permission', 'CARDS', 'Card issuing / BIN sponsorship permission', 'REGULATORY_AFFAIRS', 'EXTERNAL_REGULATORY', 'COUNSEL_REVIEW_REQUIRED. Live issuer stays disconnected.', ['PRODUCTION']),
  externalGate('inv.broker-dealer-permission', 'INVESTMENTS', 'Broker-dealer / investment-intermediary permission', 'REGULATORY_AFFAIRS', 'EXTERNAL_REGULATORY', 'Grow remains illustration-only until this gate is externally satisfied.', ['PRODUCTION']),
  externalGate('inf.dns-certificates', 'INFRASTRUCTURE', 'DNS / certificates', 'SRE_ONCALL', 'EXTERNAL_PROVIDER', 'Not present in this repository.', ['PRODUCTION', 'MAINNET'], { exceptionEligible: true }),
  externalGate('gov.limited-live-cohort', 'GOVERNANCE', 'Limited-live cohort authorization', 'HUMAN_GOVERNANCE', 'EXTERNAL_HUMAN', 'Cohort selection is a human governance record.', ['LIMITED_LIVE']),
]);

export const PRODUCTION_GATE_CATALOG: readonly GateDefinition[] = Object.freeze([
  ...INTERNAL_SOFTWARE,
  ...REGULATORY,
  ...LEGAL,
  ...providerGates(),
  ...SECURITY,
  ...AI,
  ...PRIVACY,
  ...CHAIN,
  ...EXCHANGE,
  ...STAFFING,
  ...TRAINING,
  ...BUSINESS_CONTINUITY,
  ...RECONCILIATION,
  ...CUSTOMER_EXPERIENCE,
  ...PRODUCT_DOMAIN,
]);

export function catalogById(): ReadonlyMap<string, GateDefinition> {
  return new Map(PRODUCTION_GATE_CATALOG.map((row) => [row.gateId, row]));
}

export function catalogIds(): readonly string[] {
  return Object.freeze(PRODUCTION_GATE_CATALOG.map((row) => row.gateId));
}

export function catalogForCategory(category: GateCategory): readonly GateDefinition[] {
  return Object.freeze(PRODUCTION_GATE_CATALOG.filter((row) => row.category === category));
}

export const PRODUCTION_STAFFING_ROLES: readonly OwnerRole[] = Object.freeze([
  'COMPLIANCE_OPERATIONS',
  'FRAUD',
  'PAYMENTS',
  'TREASURY',
  'RECONCILIATION',
  'EXCHANGE_SURVEILLANCE',
  'CUSTODY_OPERATIONS',
  'SRE_ONCALL',
  'SECURITY',
  'CUSTOMER_SUPPORT',
  'INCIDENT_COMMANDER',
  'DATA_PRIVACY',
  'AGENT_OPERATIONS',
]);

import { asUtcInstant, type UtcInstant } from '../../../../domain/src/time.ts';
import type { LegalReviewStatus } from '../types.ts';
import {
  CAPABILITY_ACTIONS,
  CAPABILITY_CATEGORIES,
  EU_MEMBER_STATE_CODES,
  HELIOS_JURISDICTION_IDS,
  JURISDICTION_CAPABILITY_POLICY_VERSION,
  type CapabilityAction,
  type CapabilityCategory,
  type HeliosJurisdictionId,
  type JurisdictionCapabilityState,
} from './taxonomy.ts';
import type {
  JurisdictionCapabilityDefinition,
  JurisdictionCapabilityPack,
  JurisdictionOverlay,
} from './types.ts';

const PACK_EFFECTIVE_FROM = asUtcInstant('2020-01-01T00:00:00.000Z');
const SEED_NOW = asUtcInstant('2026-09-18T00:00:00.000Z');
const ENGINEERING_SOURCE = 'src-h28-engineering-shell';
const NO_LICENSE_SOURCE = 'src-no-live-license';

/** Default status per jurisdiction — no fabricated licensing. */
const JURISDICTION_DEFAULT_STATUS: Readonly<Record<HeliosJurisdictionId, JurisdictionCapabilityState>> =
  Object.freeze({
    EU: 'RESEARCH_REQUIRED',
    GB: 'RESEARCH_REQUIRED',
    US: 'RESEARCH_REQUIRED',
    SA: 'RESEARCH_REQUIRED',
    IN: 'LEGAL_REVIEW_REQUIRED',
    CN: 'LEGAL_REVIEW_REQUIRED',
    JP: 'LEGAL_REVIEW_REQUIRED',
    SG: 'LEGAL_REVIEW_REQUIRED',
    KR: 'LEGAL_REVIEW_REQUIRED',
    MY: 'LEGAL_REVIEW_REQUIRED',
    AU: 'LEGAL_REVIEW_REQUIRED',
  });

/** Per-action overrides where engineering shell exists or explicit restriction required. */
const ACTION_OVERRIDES: Partial<
  Readonly<Record<HeliosJurisdictionId, Partial<Readonly<Record<CapabilityAction, JurisdictionCapabilityState>>>>>
> = Object.freeze({
  GB: Object.freeze({
    CASH_ACCOUNT: 'SANDBOX_ONLY',
    INVESTING: 'SANDBOX_ONLY',
    HELIOS_RESEARCH: 'SANDBOX_ONLY',
    HELIOS_PROPOSAL: 'SANDBOX_ONLY',
    TRANSFERS_PAYMENTS: 'SANDBOX_ONLY',
  }),
  US: Object.freeze({
    CASH_ACCOUNT: 'SANDBOX_ONLY',
    HELIOS_RESEARCH: 'SANDBOX_ONLY',
    HELIOS_PROPOSAL: 'SANDBOX_ONLY',
  }),
  CN: Object.freeze({
    DIGITAL_ASSETS: 'DISABLED',
    INVESTING: 'RESTRICTED',
    ORDER_SUBMISSION: 'RESTRICTED',
  }),
  SA: Object.freeze({
    CASH_ACCOUNT: 'DISABLED',
    DIGITAL_ASSETS: 'RESEARCH_REQUIRED',
  }),
});

const LEGAL_ENTITY_BY_JURISDICTION: Readonly<Record<HeliosJurisdictionId, string>> = Object.freeze({
  EU: 'le_solstice_eu_entity',
  GB: 'le_solstice_uk_ltd',
  US: 'le_solstice_us_inc',
  SA: 'le_solstice_sa_entity',
  IN: 'le_solstice_research_placeholder',
  CN: 'le_solstice_research_placeholder',
  JP: 'le_solstice_research_placeholder',
  SG: 'le_solstice_research_placeholder',
  KR: 'le_solstice_research_placeholder',
  MY: 'le_solstice_research_placeholder',
  AU: 'le_solstice_research_placeholder',
});

const CATEGORY_FOR_ACTION: Readonly<Record<CapabilityAction, CapabilityCategory>> = Object.freeze({
  CASH_ACCOUNT: 'PRODUCT',
  INVESTING: 'PRODUCT',
  DIGITAL_ASSETS: 'PRODUCT',
  FINANCIAL_ADVICE: 'ALGORITHM_AI',
  AUTOMATED_ACTIVITY: 'ALGORITHM_AI',
  TRANSFERS_PAYMENTS: 'PRODUCT',
  HELIOS_RESEARCH: 'ALGORITHM_AI',
  HELIOS_PROPOSAL: 'ALGORITHM_AI',
  HELIOS_STRATEGY_ACTIVATION: 'ALGORITHM_AI',
  HELIOS_WORK_ORDER_ACTIVATION: 'ALGORITHM_AI',
  PROVIDER_PROVISIONING: 'MARKET_ACCESS',
  ORDER_SUBMISSION: 'MARKET_ACCESS',
  WITHDRAWAL: 'PRODUCT',
  DATA_MODEL_USE: 'DATA',
});

function counselStateFor(status: JurisdictionCapabilityState): LegalReviewStatus {
  if (status === 'APPROVED_FOR_PRODUCTION' || status === 'APPROVED_FOR_TEST') {
    return 'COUNSEL_REVIEWED';
  }
  if (status === 'LEGAL_REVIEW_REQUIRED') {
    return 'RESEARCH_REQUIRED';
  }
  return 'RESEARCH_REQUIRED';
}

function capabilityEntry(input: {
  readonly jurisdictionId: HeliosJurisdictionId;
  readonly action: CapabilityAction;
  readonly status: JurisdictionCapabilityState;
  readonly overlayId?: string;
  readonly customerClass?: string;
  readonly environment?: 'simulation' | 'live';
  readonly providerDependency?: JurisdictionCapabilityDefinition['providerDependency'];
  readonly restrictions?: readonly string[];
}): JurisdictionCapabilityDefinition {
  const legalEntityId = LEGAL_ENTITY_BY_JURISDICTION[input.jurisdictionId];
  const category = CATEGORY_FOR_ACTION[input.action];
  const env = input.environment ?? 'simulation';
  const capabilityId = [
    'jcap',
    input.jurisdictionId.toLowerCase(),
    input.overlayId ?? 'base',
    input.action.toLowerCase(),
    input.customerClass ?? 'retail',
    env,
  ].join('-');

  return Object.freeze({
    capabilityId,
    jurisdictionId: input.jurisdictionId,
    jurisdictionVersion: JURISDICTION_CAPABILITY_POLICY_VERSION,
    legalEntityId,
    productId: null,
    customerClass: input.customerClass ?? 'RETAIL',
    accountClass: null,
    providerId: null,
    action: input.action,
    instrumentClass: null,
    advisoryClassification: category === 'ALGORITHM_AI' ? 'ADVISORY_UNVERIFIED' : null,
    environment: env,
    status: input.status,
    effectiveFrom: PACK_EFFECTIVE_FROM,
    effectiveUntil: null,
    evidenceRefs: Object.freeze([ENGINEERING_SOURCE]),
    counselReviewState: counselStateFor(input.status),
    policyVersion: JURISDICTION_CAPABILITY_POLICY_VERSION,
    reasonCodes: Object.freeze([
      input.status === 'SANDBOX_ONLY' ? 'SIMULATION_STRUCTURAL_PERMIT' : 'RESEARCH_REQUIRED_PLACEHOLDER',
    ]),
    restrictions: Object.freeze(input.restrictions ?? []),
    providerDependency: input.providerDependency ?? 'UNKNOWN',
    reportingObligationRefs: Object.freeze([]),
    requiredControls: Object.freeze(
      input.status === 'SANDBOX_ONLY' ? ['SIMULATION_ENVIRONMENT_ONLY'] : ['LEGAL_REVIEW_REQUIRED'],
    ),
    requiredApprovalClass:
      input.status === 'SANDBOX_ONLY'
        ? 'INFORMED'
        : input.status === 'RESTRICTED'
          ? 'COMPLIANCE_REVIEW'
          : null,
    sourceReference: input.status === 'SANDBOX_ONLY' ? ENGINEERING_SOURCE : NO_LICENSE_SOURCE,
    overlayId: input.overlayId ?? null,
    createdAt: SEED_NOW,
    updatedAt: SEED_NOW,
  });
}

function defaultStatus(jurisdictionId: HeliosJurisdictionId, action: CapabilityAction): JurisdictionCapabilityState {
  const override = ACTION_OVERRIDES[jurisdictionId]?.[action];
  if (override) return override;
  return JURISDICTION_DEFAULT_STATUS[jurisdictionId];
}

function buildBaseCapabilities(jurisdictionId: HeliosJurisdictionId): JurisdictionCapabilityDefinition[] {
  const rows: JurisdictionCapabilityDefinition[] = [];
  for (const action of CAPABILITY_ACTIONS) {
    const status = defaultStatus(jurisdictionId, action);
    rows.push(
      capabilityEntry({ jurisdictionId, action, status, customerClass: 'RETAIL', environment: 'simulation' }),
    );
    rows.push(
      capabilityEntry({
        jurisdictionId,
        action,
        status: status === 'SANDBOX_ONLY' ? 'SANDBOX_ONLY' : status === 'APPROVED_FOR_TEST' ? 'DISABLED' : status,
        customerClass: 'RETAIL',
        environment: 'live',
        restrictions: Object.freeze(['LIVE_CAPABILITY_DISABLED']),
      }),
    );
    rows.push(
      capabilityEntry({
        jurisdictionId,
        action,
        status: defaultStatus(jurisdictionId, action),
        customerClass: 'INSTITUTIONAL',
        environment: 'simulation',
        restrictions: Object.freeze(['INSTITUTIONAL_CLASS_UNVERIFIED']),
      }),
    );
  }
  return rows;
}

function euOverlays(): readonly JurisdictionOverlay[] {
  return Object.freeze(
    EU_MEMBER_STATE_CODES.map((code) =>
      Object.freeze({
        overlayId: `eu-ms-${code.toLowerCase()}`,
        kind: 'EU_MEMBER_STATE' as const,
        overlayKey: code,
        parentJurisdictionId: 'EU' as const,
        description: `EU member-state overlay for ${code}. Does not assume passporting or uniform permission.`,
        sourceReference: ENGINEERING_SOURCE,
        legalReviewStatus: 'RESEARCH_REQUIRED' as LegalReviewStatus,
      }),
    ),
  );
}

function euMemberStateCapabilities(): JurisdictionCapabilityDefinition[] {
  const rows: JurisdictionCapabilityDefinition[] = [];
  for (const code of EU_MEMBER_STATE_CODES.slice(0, 3)) {
    for (const action of ['CASH_ACCOUNT', 'INVESTING', 'DIGITAL_ASSETS'] as const) {
      rows.push(
        capabilityEntry({
          jurisdictionId: 'EU',
          action,
          status: 'RESEARCH_REQUIRED',
          overlayId: `eu-ms-${code.toLowerCase()}`,
          restrictions: Object.freeze([`MEMBER_STATE_OVERLAY_${code}`]),
        }),
      );
    }
  }
  return rows;
}

function usOverlays(): readonly JurisdictionOverlay[] {
  return Object.freeze([
    Object.freeze({
      overlayId: 'us-state-ca',
      kind: 'US_STATE' as const,
      overlayKey: 'CA',
      parentJurisdictionId: 'US' as const,
      description: 'US California state overlay placeholder. No substantive state rules encoded.',
      sourceReference: ENGINEERING_SOURCE,
      legalReviewStatus: 'RESEARCH_REQUIRED' as LegalReviewStatus,
    }),
    Object.freeze({
      overlayId: 'us-state-ny',
      kind: 'US_STATE' as const,
      overlayKey: 'NY',
      parentJurisdictionId: 'US' as const,
      description: 'US New York state overlay placeholder. No substantive state rules encoded.',
      sourceReference: ENGINEERING_SOURCE,
      legalReviewStatus: 'RESEARCH_REQUIRED' as LegalReviewStatus,
    }),
  ]);
}

function usStateCapabilities(): JurisdictionCapabilityDefinition[] {
  return [
    capabilityEntry({
      jurisdictionId: 'US',
      action: 'INVESTING',
      status: 'RESEARCH_REQUIRED',
      overlayId: 'us-state-ca',
      restrictions: Object.freeze(['US_STATE_OVERLAY_CA']),
    }),
    capabilityEntry({
      jurisdictionId: 'US',
      action: 'DIGITAL_ASSETS',
      status: 'RESEARCH_REQUIRED',
      overlayId: 'us-state-ny',
      restrictions: Object.freeze(['US_STATE_OVERLAY_NY']),
    }),
  ];
}

function saPartnerDependent(): JurisdictionCapabilityDefinition[] {
  return [
    capabilityEntry({
      jurisdictionId: 'SA',
      action: 'TRANSFERS_PAYMENTS',
      status: 'PARTNER_DEPENDENT',
      providerDependency: 'PARTNER_DEPENDENT',
      restrictions: Object.freeze(['SPONSOR_BANK_REQUIRED']),
    }),
  ];
}

function cnExplicitRestrictions(): JurisdictionCapabilityDefinition[] {
  return CAPABILITY_ACTIONS.filter((a) => a === 'DIGITAL_ASSETS' || a === 'ORDER_SUBMISSION').map((action) =>
    capabilityEntry({
      jurisdictionId: 'CN',
      action,
      status: action === 'DIGITAL_ASSETS' ? 'DISABLED' : 'RESTRICTED',
      restrictions: Object.freeze(['CN_EXPLICIT_RESTRICTION']),
    }),
  );
}

function buildPack(jurisdictionId: HeliosJurisdictionId): JurisdictionCapabilityPack {
  const names: Record<HeliosJurisdictionId, string> = {
    EU: 'European Union capability framework',
    GB: 'United Kingdom capability framework',
    US: 'United States capability framework',
    SA: 'Saudi Arabia capability framework',
    IN: 'India capability framework',
    CN: 'Mainland China capability framework',
    JP: 'Japan capability framework',
    SG: 'Singapore capability framework',
    KR: 'South Korea capability framework',
    MY: 'Malaysia capability framework',
    AU: 'Australia capability framework',
  };

  let capabilities = buildBaseCapabilities(jurisdictionId);
  let overlays: readonly JurisdictionOverlay[] = Object.freeze([]);

  if (jurisdictionId === 'EU') {
    overlays = euOverlays();
    capabilities = [...capabilities, ...euMemberStateCapabilities()];
  }
  if (jurisdictionId === 'US') {
    overlays = usOverlays();
    capabilities = [...capabilities, ...usStateCapabilities()];
  }
  if (jurisdictionId === 'SA') {
    capabilities = [...capabilities, ...saPartnerDependent()];
  }
  if (jurisdictionId === 'CN') {
    capabilities = [...capabilities, ...cnExplicitRestrictions()];
  }

  return Object.freeze({
    packId: jurisdictionId,
    packVersion: JURISDICTION_CAPABILITY_POLICY_VERSION,
    name: names[jurisdictionId],
    description: `Engineering capability shell for ${jurisdictionId}. Not a legal opinion. Substantive requirements remain RESEARCH_REQUIRED unless explicitly sourced.`,
    legalReviewStatus: 'RESEARCH_REQUIRED',
    effectiveFrom: PACK_EFFECTIVE_FROM,
    effectiveUntil: null,
    sourceReference: ENGINEERING_SOURCE,
    capabilities: Object.freeze(capabilities),
    overlays,
  });
}

export const JURISDICTION_CAPABILITY_PACKS: readonly JurisdictionCapabilityPack[] = Object.freeze(
  HELIOS_JURISDICTION_IDS.map(buildPack),
);

export const JURISDICTION_CAPABILITY_CATEGORIES = CAPABILITY_CATEGORIES;

export function packForJurisdiction(jurisdictionId: HeliosJurisdictionId): JurisdictionCapabilityPack {
  const pack = JURISDICTION_CAPABILITY_PACKS.find((row) => row.packId === jurisdictionId);
  if (!pack) throw new Error(`unknown jurisdiction pack ${jurisdictionId}`);
  return pack;
}

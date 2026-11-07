import { asUtcInstant, type UtcInstant } from '@solstice/domain';

import type {
  CommercializationEvidenceRef,
  PatentObservation,
  PatentProductUtilizationState,
} from './types.ts';
import { computePatentKnowableAt } from './knowable-at.ts';

export const FIXTURE_COMPANY_SIM_LABS = 'co:sunrey-simulation-labs' as const;
export const FIXTURE_COMPANY_EXAMPLE_CORP = 'co:example-corp-eu' as const;
export const FIXTURE_COMPETITOR = 'co:rival-systems-inc' as const;

export const ALT09_FIXTURE_AS_OF = asUtcInstant('2026-06-01T12:00:00.000Z');

function patent(input: Omit<PatentObservation, 'knowableAt'> & { readonly knowableAt?: UtcInstant }): PatentObservation {
  const knowableAt =
    input.knowableAt ??
    computePatentKnowableAt({
      publicationDate: input.publicationDate,
      grantDate: input.grantDate,
      assignmentDate: input.assignmentDate,
    })!;
  return Object.freeze({ ...input, knowableAt });
}

/** Unpublished application — must not surface in PIT portfolios before publication. */
export const FIXTURE_UNPUBLISHED_APPLICATION: PatentObservation = patent({
  observationId: 'pat_obs:US-2025-999999-A1',
  patentId: 'US-2025-999999-A1',
  familyId: 'fam:US182499999',
  companyId: FIXTURE_COMPANY_SIM_LABS,
  applicationNumber: 'US-18/249999',
  publicationNumber: null,
  title: 'Fixture secret application (unpublished)',
  abstract: null,
  claimsExcerpt: null,
  inventors: Object.freeze(['Hidden Inventor']),
  assignee: 'SunRey Simulation Labs',
  filingDate: asUtcInstant('2025-12-01T00:00:00.000Z'),
  publicationDate: null,
  grantDate: null,
  assignmentDate: null,
  status: 'PENDING',
  jurisdiction: 'US',
  classificationCodes: Object.freeze(['G06N20/00']),
  forwardCitations: Object.freeze([]),
  backwardCitations: Object.freeze([]),
  providerId: 'patentsview',
  provenance: 'alt09-fixture:unpublished-application',
  grantsInfringementConclusion: false,
});

export const FIXTURE_PATENTS: readonly PatentObservation[] = Object.freeze([
  patent({
    observationId: 'pat_obs:US-20240123456-A1',
    patentId: 'US-20240123456-A1',
    familyId: 'fam:US18123456',
    companyId: FIXTURE_COMPANY_SIM_LABS,
    applicationNumber: 'US-18/123456',
    publicationNumber: 'US-2024-0123456-A1',
    title: 'Method for bounded inference routing in financial agent systems',
    abstract:
      'Systems and methods for policy-gated model selection without automatic production reconfiguration.',
    claimsExcerpt: '1. A method comprising receiving a policy mandate...',
    inventors: Object.freeze(['Jordan Inventor', 'Sam Engineer']),
    assignee: 'SunRey Simulation Labs',
    filingDate: asUtcInstant('2023-11-01T00:00:00.000Z'),
    publicationDate: asUtcInstant('2024-05-15T00:00:00.000Z'),
    grantDate: asUtcInstant('2025-08-01T00:00:00.000Z'),
    assignmentDate: asUtcInstant('2023-11-02T00:00:00.000Z'),
    status: 'GRANTED',
    jurisdiction: 'US',
    classificationCodes: Object.freeze(['G06N20/00', 'G06Q40/00']),
    forwardCitations: Object.freeze(['US-20250100001-A1']),
    backwardCitations: Object.freeze(['US-20230111111-A1']),
    providerId: 'sec-edgar',
    provenance: 'alt09-fixture:patent-landscape',
    grantsInfringementConclusion: false,
  }),
  patent({
    observationId: 'pat_obs:EP-2024-009876',
    patentId: 'EP-2024-009876',
    familyId: 'fam:EP24123456',
    companyId: FIXTURE_COMPANY_EXAMPLE_CORP,
    applicationNumber: 'EP-24123456',
    publicationNumber: 'EP-2024-009876-A1',
    title: 'Distributed ledger settlement with compliance kernel gating',
    abstract: 'Fixture patent for jurisdiction identity testing.',
    claimsExcerpt: null,
    inventors: Object.freeze(['Alex Builder']),
    assignee: 'Example Corp EU',
    filingDate: asUtcInstant('2024-01-10T00:00:00.000Z'),
    publicationDate: asUtcInstant('2024-07-01T00:00:00.000Z'),
    grantDate: null,
    assignmentDate: asUtcInstant('2024-01-12T00:00:00.000Z'),
    status: 'PUBLISHED',
    jurisdiction: 'EP',
    classificationCodes: Object.freeze(['G06Q20/38']),
    forwardCitations: Object.freeze([]),
    backwardCitations: Object.freeze(['US-20240123456-A1']),
    providerId: 'federal-register',
    provenance: 'alt09-fixture:patent-landscape',
    grantsInfringementConclusion: false,
  }),
  patent({
    observationId: 'pat_obs:US-20250100001-A1',
    patentId: 'US-20250100001-A1',
    familyId: 'fam:US18180001',
    companyId: FIXTURE_COMPETITOR,
    applicationNumber: 'US-18/180001',
    publicationNumber: 'US-2025-0100001-A1',
    title: 'Cross-venue agent research mesh synchronization',
    abstract: 'Fixture competitor citation target.',
    claimsExcerpt: null,
    inventors: Object.freeze(['Casey Rival']),
    assignee: 'Rival Systems Inc',
    filingDate: asUtcInstant('2024-09-01T00:00:00.000Z'),
    publicationDate: asUtcInstant('2025-03-01T00:00:00.000Z'),
    grantDate: null,
    assignmentDate: null,
    status: 'PUBLISHED',
    jurisdiction: 'US',
    classificationCodes: Object.freeze(['G06N20/00']),
    forwardCitations: Object.freeze([]),
    backwardCitations: Object.freeze(['US-20240123456-A1']),
    providerId: 'patentsview',
    provenance: 'alt09-fixture:competitor',
    grantsInfringementConclusion: false,
  }),
]);

export const FIXTURE_PRODUCT_AGENT_MESH = 'prod:agent-mesh-runtime' as const;

export const FIXTURE_COMMERCIALIZATION_EVIDENCE: readonly CommercializationEvidenceRef[] = Object.freeze([
  Object.freeze({
    evidenceId: 'cev:sim-labs-product-spec-001',
    kind: 'PRODUCT_SPEC' as const,
    productId: FIXTURE_PRODUCT_AGENT_MESH,
    description: 'Product spec references bounded inference routing claim 1 language.',
    knowableAt: asUtcInstant('2025-09-01T00:00:00.000Z'),
  }),
]);

export const FIXTURE_PATENT_UTILIZATION: readonly PatentProductUtilizationState[] = Object.freeze([
  Object.freeze({
    patentId: 'US-20240123456-A1',
    companyId: FIXTURE_COMPANY_SIM_LABS,
    productId: FIXTURE_PRODUCT_AGENT_MESH,
    utilizationClass: 'LIKELY_UTILIZED' as const,
    evidenceRefs: FIXTURE_COMMERCIALIZATION_EVIDENCE,
    knowableAt: asUtcInstant('2025-09-01T00:00:00.000Z'),
    inferredFromGrantOnly: false as const,
  }),
  Object.freeze({
    patentId: 'EP-2024-009876',
    companyId: FIXTURE_COMPANY_EXAMPLE_CORP,
    productId: null,
    utilizationClass: 'NO_EVIDENCE' as const,
    evidenceRefs: Object.freeze([]),
    knowableAt: asUtcInstant('2024-07-01T00:00:00.000Z'),
    inferredFromGrantOnly: false as const,
  }),
]);

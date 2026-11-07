import type { UtcInstant } from '@solstice/domain';

import type { PatentUtilizationClass } from './taxonomy.ts';

export type PatentStatus =
  | 'PENDING'
  | 'PUBLISHED'
  | 'GRANTED'
  | 'EXPIRED'
  | 'WITHDRAWN'
  | 'UNKNOWN';

/** Company-level patent observation with explicit point-in-time envelope. */
export type PatentObservation = {
  readonly observationId: string;
  readonly patentId: string;
  readonly familyId: string;
  readonly companyId: string;
  readonly applicationNumber: string | null;
  readonly publicationNumber: string | null;
  readonly title: string;
  readonly abstract: string | null;
  readonly claimsExcerpt: string | null;
  readonly inventors: readonly string[];
  readonly assignee: string | null;
  readonly filingDate: UtcInstant | null;
  readonly publicationDate: UtcInstant | null;
  readonly grantDate: UtcInstant | null;
  readonly assignmentDate: UtcInstant | null;
  readonly knowableAt: UtcInstant;
  readonly status: PatentStatus;
  readonly jurisdiction: string;
  readonly classificationCodes: readonly string[];
  readonly forwardCitations: readonly string[];
  readonly backwardCitations: readonly string[];
  readonly providerId: string;
  readonly provenance: string;
  readonly grantsInfringementConclusion: false;
};

export type PatentFamily = {
  readonly familyId: string;
  readonly companyId: string;
  readonly representativePatentId: string;
  readonly memberPatentIds: readonly string[];
  readonly jurisdictions: readonly string[];
  readonly earliestFilingDate: UtcInstant | null;
  readonly knowableAt: UtcInstant;
};

export type TechnologyEmbeddingRecord = {
  readonly embeddingId: string;
  readonly patentId: string;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly modelEffectiveAt: UtcInstant;
  readonly vector: readonly number[];
  readonly sourceFields: readonly ('title' | 'abstract' | 'claims' | 'classification')[];
  readonly computedAt: UtcInstant;
  readonly knowableAt: UtcInstant;
};

export type InnovationFeatureBundle = {
  readonly patentCount: number;
  readonly familyCount: number;
  readonly citationVelocity: number;
  readonly selfCitation: number;
  readonly forwardCitation: number;
  readonly backwardCitation: number;
  readonly technologyBreadth: number;
  readonly technologyConcentration: number;
  readonly inventorBreadth: number;
  readonly assigneeChange: number;
  readonly assignmentFrequency: number;
  readonly internationalFamilyBreadth: number;
  readonly semanticNovelty: number;
  readonly technologyCentrality: number;
};

export type PatentQualityState = {
  readonly companyId: string;
  readonly asOf: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly features: InnovationFeatureBundle;
  readonly citationQualityScore: number;
  readonly grantsLegalConclusion: false;
};

export type CommercializationEvidenceRef = {
  readonly evidenceId: string;
  readonly kind: 'PRODUCT_SPEC' | 'FILING_DISCLOSURE' | 'MARKETING_MATERIAL' | 'SIMULATION_FIXTURE';
  readonly productId: string | null;
  readonly description: string;
  readonly knowableAt: UtcInstant;
};

export type PatentProductUtilizationState = {
  readonly patentId: string;
  readonly companyId: string;
  readonly productId: string | null;
  readonly utilizationClass: PatentUtilizationClass;
  readonly evidenceRefs: readonly CommercializationEvidenceRef[];
  readonly knowableAt: UtcInstant;
  readonly inferredFromGrantOnly: false;
};

export type CommercializationState = {
  readonly companyId: string;
  readonly asOf: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly patentUtilization: readonly PatentProductUtilizationState[];
  readonly utilizedPatentCount: number;
  readonly grantsProductMarketFitConclusion: false;
};

export type TechnologyPortfolio = {
  readonly companyId: string;
  readonly asOf: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly patents: readonly PatentObservation[];
  readonly families: readonly PatentFamily[];
  readonly embeddings: readonly TechnologyEmbeddingRecord[];
};

export type InnovationMomentum = {
  readonly score: number;
  readonly filingAcceleration: number;
  readonly citationAcceleration: number;
};

export type TechnologyExpansion = {
  readonly score: number;
  readonly newClassificationCount: number;
  readonly newFamilyCount: number;
};

export type TechnologyConvergence = {
  readonly score: number;
  readonly crossDomainCitationShare: number;
};

export type InnovationCommercializationGap = {
  readonly score: number;
  readonly grantedWithoutUtilizationEvidence: number;
  readonly publicationWithoutProductLink: number;
};

export type InnovationState = {
  readonly companyId: string;
  readonly asOf: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly portfolio: TechnologyPortfolio;
  readonly quality: PatentQualityState;
  readonly commercialization: CommercializationState;
  readonly momentum: InnovationMomentum;
  readonly expansion: TechnologyExpansion;
  readonly convergence: TechnologyConvergence;
  readonly commercializationGap: InnovationCommercializationGap;
  readonly grantsInvestmentAlpha: false;
};

export type TechnologyGraphNodeKind =
  | 'COMPANY'
  | 'PATENT'
  | 'TECHNOLOGY'
  | 'CITED_PATENT'
  | 'COMPETITOR'
  | 'PRODUCT';

export type TechnologyGraphNode = {
  readonly nodeId: string;
  readonly kind: TechnologyGraphNodeKind;
  readonly label: string;
  readonly knowableAt: UtcInstant;
};

export type TechnologyGraphEdge = {
  readonly edgeId: string;
  readonly kind: import('./taxonomy.ts').TechnologyGraphEdgeKind;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly knowableAt: UtcInstant;
};

export type TechnologyGraph = {
  readonly companyId: string;
  readonly asOf: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly nodes: readonly TechnologyGraphNode[];
  readonly edges: readonly TechnologyGraphEdge[];
};

export type Alt09PipelineStageResult = {
  readonly stage: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type Alt09PipelineResult = {
  readonly ok: boolean;
  readonly stages: readonly Alt09PipelineStageResult[];
  readonly innovationState: InnovationState | null;
  readonly technologyGraph: TechnologyGraph | null;
  readonly knowableAtViolations: number;
};

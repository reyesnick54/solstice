import type { UtcInstant } from '@solstice/domain';

import { ingestPatentsFromWave6 } from './wave6-bridge.ts';
import {
  FIXTURE_COMMERCIALIZATION_EVIDENCE,
  FIXTURE_COMPANY_SIM_LABS,
  FIXTURE_PATENTS,
  FIXTURE_PATENT_UTILIZATION,
  FIXTURE_PRODUCT_AGENT_MESH,
  FIXTURE_UNPUBLISHED_APPLICATION,
} from './fixtures.ts';
import { buildInnovationState } from './portfolio.ts';
import { buildTechnologyGraph } from './graph.ts';
import type { InnovationState, PatentObservation, TechnologyGraph } from './types.ts';

export type InnovationIntelligenceServiceResult = {
  readonly innovationState: InnovationState;
  readonly technologyGraph: TechnologyGraph;
  readonly wave6PatentCount: number;
  readonly fixturePatentCount: number;
  readonly grantsLegalConclusion: false;
};

export function buildInnovationIntelligenceForCompany(input: {
  readonly companyId: string;
  readonly companyLabel: string;
  readonly asOf: UtcInstant;
  readonly includeWave6?: boolean;
  readonly extraPatents?: readonly PatentObservation[];
}): InnovationIntelligenceServiceResult {
  const wave6 =
    input.includeWave6 !== false
      ? ingestPatentsFromWave6({
          evaluationTimeUtc: input.asOf,
          nowUtc: input.asOf,
          assignmentOverrides: Object.freeze({
            'US-20240123456-A1': '2023-11-02T00:00:00.000Z' as UtcInstant,
          }),
          claimsByPatentId: Object.freeze({
            'US-20240123456-A1': '1. A method comprising receiving a policy mandate...',
          }),
        })
      : [];
  const merged = Object.freeze([
    ...FIXTURE_PATENTS,
    ...wave6,
    ...(input.extraPatents ?? []),
    FIXTURE_UNPUBLISHED_APPLICATION,
  ]);
  const evidenceByPatentId = Object.freeze({
    'US-20240123456-A1': FIXTURE_COMMERCIALIZATION_EVIDENCE,
  });
  const innovationState = buildInnovationState({
    companyId: input.companyId,
    companyLabel: input.companyLabel,
    asOf: input.asOf,
    patents: merged,
    evidenceByPatentId,
    preclassifiedUtilization: FIXTURE_PATENT_UTILIZATION.filter((row) => row.companyId === input.companyId),
    allPatentsForCitations: merged,
  });
  const technologyGraph = buildTechnologyGraph({
    companyId: input.companyId,
    companyLabel: input.companyLabel,
    asOf: input.asOf,
    patents: merged,
    productLinks: Object.freeze({
      'US-20240123456-A1': {
        productId: FIXTURE_PRODUCT_AGENT_MESH,
        label: 'Agent Mesh Runtime',
      },
    }),
  });
  return Object.freeze({
    innovationState,
    technologyGraph,
    wave6PatentCount: wave6.length,
    fixturePatentCount: FIXTURE_PATENTS.length,
    grantsLegalConclusion: false as const,
  });
}

export const DEFAULT_FIXTURE_COMPANY = FIXTURE_COMPANY_SIM_LABS;

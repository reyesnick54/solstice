import { asUtcInstant } from '@solstice/domain';

import { heliosIssuerCanonicalEntityId } from '../../feature-fabric/entity-resolution/ekg-bridge.ts';
import { createTemporalEntityGraphStore, type TemporalEntityGraphStore } from '../../feature-fabric/entity-resolution/graph-store.ts';
import { temporalEntityNodeIdFor } from '../../feature-fabric/entity-resolution/ids.ts';
import { normalizeAltLabel } from './normalize.ts';
import { appendAltAssetRelation } from './relation-bridge.ts';
import type { AltCrosswalkEntry, AltCrosswalkRegistry, AltLlmMatchProposal } from './types.ts';

const T = (iso: string) => asUtcInstant(iso);

export type Alt03FixtureHandles = {
  readonly store: TemporalEntityGraphStore;
  readonly pghParent: string;
  readonly dawnBrand: string;
  readonly zhangzhouFacility: string;
  readonly patentAssigneeHistorical: string;
  readonly vesselPacificTrader: string;
  readonly crosswalk: AltCrosswalkRegistry;
  readonly llmProposals: readonly AltLlmMatchProposal[];
};

function crosswalkFrom(entries: readonly AltCrosswalkEntry[]): AltCrosswalkRegistry {
  return Object.freeze({
    lookup(providerId, externalKey, asOf, knowableAtCutoff) {
      const hit = entries.find(
        (row) =>
          row.providerId === providerId &&
          row.externalKey === externalKey &&
          Date.parse(asOf) >= Date.parse(row.effectiveFrom) &&
          (row.effectiveTo === null || Date.parse(asOf) < Date.parse(row.effectiveTo)) &&
          Date.parse(knowableAtCutoff) >= Date.parse(row.knowableAt),
      );
      return hit;
    },
  });
}

export function seedAlt03ReferenceEntityAssetGraph(): Alt03FixtureHandles {
  const store = createTemporalEntityGraphStore();
  const parentEkg = heliosIssuerCanonicalEntityId('procter_and_gamble');

  const pghParent = store.upsertNode({
    nodeId: temporalEntityNodeIdFor('alt03:public:pg'),
    kind: 'PUBLIC_COMPANY',
    displayName: 'Procter & Gamble Co',
    jurisdiction: 'US',
    economicKnowledgeEntityId: parentEkg,
    payload: Object.freeze({
      cik: '0000080424',
      normalizedId: normalizeAltLabel('Procter & Gamble Co'),
    }),
  });

  const dawnBrand = store.upsertNode({
    nodeId: temporalEntityNodeIdFor('alt03:brand:dawn'),
    kind: 'BRAND',
    displayName: 'Dawn',
    jurisdiction: 'US',
    economicKnowledgeEntityId: null,
    payload: Object.freeze({
      normalizedId: normalizeAltLabel('Dawn dish soap brand'),
    }),
  });

  const zhangzhouFacility = store.upsertNode({
    nodeId: temporalEntityNodeIdFor('alt03:facility:zhangzhou'),
    kind: 'FACILITY',
    displayName: 'Zhangzhou plant',
    jurisdiction: 'CN',
    economicKnowledgeEntityId: null,
    payload: Object.freeze({
      epaFacilityId: 'cn-zhangzhou-017',
      normalizedId: normalizeAltLabel('Zhangzhou plant'),
    }),
  });

  const privateOperator = store.upsertNode({
    nodeId: temporalEntityNodeIdFor('alt03:private:fujian_ops'),
    kind: 'PRIVATE_COMPANY',
    displayName: 'Fujian Ops Ltd',
    jurisdiction: 'CN',
    economicKnowledgeEntityId: null,
    payload: Object.freeze({ normalizedId: normalizeAltLabel('Fujian Ops Ltd') }),
  });

  const patentAssigneeHistorical = store.upsertNode({
    nodeId: temporalEntityNodeIdFor('alt03:patent:oldco'),
    kind: 'PATENT_ASSIGNEE',
    displayName: 'OldCo Patents LLC',
    jurisdiction: 'US',
    economicKnowledgeEntityId: null,
    payload: Object.freeze({
      usptoAssigneeId: 'oldco-patents-llc',
      normalizedId: normalizeAltLabel('OldCo Patents LLC'),
    }),
  });

  const vesselPacificTrader = store.upsertNode({
    nodeId: temporalEntityNodeIdFor('alt03:vessel:pacific_trader'),
    kind: 'VESSEL',
    displayName: 'Pacific Trader',
    jurisdiction: 'PA',
    economicKnowledgeEntityId: null,
    payload: Object.freeze({
      imo: 'IMO9123456',
      normalizedId: normalizeAltLabel('Pacific Trader'),
    }),
  });

  const t0 = T('2018-01-01T00:00:00.000Z');
  const relationDefaults = {
    effectiveFrom: t0,
    effectiveTo: null as null,
    knowableAt: T('2018-01-02T00:00:00.000Z'),
    observedAt: t0,
    jurisdiction: 'US' as const,
    sourceRefs: Object.freeze(['evidence:alt03:fixture']),
    confidence: 0.95,
  };

  appendAltAssetRelation(store, {
    ...relationDefaults,
    relationshipType: 'BRAND_OF',
    fromNodeId: dawnBrand.nodeId,
    toNodeId: pghParent.nodeId,
  });

  appendAltAssetRelation(store, {
    ...relationDefaults,
    relationshipType: 'OPERATES',
    fromNodeId: privateOperator.nodeId,
    toNodeId: zhangzhouFacility.nodeId,
    jurisdiction: 'CN',
  });

  appendAltAssetRelation(store, {
    ...relationDefaults,
    relationshipType: 'ASSIGNED_TO',
    fromNodeId: patentAssigneeHistorical.nodeId,
    toNodeId: pghParent.nodeId,
    effectiveTo: T('2020-06-01T00:00:00.000Z'),
    confidence: 0.88,
  });

  const tAssign = T('2021-01-01T00:00:00.000Z');
  const successorAssignee = store.upsertNode({
    nodeId: temporalEntityNodeIdFor('alt03:patent:newco'),
    kind: 'PATENT_ASSIGNEE',
    displayName: 'NewCo IP Holdings',
    jurisdiction: 'US',
    economicKnowledgeEntityId: null,
    payload: Object.freeze({
      usptoAssigneeId: 'newco-ip-holdings',
      normalizedId: normalizeAltLabel('NewCo IP Holdings'),
    }),
  });
  appendAltAssetRelation(store, {
    ...relationDefaults,
    relationshipType: 'ASSIGNED_TO',
    fromNodeId: successorAssignee.nodeId,
    toNodeId: pghParent.nodeId,
    effectiveFrom: T('2020-06-01T00:00:00.000Z'),
    knowableAt: tAssign,
    observedAt: tAssign,
  });

  const crosswalkEntries: AltCrosswalkEntry[] = [
    {
      providerId: 'fixture_alt',
      externalKey: 'website:pgcareers.com',
      targetNodeId: privateOperator.nodeId,
      effectiveFrom: t0,
      effectiveTo: null,
      knowableAt: T('2018-01-02T00:00:00.000Z'),
      sourceRefs: Object.freeze(['evidence:alt03:crosswalk:job-board']),
      confidence: 0.91,
    },
  ];

  const llmProposals: AltLlmMatchProposal[] = [
    Object.freeze({
      proposalId: 'llm-prop-vessel-001',
      observationRef: 'obs:vessel-cargo-ambiguous',
      proposedNodeId: pghParent.nodeId,
      rationale: 'Model guessed cargo beneficiary is listed parent',
      modelRef: 's3m:fixture',
      proposedAt: T('2024-03-01T00:00:00.000Z'),
      certified: false,
      reviewerRef: null,
    }),
  ];

  return Object.freeze({
    store,
    pghParent: pghParent.nodeId,
    dawnBrand: dawnBrand.nodeId,
    zhangzhouFacility: zhangzhouFacility.nodeId,
    patentAssigneeHistorical: patentAssigneeHistorical.nodeId,
    vesselPacificTrader: vesselPacificTrader.nodeId,
    crosswalk: crosswalkFrom(crosswalkEntries),
    llmProposals: Object.freeze(llmProposals),
  });
}

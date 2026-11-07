import type { UtcInstant } from '@solstice/domain';

import { isPatentVisibleAt } from './knowable-at.ts';
import type { PatentObservation, TechnologyGraph, TechnologyGraphEdge, TechnologyGraphNode } from './types.ts';

export function buildTechnologyGraph(input: {
  readonly companyId: string;
  readonly companyLabel: string;
  readonly asOf: UtcInstant;
  readonly patents: readonly PatentObservation[];
  readonly productLinks?: Readonly<Record<string, { readonly productId: string; readonly label: string }>>;
}): TechnologyGraph {
  const visible = input.patents.filter(
    (p) => isPatentVisibleAt(input.asOf, p) && p.companyId === input.companyId,
  );
  const nodes: TechnologyGraphNode[] = [
    Object.freeze({
      nodeId: input.companyId,
      kind: 'COMPANY' as const,
      label: input.companyLabel,
      knowableAt: input.asOf,
    }),
  ];
  const edges: TechnologyGraphEdge[] = [];
  const competitorIds = new Set<string>();

  for (const patent of visible) {
    nodes.push(
      Object.freeze({
        nodeId: patent.patentId,
        kind: 'PATENT' as const,
        label: patent.title,
        knowableAt: patent.knowableAt,
      }),
    );
    edges.push(
      Object.freeze({
        edgeId: `e:${input.companyId}->${patent.patentId}`,
        kind: 'COMPANY_OWNS_PATENT' as const,
        fromNodeId: input.companyId,
        toNodeId: patent.patentId,
        knowableAt: patent.knowableAt,
      }),
    );
    for (const code of patent.classificationCodes) {
      const techId = `tech:${code}`;
      if (!nodes.some((n) => n.nodeId === techId)) {
        nodes.push(
          Object.freeze({
            nodeId: techId,
            kind: 'TECHNOLOGY' as const,
            label: code,
            knowableAt: patent.knowableAt,
          }),
        );
      }
      edges.push(
        Object.freeze({
          edgeId: `e:${patent.patentId}->${techId}`,
          kind: 'PATENT_CLASSIFIED_AS' as const,
          fromNodeId: patent.patentId,
          toNodeId: techId,
          knowableAt: patent.knowableAt,
        }),
      );
    }
    for (const citedId of patent.backwardCitations) {
      const cited = input.patents.find((p) => p.patentId === citedId);
      if (cited && isPatentVisibleAt(input.asOf, cited)) {
        nodes.push(
          Object.freeze({
            nodeId: citedId,
            kind: 'CITED_PATENT' as const,
            label: cited.title,
            knowableAt: cited.knowableAt,
          }),
        );
        edges.push(
          Object.freeze({
            edgeId: `e:${patent.patentId}->cite->${citedId}`,
            kind: 'PATENT_CITES' as const,
            fromNodeId: patent.patentId,
            toNodeId: citedId,
            knowableAt: patent.knowableAt,
          }),
        );
        if (cited.companyId !== input.companyId) {
          competitorIds.add(cited.companyId);
          edges.push(
            Object.freeze({
              edgeId: `e:${patent.patentId}->compete->${cited.companyId}`,
              kind: 'PATENT_COMPETES_WITH' as const,
              fromNodeId: patent.patentId,
              toNodeId: cited.companyId,
              knowableAt: patent.knowableAt,
            }),
          );
        }
      }
    }
    const link = input.productLinks?.[patent.patentId];
    if (link) {
      const prodNodeId = link.productId;
      if (!nodes.some((n) => n.nodeId === prodNodeId)) {
        nodes.push(
          Object.freeze({
            nodeId: prodNodeId,
            kind: 'PRODUCT' as const,
            label: link.label,
            knowableAt: patent.knowableAt,
          }),
        );
      }
      edges.push(
        Object.freeze({
          edgeId: `e:${patent.patentId}->${prodNodeId}`,
          kind: 'PATENT_LINKED_TO_PRODUCT' as const,
          fromNodeId: patent.patentId,
          toNodeId: prodNodeId,
          knowableAt: patent.knowableAt,
        }),
      );
    }
  }

  for (const competitorId of competitorIds) {
    if (!nodes.some((n) => n.nodeId === competitorId)) {
      nodes.push(
        Object.freeze({
          nodeId: competitorId,
          kind: 'COMPETITOR' as const,
          label: competitorId.replace(/^co:/, ''),
          knowableAt: input.asOf,
        }),
      );
    }
    edges.push(
      Object.freeze({
        edgeId: `e:${input.companyId}->competitor->${competitorId}`,
        kind: 'COMPANY_COMPETES_WITH' as const,
        fromNodeId: input.companyId,
        toNodeId: competitorId,
        knowableAt: input.asOf,
      }),
    );
  }

  const knowableAt = nodes
    .map((n) => n.knowableAt)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] as UtcInstant;

  return Object.freeze({
    companyId: input.companyId,
    asOf: input.asOf,
    knowableAt,
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
  });
}

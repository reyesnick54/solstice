/**
 * Policy version compatibility graph.
 *
 * Nodes are constitutionally relevant components. Edges express
 * required compatible version bindings. No edge is an implicit
 * "latest" dependency.
 */

import {
  CONSTITUTION_COMPONENT_KEYS,
  type ConstitutionComponentKey,
  type EconomicPolicyCompatibilityEdge,
  type EconomicPolicyCompatibilityGraph,
  type EconomicPolicyCompatibilityNode,
  type MoonReyConstitutionBinding,
  type SunReyConstitutionBinding,
} from './types.ts';

const REQUIRED_EDGES: readonly { readonly from: ConstitutionComponentKey; readonly to: ConstitutionComponentKey }[] =
  Object.freeze([
    { from: 'monetaryConstitution', to: 'parameterPackage' },
    { from: 'parameterPackage', to: 'supply' },
    { from: 'parameterPackage', to: 'genesis' },
    { from: 'humanVerification', to: 'humanValuation' },
    { from: 'humanValuation', to: 'sunreyConversion' },
    { from: 'sunreyConversion', to: 'monetaryConstitution' },
    { from: 'sunreyConversion', to: 'supply' },
    { from: 'sourceTaxonomy', to: 'unitConstitution' },
    { from: 'unitConstitution', to: 'attribution' },
    { from: 'attribution', to: 'productiveValue' },
    { from: 'productiveValue', to: 'moonreyConversion' },
    { from: 'moonreyConversion', to: 'monetaryConstitution' },
    { from: 'moonreyConversion', to: 'supply' },
    { from: 'oracleCertification', to: 'economicDataFabric' },
    { from: 'economicDataFabric', to: 'sourceTaxonomy' },
    { from: 'fees', to: 'monetaryConstitution' },
    { from: 'burns', to: 'monetaryConstitution' },
    { from: 'genesis', to: 'supply' },
  ]);

export function buildCompatibilityGraph(input: {
  readonly nodes: Readonly<Record<ConstitutionComponentKey, { readonly versionId: string; readonly contentHash: string }>>;
  readonly sunrey: SunReyConstitutionBinding;
  readonly moonrey: MoonReyConstitutionBinding;
  readonly implicitRejected: boolean;
}): EconomicPolicyCompatibilityGraph {
  const nodes: EconomicPolicyCompatibilityNode[] = CONSTITUTION_COMPONENT_KEYS.map((id) =>
    Object.freeze({
      id,
      versionId: input.nodes[id].versionId,
      contentHash: input.nodes[id].contentHash,
    }),
  );
  const edges: EconomicPolicyCompatibilityEdge[] = REQUIRED_EDGES.map((edge) => {
    const from = input.nodes[edge.from];
    const to = input.nodes[edge.to];
    const bound = from.versionId.length > 0 && to.versionId.length > 0 && !input.implicitRejected;
    const denominationOk =
      edge.from === 'humanValuation' && edge.to === 'sunreyConversion'
        ? input.sunrey.valuationOutputDenomination === input.sunrey.conversionInputDenomination
        : edge.from === 'productiveValue' && edge.to === 'moonreyConversion'
          ? input.moonrey.productiveValueOutputUnit === 'GPUV' && input.moonrey.conversionInputUnit === 'GPUV'
          : true;
    const conversionAssetOk =
      edge.from === 'sunreyConversion' && edge.to === 'monetaryConstitution'
        ? input.sunrey.conversionOutputAsset === 'SUNREY_COIN'
        : edge.from === 'moonreyConversion' && edge.to === 'monetaryConstitution'
          ? input.moonrey.conversionOutputAsset === 'MOONREY_COIN'
          : true;
    const compatible = bound && denominationOk && conversionAssetOk;
    return Object.freeze({
      from: edge.from,
      to: edge.to,
      required: true as const,
      compatible,
      reason: compatible
        ? 'exact version binding'
        : !bound
          ? 'unbound or implicit version'
          : !denominationOk
            ? 'denomination mismatch'
            : 'conversion asset mismatch',
    });
  });
  return Object.freeze({
    schemaVersion: 1,
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    complete: edges.every((edge) => edge.compatible) && nodes.length === CONSTITUTION_COMPONENT_KEYS.length,
  });
}

import type { StrategyCapsuleMaterial, StrategyCapsuleScope } from './types.ts';
import { canonicalJson, hashCanonical } from './canonical.ts';

/** Material configuration bound to evaluations, promotions, and replay. */
export type StrategyCapsuleMaterialProjection = {
  readonly scope: StrategyCapsuleScope;
  readonly description: StrategyCapsuleMaterial['description'];
  readonly instrumentUniverse: StrategyCapsuleMaterial['instrumentUniverse'];
  readonly featureSpecification: StrategyCapsuleMaterial['featureSpecification'];
  readonly modelDependencies: StrategyCapsuleMaterial['modelDependencies'];
  readonly decisionRule: StrategyCapsuleMaterial['decisionRule'];
  readonly operatingAssumptions: StrategyCapsuleMaterial['operatingAssumptions'];
  readonly costModel: StrategyCapsuleMaterial['costModel'];
  readonly validity: Pick<
    StrategyCapsuleMaterial['validity'],
    'regimeConstraints' | 'invalidatingConditions' | 'modelVersionCompatibility' | 'dataVersionCompatibility'
  >;
  readonly marketRegimePreferences: StrategyCapsuleMaterial['marketRegimePreferences'];
  readonly fixedQualifiedParameters: StrategyCapsuleMaterial['fixedQualifiedParameters'];
};

export function projectMaterialForHash(
  material: StrategyCapsuleMaterial,
  scope: StrategyCapsuleScope,
): StrategyCapsuleMaterialProjection {
  return Object.freeze({
    scope,
    description: material.description,
    instrumentUniverse: material.instrumentUniverse,
    featureSpecification: material.featureSpecification,
    modelDependencies: material.modelDependencies,
    decisionRule: material.decisionRule,
    operatingAssumptions: material.operatingAssumptions,
    costModel: material.costModel,
    validity: Object.freeze({
      regimeConstraints: material.validity.regimeConstraints,
      invalidatingConditions: material.validity.invalidatingConditions,
      modelVersionCompatibility: material.validity.modelVersionCompatibility,
      dataVersionCompatibility: material.validity.dataVersionCompatibility,
    }),
    marketRegimePreferences: material.marketRegimePreferences,
    fixedQualifiedParameters: material.fixedQualifiedParameters,
  });
}

export function computeStrategyCapsuleMaterialHash(
  material: StrategyCapsuleMaterial,
  scope: StrategyCapsuleScope,
): string {
  return hashCanonical(projectMaterialForHash(material, scope));
}

export function serializeStrategyCapsuleMaterial(
  material: StrategyCapsuleMaterial,
  scope: StrategyCapsuleScope,
): string {
  return canonicalJson(projectMaterialForHash(material, scope));
}

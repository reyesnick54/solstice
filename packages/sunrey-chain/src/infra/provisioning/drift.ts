import { digestJson } from '../hash.ts';
import type {
  DriftClassification,
  ProductionDeploymentDescriptor,
  ProductionEnvironmentDriftReport,
  ProductionEnvironmentPlan,
} from './types.ts';

export function compareDeploymentDrift(
  plan: ProductionEnvironmentPlan,
  observed: ProductionDeploymentDescriptor | null,
): ProductionEnvironmentDriftReport {
  if (!observed) {
    return Object.freeze({
      schemaVersion: 1,
      planHash: plan.planHash,
      classification: 'OBSERVATION_UNAVAILABLE',
      differences: Object.freeze(['observed deployment descriptor unavailable']),
      observed: false,
    });
  }
  const differences: string[] = [];
  if (observed.networkId !== plan.environment.networkId) {
    differences.push(`network:${observed.networkId}`);
  }
  if (observed.chainId !== plan.environment.chainId) {
    differences.push(`chain:${observed.chainId}`);
  }
  if (observed.environmentClass !== plan.environment.class) {
    differences.push(`class:${observed.environmentClass}`);
  }
  const plannedServices = digestJson(plan.services.map((row) => `${row.role}:${row.artifactDigest}:${row.zone}`));
  const observedServices = digestJson(observed.services.map((row) => `${row.role}:${row.artifactDigest}:${row.zone}`));
  if (plannedServices !== observedServices) {
    differences.push('services');
  }
  const plannedValidators = digestJson(plan.validators.map((row) => `${row.validatorId}:${row.artifactDigest}`));
  const observedValidators = digestJson(observed.validators.map((row) => `${row.validatorId}:${row.artifactDigest}`));
  if (plannedValidators !== observedValidators) {
    differences.push('validators');
  }
  let classification: DriftClassification = 'MATCH';
  if (differences.length > 0) {
    const authorizedVariance =
      differences.length === 1 && differences[0] === 'class:PRODUCTION_CANDIDATE' && plan.environment.class === 'PRODUCTION';
    classification = authorizedVariance ? 'AUTHORIZED_VARIANCE' : 'UNAUTHORIZED_DRIFT';
  }
  return Object.freeze({
    schemaVersion: 1,
    planHash: plan.planHash,
    classification,
    differences: Object.freeze(differences),
    observed: true,
  });
}

export function descriptorFromPlan(plan: ProductionEnvironmentPlan, observedAtUtc: string | null = null): ProductionDeploymentDescriptor {
  return Object.freeze({
    schemaVersion: 1,
    environmentClass: plan.environment.class,
    networkId: plan.environment.networkId,
    chainId: plan.environment.chainId,
    services: plan.services,
    validators: plan.validators,
    observedAtUtc,
  });
}

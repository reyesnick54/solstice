import type { SpecialistTaskOutput } from './types.ts';

export function validateSpecialistTaskOutput(output: SpecialistTaskOutput): readonly string[] {
  const errors: string[] = [];
  if (!output.outputId) errors.push('outputId required');
  if (!output.taskId) errors.push('taskId required');
  if (!output.specialistRole) errors.push('specialistRole required');
  if (!output.task) errors.push('task required');
  if (!output.model.provider) errors.push('model.provider required');
  if (!output.model.modelId) errors.push('model.modelId required');
  if (!output.recommendation) errors.push('recommendation required');
  if (!output.timestamps.startedAt || !output.timestamps.completedAt) errors.push('timestamps required');
  if (output.grantsFinancialAuthority !== false) errors.push('grantsFinancialAuthority must be false');
  if (!Array.isArray(output.findings)) errors.push('findings must be an array');
  if (!Array.isArray(output.evidenceReferences)) errors.push('evidenceReferences must be an array');
  return Object.freeze(errors);
}

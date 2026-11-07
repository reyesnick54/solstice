import { ALTERNATIVE_DATA_ALT14_ROLES, SKEPTIC_ALT14_CHECKLIST, type AlternativeDataAlt14Artifact } from './types.ts';

export function validateAlternativeDataAlt14Artifact(artifact: AlternativeDataAlt14Artifact): readonly string[] {
  const errors: string[] = [];
  if (!artifact.artifactId) errors.push('artifactId required');
  if (!artifact.thesis || artifact.thesis.length < 12) errors.push('thesis too short');
  if (artifact.simulationOnly !== true) errors.push('simulationOnly must be true');
  if (artifact.role === 'ALTERNATIVE_DATA_SKEPTIC') {
    const checklist = artifact.skepticChecklist ?? [];
    if (checklist.length < SKEPTIC_ALT14_CHECKLIST.length) {
      errors.push('skeptic checklist incomplete');
    }
  }
  if (artifact.role !== 'ALTERNATIVE_DATA_SKEPTIC' && artifact.role !== 'ALTERNATIVE_DATA_SYNTHESIS') {
    if (!artifact.extraction) errors.push(`${artifact.role} requires extraction`);
  }
  return Object.freeze(errors);
}

export function assertAllAlt14RolesProduceArtifacts(
  artifacts: readonly AlternativeDataAlt14Artifact[],
): readonly string[] {
  const missing: string[] = [];
  for (const role of ALTERNATIVE_DATA_ALT14_ROLES) {
    if (!artifacts.some((row) => row.role === role)) {
      missing.push(`missing artifact for role ${role}`);
    }
  }
  return Object.freeze(missing);
}

export function thesisPassesAltLanguageGuard(thesis: string): boolean {
  if (/guaranteed\s+alpha/i.test(thesis)) return false;
  if (/live\s+trading\s+enabled/i.test(thesis)) return false;
  if (/execution\s+authority/i.test(thesis)) return false;
  return true;
}

/**
 * Wave 6 — Personal Economic Graph integration for opportunity data.
 *
 * External job data is public. Personal graph links require actual user data/permission.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { OpportunityService } from '../service.ts';
import type { UserMatchContext } from '../types.ts';

export type PegOpportunityLink = {
  readonly linkType:
    | 'PERSON_HAS_SKILL'
    | 'USER_INTERESTED_IN_JOB'
    | 'USER_HAS_GOAL'
    | 'SKILL_RELATES_TO_OCCUPATION'
    | 'JOB_REQUIRES_SKILL';
  readonly sourceId: string;
  readonly targetId: string;
  readonly permissionRequired: boolean;
  readonly inferred: false;
};

export type PegOpportunityContext = {
  readonly schema: 'sunrey.peg.opportunity-context.v1';
  readonly generatedAt: UtcInstant;
  readonly publicOpportunityData: true;
  readonly personalLinksRequirePermission: true;
  readonly structuralLinks: readonly PegOpportunityLink[];
  readonly permittedUserLinks: readonly PegOpportunityLink[];
};

export async function buildPegOpportunityContext(
  service: OpportunityService,
  permittedContext: UserMatchContext,
  nowUtc: UtcInstant,
): Promise<PegOpportunityContext> {
  const structuralLinks: PegOpportunityLink[] = [];
  const permittedUserLinks: PegOpportunityLink[] = [];

  const skills = await service.searchSkills('', nowUtc);
  const occupations = await service.searchOccupations('', nowUtc);
  const jobs = await service.searchJobs({}, nowUtc);

  if (skills.ok && occupations.ok) {
    for (const occ of occupations.value) {
      for (const skillName of occ.skills) {
        const skill = skills.value.find((s) => s.canonicalName === skillName);
        if (skill) {
          structuralLinks.push(
            Object.freeze({
              linkType: 'SKILL_RELATES_TO_OCCUPATION',
              sourceId: skill.skillId,
              targetId: occ.occupationId,
              permissionRequired: false,
              inferred: false,
            }),
          );
        }
      }
    }
  }

  if (jobs.ok && skills.ok) {
    for (const job of jobs.value) {
      for (const skillName of job.skills) {
        const skill = skills.value.find((s) => s.canonicalName === skillName);
        if (skill) {
          structuralLinks.push(
            Object.freeze({
              linkType: 'JOB_REQUIRES_SKILL',
              sourceId: job.opportunityId,
              targetId: skill.skillId,
              permissionRequired: false,
              inferred: false,
            }),
          );
        }
      }
    }
  }

  if (permittedContext.permittedSkills?.length) {
    for (const userSkill of permittedContext.permittedSkills) {
      const skill = skills.ok ? skills.value.find((s) => s.canonicalName.toLowerCase() === userSkill.toLowerCase()) : undefined;
      if (skill) {
        permittedUserLinks.push(
          Object.freeze({
            linkType: 'PERSON_HAS_SKILL',
            sourceId: 'person:current',
            targetId: skill.skillId,
            permissionRequired: true,
            inferred: false,
          }),
        );
      }
    }
  }

  return Object.freeze({
    schema: 'sunrey.peg.opportunity-context.v1',
    generatedAt: nowUtc,
    publicOpportunityData: true,
    personalLinksRequirePermission: true,
    structuralLinks: Object.freeze(structuralLinks),
    permittedUserLinks: Object.freeze(permittedUserLinks),
  });
}

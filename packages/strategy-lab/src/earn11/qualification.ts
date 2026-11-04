import {
  HELIOS_EARN11_STRATEGY_RESEARCH_BLOCKED,
  HELIOS_EARN11_STRATEGY_RESEARCH_QUALIFIED,
  EARN11_RESEARCH_TEMPLATE_FAMILIES,
} from './taxonomy.ts';

export type Earn11QualificationChecks = {
  readonly allTemplateFamiliesRegistered: boolean;
  readonly genomeCatalogExtended: boolean;
  readonly aafV2Mandatory: boolean;
  readonly mandatoryResearchArtifactsEnforced: boolean;
  readonly executionTwinEventProfileRequired: boolean;
  readonly researchMonitorsResearchOnly: boolean;
  readonly closeToClosePromotionBlocked: boolean;
  readonly exampleTemplateCompiles: boolean;
  readonly grantsExecutionAuthority: false;
};

export type Earn11QualificationResult = {
  readonly marker:
    | typeof HELIOS_EARN11_STRATEGY_RESEARCH_QUALIFIED
    | typeof HELIOS_EARN11_STRATEGY_RESEARCH_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly templateFamilyCount: number;
};

const CHECK_LABELS: Record<keyof Earn11QualificationChecks, string> = {
  allTemplateFamiliesRegistered: 'nine EARN11 research template families registered',
  genomeCatalogExtended: 'Strategy Genome catalog extended for earnings intelligence',
  aafV2Mandatory: 'AAF V2 mandatory on genome candidates',
  mandatoryResearchArtifactsEnforced: 'PIT/coverage/bias/holdout/walk-forward/shadow/paper enforced',
  executionTwinEventProfileRequired: 'earnings event execution twin profile required',
  researchMonitorsResearchOnly: 'research monitors trigger research not execution',
  closeToClosePromotionBlocked: 'close-to-close-only fills cannot promote strategies',
  exampleTemplateCompiles: 'example template genome compiles through EARN11 pipeline',
  grantsExecutionAuthority: 'must not grant execution authority',
};

export function evaluateEarn11StrategyResearchQualification(
  checks: Earn11QualificationChecks,
): Earn11QualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof Earn11QualificationChecks, boolean][]) {
    if (key === 'grantsExecutionAuthority') {
      if (passed !== false) {
        blockers.push(CHECK_LABELS[key]);
      }
      continue;
    }
    if (!passed) {
      blockers.push(CHECK_LABELS[key]);
    }
  }

  if (blockers.length === 0) {
    return Object.freeze({
      marker: HELIOS_EARN11_STRATEGY_RESEARCH_QUALIFIED,
      qualified: true,
      blockers: Object.freeze([]),
      templateFamilyCount: EARN11_RESEARCH_TEMPLATE_FAMILIES.length,
    });
  }

  return Object.freeze({
    marker: HELIOS_EARN11_STRATEGY_RESEARCH_BLOCKED,
    qualified: false,
    blockers: Object.freeze(blockers),
    templateFamilyCount: EARN11_RESEARCH_TEMPLATE_FAMILIES.length,
  });
}

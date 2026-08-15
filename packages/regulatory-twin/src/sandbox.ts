import type { UtcInstant } from '../../domain/src/time.ts';
import {
  ManualReviewRegistry,
  PolicyEngine,
  PolicyRegistry,
  type PolicyEvaluationResult,
  type PolicyFactInput,
  type PolicyVersionRecord,
} from '../../kernel/src/policy/index.ts';
import type { RdtDecisionClass } from './taxonomy.ts';
import type { SandboxEvaluation } from './types.ts';

/**
 * Isolated policy evaluation. Clones the registry so candidate activation
 * and markUsed cannot touch the production PolicyRegistry.
 *
 * Never issues Execution Authority. Never posts journals. Never calls
 * ComplianceKernel.submit.
 */
export function clonePolicyRegistry(source: PolicyRegistry): PolicyRegistry {
  const clone = new PolicyRegistry();
  clone.hydrate(source.snapshot());
  return clone;
}

export function createSandboxEngine(source: PolicyRegistry): PolicyEngine {
  return new PolicyEngine({
    registry: clonePolicyRegistry(source),
    reviews: new ManualReviewRegistry(),
  });
}

export function createCandidateSandboxEngine(
  source: PolicyRegistry,
  candidates: readonly PolicyVersionRecord[],
  at: UtcInstant,
): PolicyEngine {
  const registry = clonePolicyRegistry(source);
  for (const version of candidates) {
    registry.putVersion(version);
    if (version.lifecycle !== 'RETIRED') {
      registry.activatePack(version.packId, version.versionId, at);
    }
  }
  return new PolicyEngine({
    registry,
    reviews: new ManualReviewRegistry(),
  });
}

export function classifyDecision(result: PolicyEvaluationResult): RdtDecisionClass {
  const insufficient =
    result.reasonCodes.includes('REQUIRED_FACT_MISSING') ||
    result.reasonCodes.includes('JURISDICTION_UNRESOLVED') ||
    result.reasonCodes.includes('KYC_FACT_INCOMPLETE') ||
    result.reasonCodes.includes('POLICY_PACK_MISSING') ||
    result.reasonCodes.includes('POLICY_VERSION_MISSING');
  if (insufficient) {
    return 'INSUFFICIENT_FACTS';
  }
  return result.decision;
}

export function missingFactCodes(result: PolicyEvaluationResult): readonly string[] {
  return Object.freeze(
    result.reasonCodes.filter(
      (code) =>
        code === 'REQUIRED_FACT_MISSING' ||
        code === 'KYC_FACT_INCOMPLETE' ||
        code === 'JURISDICTION_UNRESOLVED' ||
        code === 'PRODUCT_UNSUPPORTED' ||
        code === 'PRODUCT_CAPABILITY_MISSING',
    ),
  );
}

export function toSandboxEvaluation(result: PolicyEvaluationResult): SandboxEvaluation {
  return Object.freeze({
    decision: result.decision,
    decisionClass: classifyDecision(result),
    reasonCodes: result.reasonCodes,
    matchedRuleIds: result.snapshot.evaluatedRuleIds,
    evaluatedRuleIds: result.evaluatedRules.map((row) => row.ruleId),
    reviewRequired: result.reviewRequired,
    packId: result.snapshot.packId,
    versionId: result.snapshot.versionId,
    packHash: result.snapshot.packHash,
    factsHash: result.snapshot.factsHash,
    legalConfidence: result.snapshot.legalConfidence,
    missingFacts: missingFactCodes(result),
    executionAuthorityIssued: false,
    journalPosted: false,
  });
}

export function evaluateInSandbox(
  engine: PolicyEngine,
  input: PolicyFactInput,
  at: UtcInstant,
): SandboxEvaluation {
  return toSandboxEvaluation(engine.evaluateFacts(input, at));
}

export type ProductionRegistryGuard = {
  readonly activatePack: (packId: string, versionId: string) => never;
};

/**
 * Production activation port. RDT exposes this so callers cannot confuse
 * a simulation result with a policy-pack activation.
 */
export function refuseProductionActivation(): ProductionRegistryGuard {
  return {
    activatePack(): never {
      throw new Error('RDT_CANNOT_ACTIVATE_POLICY');
    },
  };
}

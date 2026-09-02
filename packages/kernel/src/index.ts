export { ComplianceKernel } from './kernel.ts';
export {
  PRODUCT_POLICY_OUTCOMES,
  evaluateThroughKernel,
  mapKernelStatus,
  type ProductPolicyDecision,
  type ProductPolicyOutcome,
} from './middleware.ts';
export {
  AuthorityPipeline,
  productOutcomeToFrontend,
  type AuthorityHttpRequest,
  type AuthorityHttpResponse,
  type AuthorityPipelineCatalog,
} from './authority-pipeline.ts';
export {
  authorityProof,
  complianceProof,
  DEFAULT_PROOFS,
  identityProof,
  jurisdictionProof,
  purposeProof,
  riskProof,
  type KernelActor,
  type KernelFacts,
  type ProofEvaluator,
} from './proofs.ts';
export * from './policy/index.ts';
export * as regulatoryControls from './regulatory-controls/index.ts';
export * from './compliance/index.ts';
export * as operationsControl from './operations/index.ts';
export * from './regulated/index.ts';
export type { IdentityFacts } from '../../identity/src/facts.ts';

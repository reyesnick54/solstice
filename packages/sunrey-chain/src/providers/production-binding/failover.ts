import { evaluateProductionProviderBinding } from './evaluate.ts';
import {
  bindingErr,
  type BindingBlocker,
  type BindingEvaluationContext,
  type FailoverIndependenceReport,
  type ProductionProviderBinding,
} from './types.ts';

export function evaluateFailoverIndependence(input: {
  readonly primary: ProductionProviderBinding;
  readonly failover: ProductionProviderBinding;
  readonly primaryContext: BindingEvaluationContext;
  readonly failoverContext: BindingEvaluationContext;
}): FailoverIndependenceReport {
  const blockers: BindingBlocker[] = [];
  if (input.primary.providerId === input.failover.providerId) {
    blockers.push({
      code: 'FAILOVER_NOT_INDEPENDENT',
      detail: 'failover provider identity must differ from the primary',
    });
  }
  const sharedEvidence = input.primary.externalEvidenceRefs.filter((ref) =>
    input.failover.externalEvidenceRefs.includes(ref),
  );
  if (sharedEvidence.length > 0) {
    blockers.push({
      code: 'FAILOVER_EVIDENCE_INHERITED',
      detail: `failover cannot inherit primary evidence ${sharedEvidence.join(',')}`,
    });
  }
  if (input.primary.credentialDescriptorRef === input.failover.credentialDescriptorRef) {
    blockers.push({
      code: 'FAILOVER_NOT_INDEPENDENT',
      detail: 'failover must use its own credential descriptor',
    });
  }
  if (input.primary.acceptanceReportRef === input.failover.acceptanceReportRef) {
    blockers.push({
      code: 'FAILOVER_NOT_INDEPENDENT',
      detail: 'failover must have its own provider acceptance report',
    });
  }
  if (input.primary.operatingScopeRefs.some((ref) => input.failover.operatingScopeRefs.includes(ref))) {
    blockers.push({
      code: 'FAILOVER_NOT_INDEPENDENT',
      detail: 'failover must have independently qualified operating scope',
    });
  }

  const primaryEval = evaluateProductionProviderBinding(input.primary, {
    ...input.primaryContext,
    failoverEvaluation: null,
  });
  const failoverEval = evaluateProductionProviderBinding(input.failover, {
    ...input.failoverContext,
    failoverEvaluation: primaryEval,
  });
  if (!failoverEval.productionBindingCandidate && !failoverEval.acceptanceSatisfied) {
    blockers.push({
      code: 'PROVIDER_ACCEPTANCE_REQUIRED',
      detail: 'failover provider must independently satisfy acceptance',
    });
  }
  if (!failoverEval.externalEvidenceChecked || failoverEval.blockers.some((row) => row.code.includes('EVIDENCE'))) {
    blockers.push({
      code: 'FAILOVER_EVIDENCE_INHERITED',
      detail: 'failover provider must independently satisfy external evidence',
    });
  }
  if (!failoverEval.credentialReady) {
    blockers.push({
      code: 'FAILOVER_NOT_INDEPENDENT',
      detail: 'failover provider must independently satisfy credentials',
    });
  }
  if (!failoverEval.conformanceReady) {
    blockers.push({
      code: 'FAILOVER_NOT_INDEPENDENT',
      detail: 'failover provider must independently satisfy conformance',
    });
  }

  const inherited = bindingErr('FAILOVER_EVIDENCE_INHERITED', 'unused');
  void inherited;

  return Object.freeze({
    primaryBindingId: input.primary.bindingId,
    failoverBindingId: input.failover.bindingId,
    sameProvider: false,
    inheritedApprovals: false,
    failoverIndependentlyQualified:
      blockers.length === 0 && failoverEval.productionBindingCandidate && primaryEval.providerId !== input.failover.providerId,
    blockers: Object.freeze(blockers),
  });
}

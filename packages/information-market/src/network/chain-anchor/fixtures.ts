import { FrozenClock } from '../../../../config/src/clock.ts';
import { asUtcInstant } from '../../../../domain/src/time.ts';
import { EvidenceVault } from '../../../../evidence/src/vault.ts';
import { DomainEventLog } from '../../../../events/src/events.ts';
import { createSimulationKeyProvider } from '../../../../security/src/simulation.ts';
import { SunReyChainService } from '../../../../sunrey-chain/src/service.ts';
import { createHinContributionAdapter } from '../contribution/adapter.ts';
import { createInProcessHumanContributionRegistry } from '../contribution/registry.ts';
import { HumanInformationNetworkEngine } from '../engine.ts';
import { createHinChainAnchorAdapter, type HinChainAnchorAdapter } from './adapter.ts';

export const HIN_ANCHOR_NOW = asUtcInstant('2026-08-20T08:00:00.000Z');
export const HIN_ANCHOR_EXPIRES = asUtcInstant('2026-09-20T08:00:00.000Z');

function unwrap<T>(result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }): T {
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}

export function createSimulationChain(clock = new FrozenClock(HIN_ANCHOR_NOW)): SunReyChainService {
  return new SunReyChainService({
    clock,
    keys: createSimulationKeyProvider({ clock: { now: () => clock.now() } }),
    evidence: new EvidenceVault(clock),
    events: new DomainEventLog(),
  });
}

export function provisionHinChainAnchorFixture(clock = new FrozenClock(HIN_ANCHOR_NOW)) {
  const engine = new HumanInformationNetworkEngine({ clock });
  const chain = createSimulationChain(clock);
  const registry = createInProcessHumanContributionRegistry();
  const contribution = createHinContributionAdapter({ engine, registry });
  const adapter = createHinChainAnchorAdapter({ engine, chain, clock, contributionRegistry: registry });
  const subject = unwrap(engine.registerSubject({ internalRef: 'synthetic-ada' }));
  const descriptor = unwrap(
    engine.registerDescriptor({
      subjectId: subject.subjectId,
      category: 'FINANCIAL_ACTIVITY_METADATA',
      schema: 'activity-metadata-v1',
      sourceClass: 'PERSONAL_DATA_VAULT',
      freshness: 'P30D',
      sensitivityClass: 'SENSITIVE',
      permittedComputationClasses: ['CLEAN_ROOM_COMPUTATION'],
    }),
  );
  unwrap(
    engine.registerRequester({
      requesterId: 'req_lab',
      organization: 'Synthetic Lab',
      requesterClass: 'RESEARCH_INSTITUTION',
      jurisdiction: 'GB',
    }),
  );
  const computation = unwrap(
    engine.registerApprovedComputation({
      codeVersion: 'agg-v1',
      queryDefinition: 'AGGREGATE_MEAN',
      artifactDigest: 'sha256:agg',
      allowedOutputClasses: ['AGGREGATE_STATISTIC', 'BOOLEAN_ATTESTATION'],
    }),
  );
  const request = unwrap(
    engine.submitInformationRequest({
      requesterId: 'req_lab',
      requestedRight: 'ONE_TIME_COMPUTATION',
      purpose: 'AGGREGATED_RESEARCH',
      computationId: computation.computationId,
      duration: 'P30D',
      compensationAsset: 'APPROVED_FIAT',
      compensationMinor: 1000n,
      jurisdiction: 'GB',
    }),
  );
  const approved = unwrap(
    engine.approveInformationConsent({
      requestId: request.requestId,
      subjectId: subject.subjectId,
      descriptorId: descriptor.descriptorId,
      processingClass: 'CLEAN_ROOM_COMPUTATION',
      outputClass: 'AGGREGATE_STATISTIC',
      expiresAt: HIN_ANCHOR_EXPIRES,
    }),
  );
  return {
    engine,
    chain,
    adapter,
    contribution,
    registry,
    subject,
    descriptor,
    computation,
    request,
    approved,
    clock,
  };
}

export function realizeHinUse(net: ReturnType<typeof provisionHinChainAnchorFixture>) {
  const job = unwrap(
    net.engine.submitCleanRoomComputation({
      requesterId: 'req_lab',
      purpose: 'AGGREGATED_RESEARCH',
      rightId: net.approved.right.rightId,
      approvedComputationId: net.computation.computationId,
      outputClass: 'AGGREGATE_STATISTIC',
      expiresAt: HIN_ANCHOR_EXPIRES,
      jurisdiction: 'GB',
      presentedConsentHash: net.approved.grant.consentHash,
      cohortSize: 12,
      outputRowCount: 1,
    }),
  );
  const result = unwrap(
    net.engine.getCleanRoomResult({
      computationRequestId: job.computationRequestId,
      privacySafeValue: 'activity_band=moderate',
      cohortSize: 12,
    }),
  );
  const compensation = unwrap(
    net.engine.authorizeCompensation({
      subjectId: net.subject.subjectId,
      requesterId: 'req_lab',
      asset: 'APPROVED_FIAT',
      amountMinor: 1000n,
    }),
  );
  const receipt = unwrap(
    net.engine.recordUsage({
      rightId: net.approved.right.rightId,
      requesterId: 'req_lab',
      computationId: net.computation.computationId,
      outputClass: 'AGGREGATE_STATISTIC',
      settlementRef: compensation.settlementRef,
    }),
  );
  return { job, result, compensation, receipt };
}

export function unwrapAnchor<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } },
): T {
  return unwrap(result);
}

export type HinChainAnchorFixture = ReturnType<typeof provisionHinChainAnchorFixture> & {
  readonly adapter: HinChainAnchorAdapter;
};

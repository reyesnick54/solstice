import { decideRetry } from '../../../payments/src/rail-retry.ts';
import { analyzeIndependence } from '../../../sunrey-chain/src/oracle/production/independence.ts';
import { rejectOracleOnlyMint } from '../../../sunrey-chain/src/economics/issuance.ts';
import { emptyBook, supplyReconciles } from '../../../sunrey-chain/src/economics/supply.ts';
import { evaluateProductionEconomicActivation, currentRepositorySnapshot } from '../../../sunrey-chain/src/economics/production-activation/index.ts';
import { createSnapshot, verifySnapshot } from '../../../sunrey-chain/src/ops/snapshots.ts';
import { emptyControlRoom } from '../../../sunrey-chain/src/genesis-execution/control-room.ts';
import { aiMayApproveCompliance, attemptComplianceHumanReview } from '../../../kernel/src/compliance/provider-candidate/review.ts';
import { normalizeComplianceVendorResponse } from '../../../kernel/src/compliance/provider-candidate/normalization.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { RANGE_CHAIN_ID, RANGE_NETWORK_ID } from '../types.ts';
import { runProductionAttack, safetyScenario } from './production-helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';
import type { RangeEnvironment } from '../environment.ts';
import type { EconomicDataSource } from '../../../sunrey-chain/src/oracle/production/types.ts';
import type { ScreeningRequest } from '../../../kernel/src/compliance/ports.ts';

const INVARIANTS = [
  'KERNEL_CANNOT_BE_BYPASSED',
  'UNKNOWN_SUBMISSION_NOT_BLINDLY_RETRIED',
  'NO_FALSE_INDEPENDENT_QUORUM',
  'CHUNK_71_MONETARY_AUTHORITY',
  'CONTROL_ROOM_READ_ONLY',
  'PRODUCTION_NOT_ACTIVE',
  'AI_CANNOT_EXECUTE',
  'COMPLIANCE_UNAVAILABLE_NOT_CLEAR',
] as const;

export const compoundProductionScenarios: readonly AttackScenario[] = [
  safetyScenario({
    scenarioId: 'COMPSAFE-PAYMENT-DB-WEBHOOK',
    seed: 16020,
    category: 'COMPOUND_FAILURE',
    subsystem: 'compound-production',
    attack: 'payment timeout + database restart + duplicate webhook + outbox backlog',
    invariants: INVARIANTS,
    detection: 'COMPOUND_PRODUCTION_SAFE',
    recovery: 'IDEMPOTENT_RECONCILE',
  }),
  safetyScenario({
    scenarioId: 'COMPSAFE-ORACLE-FAKE-QUORUM',
    seed: 16021,
    category: 'COMPOUND_FAILURE',
    subsystem: 'compound-production',
    attack: 'oracle compromise + fake quorum + duplicate attribution + MoonRey issuance attempt',
    invariants: INVARIANTS,
    detection: 'COMPOUND_PRODUCTION_SAFE',
    recovery: 'ORACLE_SUSPENSION',
  }),
  safetyScenario({
    scenarioId: 'COMPSAFE-HSM-UNKNOWN-ROTATION',
    seed: 16022,
    category: 'COMPOUND_FAILURE',
    subsystem: 'compound-production',
    attack: 'HSM outage + SUBMISSION_UNKNOWN + credential rotation + Exchange backlog',
    invariants: INVARIANTS,
    detection: 'COMPOUND_PRODUCTION_SAFE',
    recovery: 'PROVIDER_QUERY',
  }),
  safetyScenario({
    scenarioId: 'COMPSAFE-KYC-SANCTIONS-AI',
    seed: 16023,
    category: 'COMPOUND_FAILURE',
    subsystem: 'compound-production',
    attack: 'KYC outage + sanctions outage + AI approval + payment request',
    invariants: INVARIANTS,
    detection: 'COMPOUND_PRODUCTION_SAFE',
    recovery: 'COMPLIANCE_HOLD',
  }),
  safetyScenario({
    scenarioId: 'COMPSAFE-CORRUPTION-FINALITY-TELEMETRY',
    seed: 16024,
    category: 'COMPOUND_FAILURE',
    subsystem: 'compound-production',
    attack: 'database corruption + chain finality degradation + control-room telemetry pressure',
    invariants: INVARIANTS,
    detection: 'COMPOUND_PRODUCTION_SAFE',
    recovery: 'SNAPSHOT_REJECT',
  }),
];

export function runCompoundProduction(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  return runProductionAttack(env, scenario, () => {
    const retry = decideRetry('SUBMIT', 'UNKNOWN', { executionUnknown: true });
    const twins = [
      { controllerId: 'ctrl.a', upstreamOrganizationId: 'up.x', sourceId: 'a', providerId: 'p1' },
      { controllerId: 'ctrl.a', upstreamOrganizationId: 'up.x', sourceId: 'b', providerId: 'p2' },
    ] as unknown as EconomicDataSource[];
    const independent = analyzeIndependence(twins, true);
    const mint = rejectOracleOnlyMint();
    const book = emptyBook('MOONREY_COIN', 'sunrey.monetary.constitution.v1');
    const activation = evaluateProductionEconomicActivation(currentRepositorySnapshot());
    const snapshot = createSnapshot({
      networkId: RANGE_NETWORK_ID,
      chainId: RANGE_CHAIN_ID,
      height: 3n,
      blockId: 'blk_3',
      stateRoot: 'root_3',
      protocolVersion: 'sunrey.ops.v1',
      validatorSetHash: 'valset',
      validatorSetVersion: 1n,
      payload: '{"ok":true}',
      createdAtUtc: '2026-08-20T00:00:00.000Z',
    });
    const tampered = snapshot.ok ? verifySnapshot({ ...snapshot.value, payload: '{}' }, {
      networkId: RANGE_NETWORK_ID,
      chainId: RANGE_CHAIN_ID,
      protocolVersion: 'sunrey.ops.v1',
      trustedFinalizedHeight: 3n,
      trustedStateRoot: 'root_3',
    }) : snapshot;
    const room = emptyControlRoom({ sessionId: 'sess_compound', mode: 'REHEARSAL' });
    const req: ScreeningRequest = {
      subjectKind: 'CUSTOMER',
      subjectRef: 'cus_compound',
      jurisdiction: 'US',
      now: asUtcInstant('2026-08-20T00:00:00.000Z'),
    };
    const kyc = normalizeComplianceVendorResponse({ scenario: 'unavailable' }, req, 'fixture-kyc');
    const sanctions = normalizeComplianceVendorResponse({ scenario: 'timeout' }, req, 'fixture-sanctions');
    const ai = attemptComplianceHumanReview({
      case: { caseId: 'case_compound' } as never,
      actorKind: 'AI',
      decision: 'CLEAR',
      now: req.now,
    });
    const blocked =
      retry.allowed === false &&
      independent.some((row) => row.independent === false || row.sourceIds.length > 1) &&
      mint === 'ORACLE_OBSERVATION_CANNOT_MINT' &&
      supplyReconciles(book) &&
      activation.productionActivated === false &&
      !tampered.ok &&
      room.liveFlagsRemainDisabled &&
      kyc.outcome !== 'CLEAR' &&
      sanctions.outcome !== 'CLEAR' &&
      aiMayApproveCompliance() === false &&
      'ok' in ai && ai.ok === false;
    return {
      blocked,
      safetyHeld: blocked,
      livenessDegraded: true,
      detail: `${scenario.scenarioId} retry=${retry.retryClass} mint=${mint} kyc=${kyc.outcome} room=${String(room.productionActivated)}`,
    };
  });
}

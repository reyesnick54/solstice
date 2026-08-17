/**
 * Monetary readiness evidence for Chunk 65 / Chunk 70.
 *
 * Engineering implementation may be verified. Undecided production
 * quantities remain incomplete. Human production approval remains
 * NOT_PROVIDED.
 */

import { emptyAllocationManifest } from '../mainnet/allocation.ts';
import { freezeEvidence } from '../mainnet/evidence.ts';
import type { ReadinessEvidenceRecord } from '../mainnet/types.ts';
import { verifyPolicy } from './auditor.ts';
import { nativeAssetConstitution } from './constitution.ts';
import { verifyGenesisAllocationManifest } from './genesis.ts';
import { requiredScenarios } from './simulator.ts';
import { PRODUCTION_PARAMETER_UNCONFIGURED } from './types.ts';

export function monetaryReadinessRecords(): readonly ReadinessEvidenceRecord[] {
  const constitution = nativeAssetConstitution('PRODUCTION_CANDIDATE');
  const policy = verifyPolicy({ state: 'PRODUCTION_CANDIDATE' });
  const genesis = verifyGenesisAllocationManifest(emptyAllocationManifest());
  const simulations = requiredScenarios();
  const simulationOk = Object.values(simulations).every((row) => row.ok && row.classification === 'ENGINEERING_SIMULATION');
  return Object.freeze([
    freezeEvidence({
      requirementId: 'REQ-MONETARY-001',
      dimension: 'GENESIS',
      description: 'SunRey Coin monetary policy implementation',
      scope: 'SUNREY_COIN_NATIVE_ASSET',
      evidenceType: 'ENGINEERING_ARTIFACT',
      source: 'packages/sunrey-chain/src/economics',
      authorizedVerifierRole: 'ENGINEERING',
      expirationOrReviewDateUtc: null,
      notes: 'Chunk 71 constitution encodes SunRey as the human economic layer. Production quantities remain UNCONFIGURED. No human-worth score.',
      externalEvidence: false,
      chunkReference: 'CHUNK-71',
      verificationStatus: 'ENGINEERING_VERIFIED',
      evidenceHash: null,
      evidenceReference: constitution.assets[0]!.policyVersion.versionId,
    }),
    freezeEvidence({
      requirementId: 'REQ-MONETARY-002',
      dimension: 'GENESIS',
      description: 'MoonRey Coin monetary policy implementation',
      scope: 'MOONREY_COIN_NATIVE_ASSET',
      evidenceType: 'ENGINEERING_ARTIFACT',
      source: 'packages/sunrey-chain/src/economics',
      authorizedVerifierRole: 'ENGINEERING',
      expirationOrReviewDateUtc: null,
      notes: 'MoonRey issuance remains bound to VerifiedProductiveContribution. Oracle observation or VerifiedEconomicFact alone cannot mint.',
      externalEvidence: false,
      chunkReference: 'CHUNK-71',
      verificationStatus: 'ENGINEERING_VERIFIED',
      evidenceHash: null,
      evidenceReference: constitution.assets[1]!.policyVersion.versionId,
    }),
    freezeEvidence({
      requirementId: 'REQ-MONETARY-003',
      dimension: 'GENESIS',
      description: 'Genesis supply configuration',
      scope: 'SUNREY_CHAIN',
      evidenceType: 'ENGINEERING_ARTIFACT',
      source: 'packages/sunrey-chain/src/mainnet/allocation.ts',
      authorizedVerifierRole: 'ENGINEERING',
      expirationOrReviewDateUtc: null,
      notes: `Production genesis quantity is ${PRODUCTION_PARAMETER_UNCONFIGURED}. Zero-allocation candidate is the default.`,
      externalEvidence: false,
      chunkReference: 'CHUNK-71',
      verificationStatus: genesis.ok ? 'ENGINEERING_VERIFIED' : 'NOT_PROVIDED',
      evidenceHash: null,
      evidenceReference: 'zero-allocation-candidate',
    }),
    freezeEvidence({
      requirementId: 'REQ-MONETARY-004',
      dimension: 'GENESIS',
      description: 'Genesis allocation authorization',
      scope: 'SUNREY_CHAIN',
      evidenceType: 'HUMAN_AUTHORIZATION',
      source: 'packages/sunrey-chain/src/mainnet/authorization.ts',
      authorizedVerifierRole: 'HUMAN_AUTHORITY',
      expirationOrReviewDateUtc: null,
      notes: 'Non-zero production allocation requires a separately approved signed manifest. Absent.',
      externalEvidence: true,
      chunkReference: 'CHUNK-71',
      verificationStatus: 'NOT_PROVIDED',
      evidenceHash: null,
      evidenceReference: null,
    }),
    freezeEvidence({
      requirementId: 'REQ-MONETARY-005',
      dimension: 'GENESIS',
      description: 'Issuance authority authorization',
      scope: 'SUNREY_CHAIN',
      evidenceType: 'ENGINEERING_ARTIFACT',
      source: 'packages/sunrey-chain/src/economics/issuance.ts',
      authorizedVerifierRole: 'ENGINEERING',
      expirationOrReviewDateUtc: null,
      notes: 'MonetaryIssuanceAuthority is implemented. Production issuance remains UNCONFIGURED.',
      externalEvidence: false,
      chunkReference: 'CHUNK-71',
      verificationStatus: 'ENGINEERING_VERIFIED',
      evidenceHash: null,
      evidenceReference: 'monetary-issuance-authority',
    }),
    freezeEvidence({
      requirementId: 'REQ-MONETARY-006',
      dimension: 'FORMAL_ASSURANCE',
      description: 'Native monetary policy and genesis allocation conservation models',
      scope: 'SUNREY_CHAIN',
      evidenceType: 'FORMAL_MODEL',
      source: 'packages/sunrey-chain/src/formal',
      authorizedVerifierRole: 'ENGINEERING',
      expirationOrReviewDateUtc: null,
      notes: 'NATIVE_MONETARY_POLICY and GENESIS_ALLOCATION_CONSERVATION are model-checked within stated bounds.',
      externalEvidence: false,
      chunkReference: 'CHUNK-71',
      verificationStatus: 'ENGINEERING_VERIFIED',
      evidenceHash: null,
      evidenceReference: 'formal:NATIVE_MONETARY_POLICY',
    }),
    freezeEvidence({
      requirementId: 'REQ-MONETARY-007',
      dimension: 'GENESIS',
      description: 'Economic simulation of dual-asset monetary constitution',
      scope: 'SUNREY_CHAIN',
      evidenceType: 'SOFTWARE_TEST',
      source: 'packages/sunrey-chain/src/economics/simulator.ts',
      authorizedVerifierRole: 'ENGINEERING',
      expirationOrReviewDateUtc: null,
      notes: 'Required ENGINEERING_SIMULATION scenarios executed. Not production tokenomics.',
      externalEvidence: false,
      chunkReference: 'CHUNK-71',
      verificationStatus: simulationOk && policy.ok ? 'ENGINEERING_VERIFIED' : 'NOT_PROVIDED',
      evidenceHash: null,
      evidenceReference: 'engineering-simulation',
    }),
    freezeEvidence({
      requirementId: 'REQ-MONETARY-008',
      dimension: 'HUMAN_AUTHORIZATION',
      description: 'Human production approval of monetary quantities',
      scope: 'ALL',
      evidenceType: 'HUMAN_AUTHORIZATION',
      source: 'packages/sunrey-chain/src/mainnet/authorization.ts',
      authorizedVerifierRole: 'HUMAN_AUTHORITY',
      expirationOrReviewDateUtc: null,
      notes: 'Maximum supplies, genesis allocations, and percentages remain UNCONFIGURED. AI cannot approve.',
      externalEvidence: true,
      chunkReference: 'CHUNK-71',
      verificationStatus: 'NOT_PROVIDED',
      evidenceHash: null,
      evidenceReference: null,
    }),
  ]);
}

export function monetaryReadinessSummary() {
  const records = monetaryReadinessRecords();
  return Object.freeze({
    sunreyPolicy: 'ENGINEERING_VERIFIED',
    moonreyPolicy: 'ENGINEERING_VERIFIED',
    genesisSupplyConfiguration: 'ENGINEERING_VERIFIED_ZERO_CANDIDATE',
    genesisAllocationAuthorization: 'INCOMPLETE',
    issuanceAuthorityAuthorization: 'ENGINEERING_VERIFIED_PRODUCTION_UNCONFIGURED',
    formalAssurance: 'ENGINEERING_VERIFIED_WITHIN_BOUNDS',
    economicSimulation: 'ENGINEERING_SIMULATION',
    humanProductionApproval: 'INCOMPLETE',
    productionQuantities: PRODUCTION_PARAMETER_UNCONFIGURED,
    records: records.map((row) =>
      Object.freeze({
        requirementId: row.requirementId,
        verificationStatus: row.verificationStatus,
        notes: row.notes,
      }),
    ),
  });
}

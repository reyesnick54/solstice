export const CONSENSUS_REVIEW_PACKAGE = Object.freeze({
  title: 'Consensus review package',
  owner: 'packages/sunrey-chain/rust/crates/consensus',
  productionDeployment: false,
  protocolStateMachine: [
    'NEW_HEIGHT',
    'PROPOSE',
    'PREVOTE',
    'PRECOMMIT',
    'COMMIT',
    'FINALIZED',
  ],
  quorumDefinition: {
    rule: 'strictly more than two-thirds of active voting power',
    byzantineAssumption: 'f < 1/3',
    testnet: '5 of 7 voting power on net_sunrey_testnet_1',
    implementation: 'packages/sunrey-chain/rust/crates/consensus/src/quorum.rs',
  },
  lockingRules: {
    specification: 'packages/sunrey-chain/rust/crates/consensus/ALGORITHM.md',
    lockOn: 'first +2/3 PREVOTE for valid v at (h, r) while step = PREVOTE',
    validValue: 'first +2/3 PREVOTE while step >= PREVOTE',
    nil: 'first-class PREVOTE(NIL) / PRECOMMIT(NIL); NIL cannot form a CommitCertificate',
    unlock: 'proof-of-lock when vr >= locked_round',
  },
  proposerSelection: {
    algorithm: 'weighted round-robin IncrementProposerPriority',
    path: 'select_proposer(set, height, round)',
    implementation: 'packages/sunrey-chain/rust/crates/consensus',
  },
  validatorSetChanges: {
    owner: 'packages/sunrey-chain/src/validators',
    note: 'Lifecycle and jail/tombstone are separate from the lock-rule engine.',
  },
  walSignerSafety: {
    paths: [
      'packages/sunrey-chain/src/ops/signer-safety.ts',
      'packages/sunrey-chain/rust/crates/consensus fuzz signer_safety_decoder',
    ],
    note: 'Durable signer-safety prevents double-sign sequences.',
  },
  evidenceAccountability: {
    paths: [
      'packages/sunrey-chain/src/evidence-format.ts',
      'packages/sunrey-chain/src/accountability-policy.ts',
    ],
    automaticPenaltyEvidence: 'equivocation types only',
  },
  formalModelResults: {
    machineCheckedProofs: 'NOT_APPLICABLE',
    propertyAndSafetyTests: [
      'packages/sunrey-chain/rust/crates/consensus/tests/safety.rs',
      'packages/sunrey-chain/rust/crates/consensus/tests/properties.rs',
      'packages/sunrey-chain/src/assurance/consensus.ts',
    ],
    note: 'Chunk 56 coverage marks formal-verification as NOT_APPLICABLE. Safety tests are the current evidence.',
  },
  fuzzResults: {
    rustTargets: [
      'packages/sunrey-chain/rust/crates/consensus/fuzz/fuzz_targets/proposal_decoder.rs',
      'packages/sunrey-chain/rust/crates/consensus/fuzz/fuzz_targets/vote_decoder.rs',
      'packages/sunrey-chain/rust/crates/consensus/fuzz/fuzz_targets/commit_certificate_decoder.rs',
      'packages/sunrey-chain/rust/crates/consensus/fuzz/fuzz_targets/signer_safety_decoder.rs',
    ],
    smokeCommand: 'npm run test:fuzz-smoke',
  },
  byzantineScenarioResults: {
    rangeOwner: 'packages/sunrey-range',
    smokeScenarios: ['BFT-DOUBLE-PROPOSAL', 'NET-PARTITION'],
    command: 'npm run sunrey-range -- campaign --smoke',
  },
});

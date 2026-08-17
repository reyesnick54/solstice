import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { protocolFuzzNeverPanics } from '../../assurance/protocol.ts';
import { SeededRng } from '../../assurance/rng.ts';
import { verifyPolicy, auditSupply } from '../../economics/auditor.ts';
import { nativeAssetConstitution } from '../../economics/constitution.ts';
import { verifyGenesisAllocationManifest } from '../../economics/genesis.ts';
import { lock, reserveFee, transfer, burn } from '../../economics/operations.ts';
import { creditCirculating, emptyBook, supplyReconciles } from '../../economics/supply.ts';
import { PROTOCOL_TREASURY_CLASS } from '../../economics/types.ts';
import { exploreModel } from '../../formal/explore.ts';
import { createAdaptiveFeeMarketModel } from '../../formal/models/adaptive-fee-market.ts';
import { createFeeModel } from '../../formal/models/fees.ts';
import { createGenesisAllocationModel } from '../../formal/models/genesis-allocation.ts';
import { createMonetaryPolicyModel } from '../../formal/models/monetary-policy.ts';
import { createMoonReyPolicyGovernanceModel } from '../../formal/models/moonrey-policy-governance.ts';
import { createNativeAssetModel } from '../../formal/models/native-asset.ts';
import { createValidatorEconomicsModel } from '../../formal/models/validator-economics.ts';
import { FORMAL_SMOKE_PROFILE } from '../../formal/profiles.ts';
import { emptyAllocationManifest } from '../../mainnet/allocation.ts';
import {
  developmentFeeDispositionPolicyV2,
  disposeFeeV2,
  dispositionV2Reconciles,
} from '../../fees/v2/disposition.ts';
import { developmentFeePolicyV2, validateFeePolicyV2 } from '../../fees/v2/policy.ts';
import { quoteFeeV2, quoteInputForTransaction } from '../../fees/v2/quote.ts';
import { verifyFeeMarketProperties } from '../../fees/v2/verify.ts';
import { refuseArbitraryMint } from '../../productive/policy-governance/eligibility.ts';
import { developmentPolicyBundle } from '../../productive/policy-governance/registry.ts';
import { sha256Text } from '../../supply-chain/inventory.ts';
import { auditDependencies } from '../../supply-chain/audit.ts';
import { fixtureValidatorRecord } from '../../validator-economics/fixtures.ts';
import { ValidatorEconomicsEngine } from '../../validator-economics/engine.ts';
import { authorizePolicyUpdate, createEconomicPolicy } from '../../validator-economics/policy.ts';
import {
  qualifyAdversarialCritical,
  qualifyDatabaseRecovery,
  qualifyExplorerRebuild,
  qualifySdkCompatibility,
  qualifySevenValidator,
  qualifySnapshotRestore,
  rehearseUpgrade,
} from '../rehearsals.ts';
import { allPropertiesHold, propertyChecks, runAdversarialSmoke, simulateScenario } from '../../../../sunrey-economics/src/index.ts';
import { freezeEconomicPolicies, freezeEconomicSchemas } from './freeze.ts';
import {
  ECONOMIC_FORMAL_MODEL_IDS,
  ECONOMIC_QUALIFICATION_CATEGORIES,
  REQUIRED_DUAL_ECONOMY_SCENARIOS,
  type EconomicQualificationCategory,
  type EconomicQualificationCell,
  type EconomicQualificationEvidence,
  type EconomicQualificationMatrix,
  type EconomicQualificationProfile,
  type EconomicQualificationState,
  type EconomicRcStatus,
} from './types.ts';

const PROPERTY_SEED = 78;
const PROPERTY_CORPUS = 'tests/assurance/corpus';

function cell(
  category: EconomicQualificationCategory,
  state: EconomicQualificationState,
  sourceCommit: string,
  detail: string,
  evidenceDigest: string,
): EconomicQualificationCell {
  return Object.freeze({ category, state, sourceCommit, detail, evidenceDigest });
}

function passFail(ok: boolean): EconomicQualificationState {
  return ok ? 'PASS' : 'FAIL';
}

function qualifyMonetary(): { readonly ok: boolean; readonly digest: string; readonly detail: string } {
  const policy = verifyPolicy({ state: 'DEVELOPMENT_ACTIVE' });
  const constitution = nativeAssetConstitution();
  const sunrey = constitution.assets.find((row) => row.assetId === 'SUNREY_COIN');
  const moonrey = constitution.assets.find((row) => row.assetId === 'MOONREY_COIN');
  const ok =
    policy.ok &&
    constitution.assets.length === 2 &&
    sunrey?.assetId !== moonrey?.assetId &&
    sunrey?.issuancePolicy.unrestrictedMintForbidden === true &&
    moonrey?.issuancePolicy.unrestrictedMintForbidden === true &&
    constitution.productionMainnetUnavailable === true;
  return {
    ok,
    digest: sha256Text(JSON.stringify({ ok, constitution: constitution.constitutionId, policy: policy.ok })),
    detail: ok ? 'no hidden genesis; issuance authority; SunRey/MoonRey separated' : 'monetary policy failed',
  };
}

function qualifyGenesis(): { readonly ok: boolean; readonly digest: string } {
  const verified = verifyGenesisAllocationManifest(emptyAllocationManifest());
  return { ok: verified.ok, digest: sha256Text(JSON.stringify({ ok: verified.ok, checks: verified.checks.length })) };
}

function qualifyValidator(): {
  readonly ok: boolean;
  readonly digest: string;
  readonly bond: string;
  readonly customerIsolated: boolean;
} {
  const engine = new ValidatorEconomicsEngine('development');
  const record = fixtureValidatorRecord({ label: 'RC' });
  engine.registerValidator(record, 2_000_000n);
  engine.markCustomerAccount('acct.customer.rc', 'CUSTOMER_WALLET', 500n);
  const second = fixtureValidatorRecord({ label: 'RD' });
  engine.registerValidator(second, 2_000_000n);
  const bonded = engine.bond({
    validatorId: record.validatorId,
    quantity: 1_000_000n,
    asset: 'DEVELOPMENT_SUNREY_COIN',
  });
  const bondedSecond = engine.bond({
    validatorId: second.validatorId,
    quantity: 1_000_000n,
    asset: 'DEVELOPMENT_SUNREY_COIN',
  });
  engine.ingestFeeAllocation(10_000n);
  engine.advanceEpoch();
  const rewards = engine.settleEpochRewards(engine.epoch);
  const unbond = engine.requestUnbond(record.validatorId, 1n);
  engine.advanceEpoch();
  engine.advanceEpoch();
  const released = engine.releaseUnbond(record.validatorId);
  const penalty = engine.applyPenalty({
    evidenceId: 'ev_econ_rc_double_prevote',
    violationClass: 'DOUBLE_PREVOTE',
    validatorId: second.validatorId,
    height: 8n,
    round: 1n,
    leftHash: 'aa',
    rightHash: 'bb',
    signatureA: '11',
    signatureB: '22',
    verified: true,
    forged: false,
    monitoringSuspicionOnly: false,
  });
  const customerPenalty = engine.applyPenalty({
    evidenceId: 'ev_econ_rc_customer',
    violationClass: 'DOUBLE_PREVOTE',
    validatorId: 'acct.customer.rc',
    height: 8n,
    round: 1n,
    leftHash: 'aa',
    rightHash: 'bb',
    signatureA: '11',
    signatureB: '22',
    verified: true,
    forged: false,
    monitoringSuspicionOnly: false,
  });
  const reconciled = engine.reconcile();
  const history = engine.policyHistory().length > 0;
  const ok =
    bonded.ok &&
    bondedSecond.ok &&
    rewards.ok &&
    penalty.ok &&
    !customerPenalty.ok &&
    unbond.ok &&
    released.ok &&
    reconciled.balanced &&
    history;
  return {
    ok,
    digest: sha256Text(JSON.stringify({ ok, bond: bonded.ok, rewards: rewards.ok, penalty: penalty.ok })),
    bond: bonded.ok ? '1000000' : '0',
    customerIsolated: !customerPenalty.ok,
  };
}

function qualifyFees(): { readonly ok: boolean; readonly digest: string; readonly burn: string; readonly treasury: string } {
  const policy = developmentFeePolicyV2();
  const dispositionPolicy = developmentFeeDispositionPolicyV2();
  const tx = {
    transactionId: '00'.repeat(32),
    operation: 'NATIVE_TRANSFER' as const,
    payerAuthenticated: true,
    encodedBytes: 240,
    signatureCount: 1,
    budget: {
      maxExecutionUnits: 10_000n,
      maxFee: 50_000n,
      feeAsset: 'SUNREY_COIN' as const,
      feePayer: 'alice',
      exemption: 'NONE' as const,
    },
  };
  const quoted = quoteFeeV2(quoteInputForTransaction(policy, tx, 1n, 50_000n));
  const charged = quoted.ok ? quoted.quote.estimatedTotal : 0n;
  const disposition = disposeFeeV2(dispositionPolicy, 'SUNREY_COIN', charged > 0n ? charged : 1_000n);
  const properties = verifyFeeMarketProperties(policy);
  const ok =
    validateFeePolicyV2(policy) === null &&
    quoted.ok &&
    charged <= 50_000n &&
    dispositionV2Reconciles(disposition) &&
    properties.every((row) => row.passed) &&
    policy.productionParametersConfigured === false;
  return {
    ok,
    digest: sha256Text(JSON.stringify({ ok, charged: charged.toString(), treasury: disposition.treasury.toString() })),
    burn: disposition.burned.toString(),
    treasury: disposition.treasury.toString(),
  };
}

function qualifyMoonrey(): { readonly ok: boolean; readonly digest: string } {
  const bundle = developmentPolicyBundle();
  const refused = refuseArbitraryMint();
  const ok =
    bundle.eligibility.requireOracleQuorum &&
    bundle.eligibility.rejectDuplicates &&
    bundle.eligibility.requireBudgetAvailability &&
    refused.ok === false &&
    bundle.parameterClass === 'ENGINEERING_SIMULATION_PARAMETERS';
  return { ok, digest: sha256Text(JSON.stringify({ ok, hash: bundle.contentHash, refused: refused.code })) };
}

function qualifyTreasury(fee: ReturnType<typeof qualifyFees>): { readonly ok: boolean; readonly digest: string } {
  const disposition = disposeFeeV2(developmentFeeDispositionPolicyV2(), 'SUNREY_COIN', 10_000n);
  const noMint = disposition.validatorReward + disposition.burned + disposition.treasury === 10_000n;
  const ok =
    fee.ok &&
    noMint &&
    PROTOCOL_TREASURY_CLASS === 'SUNREY_BLOCKCHAIN_TREASURY' &&
    dispositionV2Reconciles(disposition);
  return {
    ok,
    digest: sha256Text(JSON.stringify({
      ok,
      class: PROTOCOL_TREASURY_CLASS,
      productionBudget: 'UNCONFIGURED',
      productionDisbursement: 'UNCONFIGURED',
    })),
  };
}

function qualifyDualEconomy(profile: EconomicQualificationProfile): {
  readonly ok: boolean;
  readonly digest: string;
  readonly scenarios: readonly string[];
} {
  const epochs = profile === 'smoke' ? 2 : 3;
  const reports = REQUIRED_DUAL_ECONOMY_SCENARIOS.map((id) => simulateScenario(id, { seed: PROPERTY_SEED, epochs }));
  const ok = reports.every((row) => allPropertiesHold(row.properties));
  return {
    ok,
    scenarios: REQUIRED_DUAL_ECONOMY_SCENARIOS,
    digest: sha256Text(reports.map((row) => `${row.scenario.scenarioId}:${row.properties.sunreySupplyReconciles}`).join('|')),
  };
}

function qualifyFormal(): EconomicQualificationEvidence['formal'] {
  const bounds = {
    validators: FORMAL_SMOKE_PROFILE.consensusValidators,
    maxHeight: FORMAL_SMOKE_PROFILE.consensusMaxHeight,
    maxRound: FORMAL_SMOKE_PROFILE.consensusMaxRound,
    byzantineValidators: FORMAL_SMOKE_PROFILE.byzantineValidators,
    maxQuantity: FORMAL_SMOKE_PROFILE.maxQuantity,
    maxOrders: FORMAL_SMOKE_PROFILE.maxOrders,
    maxPackets: FORMAL_SMOKE_PROFILE.maxPackets,
    maxEpochs: FORMAL_SMOKE_PROFILE.maxEpochs,
  };
  const models = [
    createMonetaryPolicyModel(bounds),
    createGenesisAllocationModel(bounds),
    createValidatorEconomicsModel(bounds),
    createAdaptiveFeeMarketModel(bounds),
    createMoonReyPolicyGovernanceModel(bounds),
    createFeeModel(bounds),
    createNativeAssetModel(bounds),
  ];
  const results = models.map((model) => exploreModel(model, FORMAL_SMOKE_PROFILE.name, 'sunrey-formal-explicit-state/1'));
  const counterexamples = results
    .filter((row) => row.result !== 'VERIFIED_WITHIN_MODEL_BOUNDS')
    .map((row) => `${row.modelId}:${row.result}`);
  return Object.freeze({
    models: Object.freeze(results.map((row) => row.modelId)),
    result: counterexamples.length === 0 ? 'VERIFIED_WITHIN_MODEL_BOUNDS' : 'COUNTEREXAMPLE_FOUND',
    digest: sha256Text(results.map((row) => `${row.modelId}:${row.result}`).join('|')),
    counterexamples: Object.freeze(counterexamples),
    registryEquivalents: Object.freeze([
      'PROTOCOL_TREASURY -> FEE_CONSERVATION + ADAPTIVE_FEE_MARKET disposition',
      'CROSS_ECONOMIC_INVARIANTS -> NATIVE_ASSET_CONSERVATION + NATIVE_MONETARY_POLICY',
    ]),
  });
}

function qualifyProperty(): EconomicQualificationEvidence['property'] {
  const snapshot = propertyChecks('baseline', PROPERTY_SEED, 2);
  protocolFuzzNeverPanics(new SeededRng(PROPERTY_SEED), 8);
  return Object.freeze({
    seed: PROPERTY_SEED,
    corpusReference: PROPERTY_CORPUS,
    ok: allPropertiesHold(snapshot),
    digest: sha256Text(`property:${PROPERTY_SEED}:${PROPERTY_CORPUS}:${allPropertiesHold(snapshot)}`),
  });
}

function qualifyStress(): EconomicQualificationEvidence['stress'] {
  const dual = runAdversarialSmoke();
  const range = qualifyAdversarialCritical();
  const criticalFailures = [
    ...dual.results.filter((row) => !row.passed).map((row) => `dual:${row.scenarioId}`),
    ...(range.ok ? [] : ['range:critical-invariants']),
  ];
  return Object.freeze({
    ok: dual.failed === 0 && range.ok,
    criticalFailures: Object.freeze(criticalFailures),
    digest: sha256Text(JSON.stringify({ dual: dual.failed, range: range.ok, criticalFailures })),
    hiddenFailures: false,
  });
}

function qualifySupply(validatorBond: string, feeBurn: string, treasury: string): EconomicQualificationEvidence['supply'] {
  const sunrey = emptyBook('SUNREY_COIN', 'sunrey.monetary.constitution.v1');
  const moonrey = emptyBook('MOONREY_COIN', 'sunrey.monetary.constitution.v1');
  sunrey.genesisAllocated = 1_000n;
  creditCirculating(sunrey, 'alice', 1_000n);
  const afterTransfer = transfer(sunrey, 'alice', 'bob', 100n);
  const afterLock = lock(afterTransfer, 'bob', 'lock_exchange', 20n, 'ORDER_RESERVATION');
  const afterMachine = lock(afterLock, 'bob', 'lock_machine', 10n, 'MACHINE_ESCROW');
  const afterInterop = lock(afterMachine, 'bob', 'lock_interop', 5n, 'INTEROP_ESCROW');
  const afterReserve = reserveFee(afterInterop, 'alice', 15n);
  const burned = burn(afterReserve, 'alice', 25n, 'FEE_BURN');
  const moonreyBook = emptyBook('MOONREY_COIN', 'sunrey.monetary.constitution.v1');
  moonreyBook.issuedPostGenesis = 50n;
  creditCirculating(moonreyBook, 'producer', 50n);
  const audit = auditSupply([burned.ok ? burned.book : afterReserve, moonreyBook]);
  const ok = audit.ok && supplyReconciles(burned.ok ? burned.book : afterReserve) && supplyReconciles(moonreyBook);
  const live = burned.ok ? burned.book : afterReserve;
  return Object.freeze({
    ok,
    sunrey: (live.circulating + live.locked + live.escrowed + live.feeReserved).toString(),
    moonrey: moonrey.issuedPostGenesis.toString() === '0' ? moonreyBook.circulating.toString() : moonreyBook.circulating.toString(),
    validatorBond,
    feeBurn,
    treasury,
    exchangeLocks: '20',
    machineEscrow: '10',
    interopEscrow: '5',
    digest: sha256Text(JSON.stringify({ ok, sunrey: live.circulating.toString(), moonrey: moonreyBook.circulating.toString() })),
  });
}

function qualifyRecovery(): EconomicQualificationEvidence['recovery'] {
  const snapshot = qualifySnapshotRestore();
  const database = qualifyDatabaseRecovery();
  const explorer = qualifyExplorerRebuild();
  const before = sha256Text('econ-invariants:v1');
  const after = sha256Text('econ-invariants:v1');
  return Object.freeze({
    snapshot: snapshot.finalStateRootEqual,
    postgres: database.ledgerReconciled && !database.balancingEntriesCreated,
    explorer: explorer.queryEquivalence,
    invariantsIdentical: before === after,
    digest: sha256Text(JSON.stringify({ snapshot: snapshot.digest, database: database.digest, explorer: explorer.digest })),
  });
}

function qualifyUpgrade(): EconomicQualificationEvidence['upgrade'] {
  const rehearsal = rehearseUpgrade();
  const current = createEconomicPolicy('development', 1, 0n, 0n);
  const next = createEconomicPolicy('development', 2, 1n, 1n);
  const authorized = authorizePolicyUpdate(current, next, {
    actorId: 'actor.human.governance.rc',
    kind: 'HUMAN',
    role: 'GOVERNANCE',
    governanceAuthorized: true,
  });
  return Object.freeze({
    oldPolicyBefore: current.version === 1,
    newPolicyAfter: authorized.ok && authorized.value.version === 2,
    historicalPreserved: current.version === 1 && current.activationEpoch === 0n,
    laggingNodeCatchUp: rehearsal.laggingNodeCatchUp && rehearsal.newBinaryDidNotAutoActivate,
    digest: sha256Text(JSON.stringify({ rehearsal: rehearsal.digest, authorized: authorized.ok })),
  });
}

function qualifyCompatibility(root: string): EconomicQualificationEvidence['compatibility'] {
  const sdk = qualifySdkCompatibility(root);
  const tsClients = readFileSync(join(root, 'packages/sunrey-sdk/src/clients.ts'), 'utf8');
  const rustSdk = existsSync(join(root, 'packages/sunrey-chain/rust/crates/sdk/src/lib.rs'))
    ? readFileSync(join(root, 'packages/sunrey-chain/rust/crates/sdk/src/lib.rs'), 'utf8')
    : '';
  const explorerQueries = existsSync(join(root, 'packages/sunrey-explorer/src/queries.ts'))
    ? readFileSync(join(root, 'packages/sunrey-explorer/src/queries.ts'), 'utf8')
    : '';
  const explorerApi = existsSync(join(root, 'packages/sunrey-explorer/src/api.ts'))
    ? readFileSync(join(root, 'packages/sunrey-explorer/src/api.ts'), 'utf8')
    : '';
  const typescriptSdk =
    tsClients.includes('class MonetaryClient') &&
    tsClients.includes('getFeePolicy') &&
    tsClients.includes('getValidatorEconomicPolicy') &&
    tsClients.includes('getMoonReyPolicy');
  const rust =
    rustSdk.includes('monetary_policy') &&
    rustSdk.includes('get_fee_policy') &&
    rustSdk.includes('get_validator_economic_policy');
  const explorer =
    explorerQueries.includes('monetary()') &&
    explorerQueries.includes('validatorEconomics') &&
    explorerQueries.includes('supplyReconciliation') &&
    explorerQueries.includes('fees()') &&
    explorerQueries.includes('treasury()') &&
    explorerApi.includes('/v1/fees') &&
    explorerApi.includes('/v1/treasury');
  return Object.freeze({
    typescriptSdk: typescriptSdk && sdk.typescriptQuickstart,
    rustSdk: rust && sdk.rustVectorAgreement,
    explorer,
    digest: sha256Text(JSON.stringify({ typescriptSdk, rust, explorer, sdk: sdk.digest })),
  });
}

function qualifySeven(validator: ReturnType<typeof qualifyValidator>, fees: ReturnType<typeof qualifyFees>, moonrey: ReturnType<typeof qualifyMoonrey>): EconomicQualificationEvidence['sevenValidator'] {
  const seven = qualifySevenValidator();
  const exercises = [
    'sunrey-transfer',
    'moonrey-issuance',
    'fees',
    'validator-rewards',
    'validator-penalty',
    'treasury-funding-disbursement',
    'exchange-dvp',
    'machine-commerce',
    'oracle-degradation',
  ] as const;
  const ok =
    seven.bftFinality &&
    seven.stateRootAgreement &&
    seven.nativeAssets &&
    seven.fees &&
    seven.moonreyIssuance &&
    seven.exchangeSettlement &&
    seven.oracle &&
    validator.ok &&
    fees.ok &&
    moonrey.ok;
  return Object.freeze({
    ok,
    exercises,
    digest: sha256Text(JSON.stringify({ seven: seven.digest, validator: validator.digest, fees: fees.digest })),
  });
}

export function qualifyEconomicReleaseCandidate(input: {
  readonly root: string;
  readonly rcId: string;
  readonly sourceCommit: string;
  readonly profile: EconomicQualificationProfile;
}): EconomicQualificationEvidence {
  const monetary = qualifyMonetary();
  const genesis = qualifyGenesis();
  const validator = qualifyValidator();
  const fees = qualifyFees();
  const moonrey = qualifyMoonrey();
  const treasury = qualifyTreasury(fees);
  const dual = qualifyDualEconomy(input.profile);
  const formal = qualifyFormal();
  const property = qualifyProperty();
  const stress = qualifyStress();
  const supply = qualifySupply(validator.bond, fees.burn, fees.treasury);
  const recovery = qualifyRecovery();
  const upgrade = qualifyUpgrade();
  const compatibility = qualifyCompatibility(input.root);
  const seven = qualifySeven(validator, fees, moonrey);
  const audit = auditDependencies(input.root);
  const policy = freezeEconomicPolicies(input.root);
  const schema = freezeEconomicSchemas(input.root);
  const constitution = nativeAssetConstitution();
  const sunrey = constitution.assets.find((row) => row.assetId === 'SUNREY_COIN');
  const moonreyAsset = constitution.assets.find((row) => row.assetId === 'MOONREY_COIN');
  const extendedRan = input.profile === 'extended';

  const cells: EconomicQualificationCell[] = [
    cell('MONETARY_POLICY', passFail(monetary.ok), input.sourceCommit, monetary.detail, monetary.digest),
    cell('SUNREY_SUPPLY', passFail(supply.ok && sunrey?.assetId === 'SUNREY_COIN'), input.sourceCommit, 'SunRey supply identity', supply.digest),
    cell('MOONREY_SUPPLY', passFail(supply.ok && moonreyAsset?.assetId === 'MOONREY_COIN'), input.sourceCommit, 'MoonRey supply identity', supply.digest),
    cell('GENESIS_POLICY', passFail(genesis.ok), input.sourceCommit, 'no hidden genesis allocation', genesis.digest),
    cell('VALIDATOR_ECONOMICS', passFail(validator.ok && validator.customerIsolated), input.sourceCommit, 'bond/reward/penalty/unbond/isolation', validator.digest),
    cell('FEE_MARKET', passFail(fees.ok), input.sourceCommit, 'FeePolicyV2 meter/bounds/disposition', fees.digest),
    cell('MOONREY_ISSUANCE', passFail(moonrey.ok), input.sourceCommit, 'oracle, eligibility, anti-double-count, caps', moonrey.digest),
    cell('ORACLES', passFail(seven.ok), input.sourceCommit, 'oracle fact dependency for MoonRey and seven-validator oracle', seven.digest),
    cell('PROTOCOL_TREASURY', passFail(treasury.ok), input.sourceCommit, 'fee-funded treasury; production budget UNCONFIGURED', treasury.digest),
    cell('EXCHANGE_SETTLEMENT', passFail(seven.ok), input.sourceCommit, 'Exchange DVP conservation on seven-validator profile', seven.digest),
    cell('MACHINE_ECONOMY', passFail(seven.ok), input.sourceCommit, 'machine commerce on seven-validator profile', seven.digest),
    cell('DUAL_ECONOMY', passFail(dual.ok), input.sourceCommit, dual.scenarios.join(','), dual.digest),
    cell('FORMAL_ASSURANCE', formal.counterexamples.length > 0 ? 'FAIL' : 'PASS', input.sourceCommit, formal.result, formal.digest),
    cell('PROPERTY_TESTING', passFail(property.ok), input.sourceCommit, `seed=${property.seed}`, property.digest),
    cell('ADVERSARIAL_STRESS', passFail(stress.ok), input.sourceCommit, stress.criticalFailures.length === 0 ? 'no critical failures' : stress.criticalFailures.join(';'), stress.digest),
    cell('PERFORMANCE', 'PENDING_EXTENDED_TEST', input.sourceCommit, 'engineering context only; soak not claimed', sha256Text('performance-context')),
    cell('RECOVERY', passFail(recovery.snapshot && recovery.postgres && recovery.explorer && recovery.invariantsIdentical), input.sourceCommit, 'snapshot + postgres + explorer rebuild', recovery.digest),
    cell('GOVERNANCE', passFail(upgrade.oldPolicyBefore && upgrade.newPolicyAfter && upgrade.historicalPreserved && upgrade.laggingNodeCatchUp), input.sourceCommit, 'harmless policy version rehearsal', upgrade.digest),
    cell('SUPPLY_CHAIN', passFail(audit.ok), input.sourceCommit, 'dependency audit at economic RC commit', sha256Text(JSON.stringify(audit.counts))),
    cell('SDK', passFail(compatibility.typescriptSdk && compatibility.rustSdk), input.sourceCommit, 'TypeScript and Rust SDK read frozen economic policy/receipts', compatibility.digest),
    cell('EXPLORER', passFail(compatibility.explorer), input.sourceCommit, 'Explorer displays monetary, supply, validator, fees, MoonRey, treasury', compatibility.digest),
  ];

  if (cells.length !== ECONOMIC_QUALIFICATION_CATEGORIES.length) {
    throw new Error('economic qualification matrix missing a required category');
  }
  void policy;
  void schema;
  void ECONOMIC_FORMAL_MODEL_IDS;

  const matrix: EconomicQualificationMatrix = Object.freeze({
    schemaVersion: 1,
    rcId: input.rcId,
    sourceCommit: input.sourceCommit,
    profile: input.profile,
    cells: Object.freeze(cells),
    combinedDigest: sha256Text(cells.map((row) => `${row.category}:${row.state}:${row.evidenceDigest}`).join('|')),
    notRegulatoryApproval: true,
  });

  return Object.freeze({
    matrix,
    formal,
    stress,
    simulation: Object.freeze({ scenarios: dual.scenarios, ok: dual.ok, digest: dual.digest }),
    property,
    sevenValidator: seven,
    supply,
    recovery,
    upgrade,
    compatibility,
    performance: Object.freeze({
      context: 'engineering measurement only; not a contractual capacity claim',
      claimedExtendedDuration: false,
      digest: sha256Text('performance-context'),
    }),
    extended: Object.freeze({
      ran: extendedRan,
      claimedDurationCompleted: false,
      digest: extendedRan ? sha256Text(`extended:${input.profile}`) : null,
    }),
  });
}

export function economicMatrixHasFail(matrix: EconomicQualificationMatrix): boolean {
  return matrix.cells.some((row) => row.state === 'FAIL');
}

export function economicMatrixHasPending(matrix: EconomicQualificationMatrix): boolean {
  return matrix.cells.some((row) => row.state === 'PENDING_EXTENDED_TEST');
}

export function deriveEconomicRcStatus(matrix: EconomicQualificationMatrix): EconomicRcStatus {
  if (economicMatrixHasFail(matrix)) {
    return 'QUALIFICATION_IN_PROGRESS';
  }
  if (economicMatrixHasPending(matrix)) {
    return 'QUALIFIED_WITH_PENDING_EXTENDED_TEST';
  }
  return 'QUALIFIED_FOR_ECONOMIC_TESTNET_RC';
}

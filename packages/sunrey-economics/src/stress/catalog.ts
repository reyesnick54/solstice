/**
 * Deterministic economic stress scenario catalog.
 *
 * Stable IDs. Grouped by domain. At least 60 scenarios.
 */

import { ECONOMIC_STRESS_SCHEMA_VERSION, type FailureClass, type ShockKind, type StressDomain } from './ids.ts';
import type { EconomicStressCampaign, EconomicStressScenario } from './types.ts';

function scenario(
  scenarioId: string,
  domain: StressDomain,
  title: string,
  seed: number,
  shocks: readonly ShockKind[],
  expectedFailureClass: FailureClass | null,
  notes: string,
  epochs = 2,
  recoverable = true,
): EconomicStressScenario {
  return Object.freeze({
    schemaVersion: ECONOMIC_STRESS_SCHEMA_VERSION,
    scenarioId,
    domain,
    title,
    seed,
    epochs,
    shocks,
    recoverable,
    expectedFailureClass,
    notes,
  });
}

export const ECONOMIC_STRESS_CATALOG: readonly EconomicStressScenario[] = Object.freeze([
  scenario('ECON-LIQ-001', 'LIQUIDITY', 'thin SunRey/MoonRey order book', 7601, ['LIQUIDITY_THIN_BOOK'], 'LIQUIDITY_STRESS', 'Measure market impact on a thin synthetic book'),
  scenario('ECON-LIQ-002', 'LIQUIDITY', 'large synthetic market order', 7602, ['LIQUIDITY_LARGE_ORDER'], 'LIQUIDITY_STRESS', 'Large synthetic market order; no external market'),
  scenario('ECON-LIQ-003', 'LIQUIDITY', 'rapid spread widening', 7603, ['LIQUIDITY_SPREAD_WIDEN'], 'LIQUIDITY_STRESS', 'Synthetic spread widening'),
  scenario('ECON-LIQ-004', 'LIQUIDITY', 'one-sided liquidity', 7604, ['LIQUIDITY_ONE_SIDED'], 'LIQUIDITY_STRESS', 'Bids or asks only'),
  scenario('ECON-LIQ-005', 'LIQUIDITY', 'market maker simulation unavailable', 7605, ['LIQUIDITY_MM_UNAVAILABLE'], 'AVAILABILITY_DEGRADATION', 'Maker inventory withdrawn'),
  scenario('ECON-LIQ-006', 'LIQUIDITY', 'sudden volume surge', 7606, ['LIQUIDITY_VOLUME_SURGE'], 'LIQUIDITY_STRESS', 'Synthetic volume surge'),
  scenario('ECON-PROD-001', 'PRODUCTIVE', 'rapid MoonRey issuance pressure', 7611, ['PROD_ISSUANCE_PRESSURE'], null, 'Issuance pressure against epoch caps'),
  scenario('ECON-PROD-002', 'PRODUCTIVE', 'energy collapse', 7612, ['PROD_ENERGY_COLLAPSE'], 'EXPECTED_FAIL_CLOSED_BEHAVIOR', 'Energy availability collapse'),
  scenario('ECON-PROD-003', 'PRODUCTIVE', 'compute abundance', 7613, ['PROD_COMPUTE_ABUNDANCE'], null, 'Compute abundance does not mint extra classes'),
  scenario('ECON-PROD-004', 'PRODUCTIVE', 'compute shortage', 7614, ['PROD_COMPUTE_SHORTAGE'], 'EXPECTED_FAIL_CLOSED_BEHAVIOR', 'Compute shortage reduces eligible output'),
  scenario('ECON-PROD-005', 'PRODUCTIVE', 'manufacturing collapse', 7615, ['PROD_MANUFACTURING_COLLAPSE'], 'EXPECTED_FAIL_CLOSED_BEHAVIOR', 'Manufacturing collapse'),
  scenario('ECON-PROD-006', 'PRODUCTIVE', 'logistics shortage', 7616, ['PROD_LOGISTICS_SHORTAGE'], 'EXPECTED_FAIL_CLOSED_BEHAVIOR', 'Logistics shortage'),
  scenario('ECON-PROD-007', 'PRODUCTIVE', 'AI-output surge', 7617, ['PROD_AI_SURGE'], null, 'AI output surge stays inside productive policy'),
  scenario('ECON-PROD-008', 'PRODUCTIVE', 'robot-output surge', 7618, ['PROD_ROBOT_SURGE'], null, 'Robot output surge stays inside productive policy'),
  scenario('ECON-PROD-009', 'PRODUCTIVE', 'productive operator concentration', 7619, ['PROD_OPERATOR_CONCENTRATION'], 'CONCENTRATION_RISK', 'One operator dominates productive objects'),
  scenario('ECON-ORACLE-001', 'ORACLE', 'provider outage', 7621, ['ORACLE_OUTAGE'], 'EXPECTED_FAIL_CLOSED_BEHAVIOR', 'MoonRey fail-closed on outage'),
  scenario('ECON-ORACLE-002', 'ORACLE', 'provider staleness', 7622, ['ORACLE_STALE'], 'EXPECTED_FAIL_CLOSED_BEHAVIOR', 'Stale facts cannot mint'),
  scenario('ECON-ORACLE-003', 'ORACLE', 'conflicting providers', 7623, ['ORACLE_CONFLICT'], 'EXPECTED_FAIL_CLOSED_BEHAVIOR', 'Conflicted facts cannot mint'),
  scenario('ECON-ORACLE-004', 'ORACLE', 'one-controller concentration', 7624, ['ORACLE_ONE_CONTROLLER'], 'CONCENTRATION_RISK', 'Single controller concentration'),
  scenario('ECON-ORACLE-005', 'ORACLE', 'unit mismatch', 7625, ['ORACLE_UNIT_MISMATCH'], 'EXPECTED_FAIL_CLOSED_BEHAVIOR', 'Unit mismatch fail-closed'),
  scenario('ECON-ORACLE-006', 'ORACLE', 'delayed observations', 7626, ['ORACLE_DELAYED'], 'EXPECTED_FAIL_CLOSED_BEHAVIOR', 'Delayed observations treated stale'),
  scenario('ECON-ORACLE-007', 'ORACLE', 'category reference fact unavailable', 7627, ['ORACLE_REFERENCE_UNAVAILABLE'], 'EXPECTED_FAIL_CLOSED_BEHAVIOR', 'Missing reference fact'),
  scenario('ECON-DUP-001', 'DOUBLE_COUNT', 'same contribution replay', 7631, ['DUP_REPLAY'], 'EXPECTED_FAIL_CLOSED_BEHAVIOR', 'Replay of the same contribution'),
  scenario('ECON-DUP-002', 'DOUBLE_COUNT', 'capacity/output duplication', 7632, ['DUP_CAPACITY_OUTPUT'], 'EXPECTED_FAIL_CLOSED_BEHAVIOR', 'Capacity plus output double count'),
  scenario('ECON-DUP-003', 'DOUBLE_COUNT', 'delivery/output duplication', 7633, ['DUP_DELIVERY_OUTPUT'], 'EXPECTED_FAIL_CLOSED_BEHAVIOR', 'Delivery plus output double count'),
  scenario('ECON-DUP-004', 'DOUBLE_COUNT', 'cross-category duplication', 7634, ['DUP_CROSS_CATEGORY'], 'EXPECTED_FAIL_CLOSED_BEHAVIOR', 'Same quantity claimed in two categories'),
  scenario('ECON-DUP-005', 'DOUBLE_COUNT', 'claim-lineage mutation', 7635, ['DUP_LINEAGE_MUTATION'], 'EXPECTED_FAIL_CLOSED_BEHAVIOR', 'Mutated lineage cannot mint twice'),
  scenario('ECON-DUP-006', 'DOUBLE_COUNT', 'reordered contribution evidence', 7636, ['DUP_REORDERED_EVIDENCE'], 'EXPECTED_FAIL_CLOSED_BEHAVIOR', 'Reordered evidence is the same fingerprint'),
  scenario('ECON-DUP-007', 'DOUBLE_COUNT', 'epoch-boundary duplicate', 7637, ['DUP_EPOCH_BOUNDARY'], 'EXPECTED_FAIL_CLOSED_BEHAVIOR', 'Duplicate across epoch boundary'),
  scenario('ECON-FEE-001', 'FEE', 'sustained block saturation', 7641, ['FEE_SATURATION'], 'AVAILABILITY_DEGRADATION', 'Sustained saturation under FeePolicyV2'),
  scenario('ECON-FEE-002', 'FEE', 'sudden transaction burst', 7642, ['FEE_BURST'], 'AVAILABILITY_DEGRADATION', 'Burst admission under limits'),
  scenario('ECON-FEE-003', 'FEE', 'high PQ-signature mix', 7643, ['FEE_PQ_MIX'], null, 'PQ mix uses v2 weights'),
  scenario('ECON-FEE-004', 'FEE', 'interop-proof heavy blocks', 7644, ['FEE_INTEROP_HEAVY'], null, 'Interop-proof heavy usage'),
  scenario('ECON-FEE-005', 'FEE', 'oracle-heavy blocks', 7645, ['FEE_ORACLE_HEAVY'], null, 'Oracle-heavy usage'),
  scenario('ECON-FEE-006', 'FEE', 'Exchange-heavy blocks', 7646, ['FEE_EXCHANGE_HEAVY'], null, 'Exchange DVP legs'),
  scenario('ECON-FEE-007', 'FEE', 'priority-fee competition', 7647, ['FEE_PRIORITY'], null, 'Priority fee competition'),
  scenario('ECON-FEE-008', 'FEE', 'maximum-fee boundaries', 7648, ['FEE_MAX_BOUNDARY'], 'EXPECTED_FAIL_CLOSED_BEHAVIOR', 'max_fee boundary'),
  scenario('ECON-VAL-001', 'VALIDATOR', 'low fee revenue', 7651, ['VAL_LOW_FEE'], null, 'Low fee revenue still reconciles'),
  scenario('ECON-VAL-002', 'VALIDATOR', 'high fee revenue', 7652, ['VAL_HIGH_FEE'], null, 'High fee revenue uses one reward pool'),
  scenario('ECON-VAL-003', 'VALIDATOR', 'one validator jailed', 7653, ['VAL_JAIL'], null, 'Jail does not debit customers'),
  scenario('ECON-VAL-004', 'VALIDATOR', 'one validator economically penalized', 7654, ['VAL_PENALTY'], null, 'Penalty requires protocol evidence'),
  scenario('ECON-VAL-005', 'VALIDATOR', 'high bond concentration', 7655, ['VAL_BOND_CONCENTRATION'], 'CONCENTRATION_RISK', 'Bond concentration warning'),
  scenario('ECON-VAL-006', 'VALIDATOR', 'validator exit', 7656, ['VAL_EXIT'], 'AVAILABILITY_DEGRADATION', 'Validator exit after unbond delay'),
  scenario('ECON-VAL-007', 'VALIDATOR', 'unbond pressure', 7657, ['VAL_UNBOND'], 'AVAILABILITY_DEGRADATION', 'Unbond pressure honors delay'),
  scenario('ECON-VAL-008', 'VALIDATOR', 'reward-pool depletion simulation', 7658, ['VAL_REWARD_DEPLETION'], null, 'Depleted pool does not mint rewards'),
  scenario('ECON-HUM-001', 'HUMAN', 'large fall in human demand', 7661, ['HUM_DEMAND_FALL'], null, 'Synthetic demand fall; no person-level data'),
  scenario('ECON-HUM-002', 'HUMAN', 'large increase in human demand', 7662, ['HUM_DEMAND_RISE'], null, 'Synthetic demand rise'),
  scenario('ECON-HUM-003', 'HUMAN', 'rapid participant growth', 7663, ['HUM_PARTICIPANT_GROWTH'], null, 'Synthetic participant growth'),
  scenario('ECON-HUM-004', 'HUMAN', 'human-information-right activity collapse', 7664, ['HUM_INFO_RIGHT_COLLAPSE'], null, 'Information-right activity collapse'),
  scenario('ECON-HUM-005', 'HUMAN', 'high community distribution activity', 7665, ['HUM_COMMUNITY_DISTRIBUTION'], null, 'Community distribution activity'),
  scenario('ECON-AUTO-001', 'AUTOMATION', 'rapid automation shock', 7671, ['AUTO_SHOCK'], null, 'AI/robots/compute up; labor dependence down'),
  scenario('ECON-MACH-001', 'MACHINE', 'machine spending burst', 7681, ['MACH_SPEND_BURST'], null, 'Mandate-bound spending burst'),
  scenario('ECON-MACH-002', 'MACHINE', 'machine mandate exhaustion', 7682, ['MACH_MANDATE_EXHAUSTION'], 'EXPECTED_FAIL_CLOSED_BEHAVIOR', 'Exhausted mandate cannot spend'),
  scenario('ECON-MACH-003', 'MACHINE', 'robot energy demand spike', 7683, ['MACH_ROBOT_ENERGY'], null, 'Robot energy demand spike'),
  scenario('ECON-MACH-004', 'MACHINE', 'AI compute-buying surge', 7684, ['MACH_AI_COMPUTE'], null, 'AI compute-buying surge'),
  scenario('ECON-MACH-005', 'MACHINE', 'machine operator concentration', 7685, ['MACH_OPERATOR_CONCENTRATION'], 'CONCENTRATION_RISK', 'Machine operator concentration'),
  scenario('ECON-MACH-006', 'MACHINE', 'failed delivery', 7686, ['MACH_FAILED_DELIVERY'], 'EXPECTED_FAIL_CLOSED_BEHAVIOR', 'Failed delivery does not settle'),
  scenario('ECON-MACH-007', 'MACHINE', 'escrow backlog', 7687, ['MACH_ESCROW_BACKLOG'], 'AVAILABILITY_DEGRADATION', 'Escrow backlog remains locked'),
  scenario('ECON-EXCH-001', 'EXCHANGE', 'large synthetic SunRey/MoonRey price move', 7691, ['EXCH_PRICE_MOVE'], 'LIQUIDITY_STRESS', 'Synthetic price move; DVP atomic'),
  scenario('ECON-EXCH-002', 'EXCHANGE', 'order cancellation surge', 7692, ['EXCH_CANCEL_SURGE'], 'AVAILABILITY_DEGRADATION', 'Cancel surge conserves assets'),
  scenario('ECON-EXCH-003', 'EXCHANGE', 'partial fill backlog', 7693, ['EXCH_PARTIAL_FILL'], 'AVAILABILITY_DEGRADATION', 'Partial fills remain reserved'),
  scenario('ECON-EXCH-004', 'EXCHANGE', 'settlement congestion', 7694, ['EXCH_SETTLEMENT_CONGESTION'], 'AVAILABILITY_DEGRADATION', 'Congestion does not duplicate DVP'),
  scenario('ECON-EXCH-005', 'EXCHANGE', 'custody delay', 7695, ['EXCH_CUSTODY_DELAY'], 'AVAILABILITY_DEGRADATION', 'Custody delay keeps DVP atomic'),
  scenario('ECON-EXCH-006', 'EXCHANGE', 'Exchange settlement submission ambiguity', 7696, ['EXCH_SUBMISSION_AMBIGUITY'], 'EXPECTED_FAIL_CLOSED_BEHAVIOR', 'Ambiguous submission is not duplicated'),
  scenario('ECON-CUST-001', 'CUSTODY', 'withdrawal queue surge', 7701, ['CUST_WITHDRAWAL_SURGE'], 'AVAILABILITY_DEGRADATION', 'Queue surge; no blind resubmit'),
  scenario('ECON-CUST-002', 'CUSTODY', 'signer temporarily unavailable', 7702, ['CUST_SIGNER_UNAVAILABLE'], 'AVAILABILITY_DEGRADATION', 'Signer unavailable holds withdrawals'),
  scenario('ECON-CUST-003', 'CUSTODY', 'SUBMISSION_UNKNOWN', 7703, ['CUST_SUBMISSION_UNKNOWN'], 'EXPECTED_FAIL_CLOSED_BEHAVIOR', 'Unknown submission is not retried blindly'),
  scenario('ECON-CUST-004', 'CUSTODY', 'reconciliation lag', 7704, ['CUST_RECONCILIATION_LAG'], 'AVAILABILITY_DEGRADATION', 'Lag does not invent balances'),
  scenario('ECON-CUST-005', 'CUSTODY', 'one vault restricted', 7705, ['CUST_VAULT_RESTRICTED'], 'AVAILABILITY_DEGRADATION', 'Restricted vault cannot withdraw'),
  scenario('ECON-COMP-001', 'COMPOUND', 'energy scarcity + compute shortage + MoonRey liquidity shock', 7711, ['COMPOUND_ENERGY_COMPUTE_LIQUIDITY'], 'LIQUIDITY_STRESS', 'Compound productive and liquidity stress', 3),
  scenario('ECON-COMP-002', 'COMPOUND', 'oracle outage + Exchange volatility + validator unavailability', 7712, ['COMPOUND_ORACLE_EXCHANGE_VALIDATOR'], 'AVAILABILITY_DEGRADATION', 'Compound oracle, exchange, validator stress', 3),
  scenario('ECON-COMP-003', 'COMPOUND', 'fee congestion + custody backlog + machine commerce surge', 7713, ['COMPOUND_FEE_CUSTODY_MACHINE'], 'AVAILABILITY_DEGRADATION', 'Compound fee, custody, machine stress', 3),
  scenario('ECON-COMP-147-001', 'COMPOUND', 'human contribution burst + productive output surge', 14701, ['HUM_COMMUNITY_DISTRIBUTION', 'PROD_ISSUANCE_PRESSURE'], null, 'Chunk 147 combined human burst and productive surge; accounting must hold', 2),
  scenario('ECON-COMP-147-002', 'COMPOUND', 'oracle outage + MoonRey demand shock', 14702, ['ORACLE_OUTAGE', 'HUM_DEMAND_RISE'], 'EXPECTED_FAIL_CLOSED_BEHAVIOR', 'Chunk 147 oracle outage under MoonRey demand; no invented output', 2),
  scenario('ECON-COMP-147-003', 'COMPOUND', 'exchange price volatility + high issuance volume', 14703, ['EXCH_PRICE_MOVE', 'PROD_ISSUANCE_PRESSURE'], 'LIQUIDITY_STRESS', 'Chunk 147 exchange volatility does not alter issuance conversion', 2),
  scenario('ECON-COMP-147-004', 'COMPOUND', 'provider concentration + controller concentration', 14704, ['ORACLE_ONE_CONTROLLER', 'PROD_OPERATOR_CONCENTRATION'], 'CONCENTRATION_RISK', 'Chunk 147 concentration reported; no antitrust conclusion', 2),
  scenario('ECON-COMP-147-005', 'COMPOUND', 'network congestion + settlement backlog', 14705, ['EXCH_SETTLEMENT_CONGESTION', 'FEE_SATURATION'], 'AVAILABILITY_DEGRADATION', 'Chunk 147 congestion does not duplicate DVP', 2),
  scenario('ECON-COMP-147-006', 'COMPOUND', 'policy upgrade + reconciliation delay', 14706, ['CUST_RECONCILIATION_LAG', 'FEE_BURST'], 'AVAILABILITY_DEGRADATION', 'Chunk 147 upgrade does not silently recompute historical supply', 2),
  scenario('ECON-NQ-001', 'NO_QUORUM', 'no-quorum economic freeze', 7721, ['NO_QUORUM_FREEZE'], 'AVAILABILITY_DEGRADATION', 'No synthetic accounting without finality', 1, true),
  scenario('ECON-ACC-001', 'ACCESS', 'access abundance under autonomous production', 7731, ['ACCESS_ABUNDANCE'], null, 'ACCESS-13: scarcity falls and access expands only as policy allows', 1),
  scenario('ECON-ACC-002', 'ACCESS', 'access demand surge on one scarce experience', 7732, ['ACCESS_DEMAND_SURGE'], null, 'ACCESS-13: deterministic allocation; published capacity is not oversold', 1),
  scenario('ECON-ACC-003', 'ACCESS', 'access under a productive capacity shock', 7733, ['ACCESS_PRODUCTIVE_SHOCK'], null, 'ACCESS-13: quotes contract with real capacity; confirmed rights stay honoured', 1),
  scenario('ECON-ACC-004', 'ACCESS', 'access geographic scarcity inside a global surplus', 7734, ['ACCESS_GEOGRAPHIC_SCARCITY'], 'CONCENTRATION_RISK', 'ACCESS-13: surplus elsewhere does not satisfy a location-bound request', 1),
  scenario('ECON-ACC-005', 'ACCESS', 'access temporal scarcity on a peak date', 7735, ['ACCESS_TEMPORAL_SCARCITY'], 'CONCENTRATION_RISK', 'ACCESS-13: a peak date is scarce while surrounding dates stay abundant', 1),
  scenario('ECON-ACC-006', 'ACCESS', 'access provider failure', 7736, ['ACCESS_PROVIDER_FAILURE'], 'AVAILABILITY_DEGRADATION', 'ACCESS-13: a failed provider refuses rather than reassigning silently', 1),
  scenario('ECON-ACC-007', 'ACCESS', 'access under stale capacity evidence', 7737, ['ACCESS_ORACLE_STALE'], 'EXPECTED_FAIL_CLOSED_BEHAVIOR', 'ACCESS-13: stale evidence fails closed; capacity is not assumed', 1),
  scenario('ECON-ACC-008', 'ACCESS', 'access while the Exchange is unavailable', 7738, ['ACCESS_EXCHANGE_UNAVAILABLE'], 'EXPECTED_FAIL_CLOSED_BEHAVIOR', 'ACCESS-13: no fallback price, no invented conversion, no peg', 1),
  scenario('ECON-ACC-009', 'ACCESS', 'access ledger and custody settlement failure', 7739, ['ACCESS_SETTLEMENT_FAILURE'], 'AVAILABILITY_DEGRADATION', 'ACCESS-13: failed settlement releases its reservation', 1),
  scenario('ECON-ACC-010', 'ACCESS', 'access policy change during reservation', 7740, ['ACCESS_POLICY_CHANGE'], null, 'ACCESS-13: confirmed rights honoured; later reservations held for review', 1),
  scenario('ECON-ACC-011', 'ACCESS', 'mass concurrent access reservations', 7741, ['ACCESS_MASS_CONCURRENCY'], null, 'ACCESS-13: concurrency stress does not oversell a single unit', 1),
  scenario('ECON-ACC-012', 'ACCESS', 'abundant mass-market vehicle class access', 7742, ['ACCESS_ABUNDANT_VEHICLE'], null, 'ACCESS-13: abundance still requires authority and eligibility', 1),
  scenario('ECON-ACC-013', 'ACCESS', 'premium scarce vehicle class access', 7743, ['ACCESS_PREMIUM_SCARCE_VEHICLE'], null, 'ACCESS-13: genuine scarcity refuses; it is not priced into a new unit', 1),
  scenario('ECON-ACC-014', 'ACCESS', 'composite multi-leg travel experience', 7744, ['ACCESS_COMPOSITE_TRAVEL'], null, 'ACCESS-13: each leg is a separate bucket and can refuse independently', 1),
  scenario('ECON-ACC-015', 'ACCESS', 'recurring household food and water access', 7745, ['ACCESS_HOUSEHOLD_FOOD'], null, 'ACCESS-13: essential recurring access never becomes a transferable balance', 1),
]);

export const ACCESS_STRESS_IDS: readonly string[] = Object.freeze(
  ECONOMIC_STRESS_CATALOG.filter((row) => row.domain === 'ACCESS').map((row) => row.scenarioId),
);

export function scenarioById(scenarioId: string): EconomicStressScenario | undefined {
  return ECONOMIC_STRESS_CATALOG.find((row) => row.scenarioId === scenarioId);
}

export function catalogScenarioIds(): readonly string[] {
  return ECONOMIC_STRESS_CATALOG.map((row) => row.scenarioId);
}

export function requiredCatalogComplete(): boolean {
  return ECONOMIC_STRESS_CATALOG.length >= 60 && new Set(catalogScenarioIds()).size === ECONOMIC_STRESS_CATALOG.length;
}

export const STRESS_CAMPAIGNS: readonly EconomicStressCampaign[] = Object.freeze([
  {
    campaignId: 'smoke',
    title: 'Economic stress smoke',
    scenarioIds: Object.freeze([
      'ECON-LIQ-001',
      'ECON-PROD-001',
      'ECON-ORACLE-002',
      'ECON-DUP-001',
      'ECON-FEE-001',
      'ECON-VAL-004',
      'ECON-EXCH-001',
      'ECON-CUST-003',
      'ECON-COMP-001',
      'ECON-NQ-001',
      'ECON-ACC-002',
    ]),
    epochs: 2,
    extendedWorkflow: false,
  },
  {
    campaignId: 'critical-invariants',
    title: 'Critical invariant campaign',
    scenarioIds: catalogScenarioIds(),
    epochs: 2,
    extendedWorkflow: false,
  },
  {
    campaignId: 'compound',
    title: 'Compound scenario campaign',
    scenarioIds: Object.freeze(['ECON-COMP-001', 'ECON-COMP-002', 'ECON-COMP-003']),
    epochs: 3,
    extendedWorkflow: false,
  },
  {
    campaignId: 'extended-12',
    title: '12-epoch extended campaign',
    scenarioIds: Object.freeze(['ECON-COMP-001', 'ECON-AUTO-001', 'ECON-FEE-001']),
    epochs: 12,
    extendedWorkflow: true,
  },
  {
    campaignId: 'extended-120',
    title: '120-epoch extended campaign',
    scenarioIds: Object.freeze(['ECON-COMP-001']),
    epochs: 120,
    extendedWorkflow: true,
  },
  {
    campaignId: 'extended-600',
    title: '600-epoch extended campaign',
    scenarioIds: Object.freeze(['ECON-COMP-001']),
    epochs: 600,
    extendedWorkflow: true,
  },
  {
    campaignId: 'parameterized-dual-economy-rehearsal',
    title: 'Chunk 147 parameterized dual-economy rehearsal stress',
    scenarioIds: Object.freeze([
      'ECON-COMP-147-001',
      'ECON-COMP-147-002',
      'ECON-COMP-147-003',
      'ECON-COMP-147-004',
      'ECON-COMP-147-005',
      'ECON-COMP-147-006',
    ]),
    epochs: 2,
    extendedWorkflow: false,
  },
  {
    campaignId: 'access-economy',
    title: 'ACCESS-13 Access Economy campaign',
    scenarioIds: ACCESS_STRESS_IDS,
    epochs: 1,
    extendedWorkflow: false,
  },
]);

export function campaignById(campaignId: string): EconomicStressCampaign | undefined {
  return STRESS_CAMPAIGNS.find((row) => row.campaignId === campaignId);
}

import type { AttackResult, SecurityScorecard } from './types.ts';

export const ENGINEERING_TEST_SCORECARD_NOTES = [
  'This is an engineering test scorecard, not a marketing-grade security rating.',
  'Detector output is not legal guilt.',
  'Live internet scanning, production banks, and mainnet are OUT_OF_SCOPE.',
  'Sybil resistance is not claimed where provider identity metadata is absent.',
] as const;

export function buildScorecard(results: readonly AttackResult[]): SecurityScorecard {
  const bySubsystem = new Map<string, AttackResult[]>();
  for (const result of results) {
    const prefix = result.scenarioId.split('-')[0] ?? 'OTHER';
    const list = bySubsystem.get(prefix) ?? [];
    list.push(result);
    bySubsystem.set(prefix, list);
  }
  const categories: Record<string, SecurityScorecard['categories'][string]> = {
    BFT_ADVERSARY: statusFor(bySubsystem.get('BFT') ?? []),
    NETWORK_AND_ECLIPSE: statusFor(bySubsystem.get('NET') ?? []),
    SIGNER_SAFETY: statusFor(bySubsystem.get('SIGNER') ?? []),
    WALLET_AND_MULTISIG: statusFor([...(bySubsystem.get('WALLET') ?? []), ...(bySubsystem.get('MULTISIG') ?? [])]),
    ORACLE: statusFor(bySubsystem.get('ORACLE') ?? []),
    MOONREY_AND_GRAPH: statusFor([...(bySubsystem.get('MOONREY') ?? []), ...(bySubsystem.get('GRAPH') ?? [])]),
    MACHINE_COMMERCE: statusFor(bySubsystem.get('MACHINE') ?? []),
    EXCHANGE: statusFor(bySubsystem.get('EXCH') ?? []),
    PRIVACY_AND_EXPLORER: statusFor([...(bySubsystem.get('INFO') ?? []), ...(bySubsystem.get('EXPLORER') ?? [])]),
    CUSTODY: statusFor(bySubsystem.get('CUSTODY') ?? []),
    GOVERNANCE_AND_UPGRADE: statusFor([...(bySubsystem.get('GOV') ?? []), ...(bySubsystem.get('UPGRADE') ?? [])]),
    INTEROP_AND_BRIDGE: statusFor([...(bySubsystem.get('INTEROP') ?? []), ...(bySubsystem.get('BRIDGE') ?? [])]),
    API: statusFor(bySubsystem.get('API') ?? []),
    COMPOUND_FAILURE: statusFor([...(bySubsystem.get('COMPOUND') ?? []), ...(bySubsystem.get('COMPSAFE') ?? [])]),
    CREDENTIAL_PLANE: statusFor(bySubsystem.get('CRED') ?? []),
    ENDPOINT_SSRF: statusFor(bySubsystem.get('ENDPOINT') ?? []),
    ORACLE_ADVERSARIAL: statusFor(bySubsystem.get('ORADV') ?? []),
    PRODUCTIVE_ECONOMY: statusFor(bySubsystem.get('PRODATT') ?? []),
    HUMAN_ECONOMY: statusFor(bySubsystem.get('HUMAN') ?? []),
    PAYMENTS: statusFor(bySubsystem.get('PAY') ?? []),
    COMPLIANCE: statusFor(bySubsystem.get('COMPLY') ?? []),
    TRAVEL_RULE: statusFor(bySubsystem.get('TRAVEL') ?? []),
    CUSTODY_DUAL_ASSET: statusFor(bySubsystem.get('CUSTADV') ?? []),
    PERSISTENCE: statusFor(bySubsystem.get('PERSIST') ?? []),
    EVENT_FABRIC: statusFor(bySubsystem.get('EVENT') ?? []),
    DISTRIBUTED_IDEMPOTENCY: statusFor(bySubsystem.get('IDEM') ?? []),
    ECONOMIC_CONSTITUTION: statusFor(bySubsystem.get('CONST') ?? []),
    AI_AUTHORITY: statusFor(bySubsystem.get('AIAUTH') ?? []),
    OBSERVABILITY: statusFor(bySubsystem.get('OBS') ?? []),
    CONTROL_ROOM: statusFor(bySubsystem.get('CTRL') ?? []),
    LIVE_INTERNET_SCANNING: 'OUT_OF_SCOPE',
    PRODUCTION_BANKS: 'OUT_OF_SCOPE',
    LEGAL_GUILT_LABELING: 'OUT_OF_SCOPE',
    MAINNET: 'OUT_OF_SCOPE',
  };
  return {
    label: 'ENGINEERING_TEST_SCORECARD',
    notAMarketingRating: true,
    categories,
    notes: ENGINEERING_TEST_SCORECARD_NOTES,
  };
}

function statusFor(results: readonly AttackResult[]): 'TESTED' | 'PARTIAL' | 'NOT_TESTED' {
  if (results.length === 0) {
    return 'NOT_TESTED';
  }
  if (results.every((row) => row.passed)) {
    return 'TESTED';
  }
  return 'PARTIAL';
}

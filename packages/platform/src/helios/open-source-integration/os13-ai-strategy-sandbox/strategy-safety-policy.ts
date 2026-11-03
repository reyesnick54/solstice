import {
  FORBIDDEN_STRATEGY_CODE,
  STRATEGY_RESOURCE_LIMITS,
} from '@solstice/strategy-lab';
import { PROHIBITED_GENOME_NODE_OPS } from './taxonomy.ts';

export const STRATEGY_SAFETY_POLICY_VERSION = 'helios-os13-safety-v1' as const;

export type StrategySafetyPolicy = {
  readonly version: typeof STRATEGY_SAFETY_POLICY_VERSION;
  readonly arbitraryShellForbidden: true;
  readonly networkAccessForbidden: true;
  readonly javascriptEvalForbidden: true;
  readonly directProviderCallsForbidden: true;
  readonly directBrokerCallsForbidden: true;
  readonly walletAccessForbidden: true;
  readonly riskLimitChangesForbidden: true;
  readonly leverageBeyondPolicyForbidden: true;
  readonly infiniteLoopsForbidden: true;
  readonly unboundedResourceUsageForbidden: true;
  readonly maximumRules: number;
  readonly maximumInstruments: number;
  readonly maximumParameterCombinations: number;
  readonly maximumRuntimeMs: number;
  readonly deployFromSandboxForbidden: true;
  readonly promoteOnMaxBacktestReturnOnlyForbidden: true;
  readonly requiredEvaluationPartitions: readonly ('TRAIN' | 'VALIDATION' | 'OUT_OF_SAMPLE_TEST')[];
  readonly walkForwardRequired: true;
  readonly explicitCostsRequired: true;
  readonly coverageReportRequired: true;
  readonly regimeBreakdownRequired: true;
};

export const DEFAULT_STRATEGY_SAFETY_POLICY: StrategySafetyPolicy = Object.freeze({
  version: STRATEGY_SAFETY_POLICY_VERSION,
  arbitraryShellForbidden: true,
  networkAccessForbidden: true,
  javascriptEvalForbidden: true,
  directProviderCallsForbidden: true,
  directBrokerCallsForbidden: true,
  walletAccessForbidden: true,
  riskLimitChangesForbidden: true,
  leverageBeyondPolicyForbidden: true,
  infiniteLoopsForbidden: true,
  unboundedResourceUsageForbidden: true,
  maximumRules: STRATEGY_RESOURCE_LIMITS.maximumRules,
  maximumInstruments: STRATEGY_RESOURCE_LIMITS.maximumInstruments,
  maximumParameterCombinations: STRATEGY_RESOURCE_LIMITS.maximumParameterCombinations,
  maximumRuntimeMs: STRATEGY_RESOURCE_LIMITS.maximumRuntimeMs,
  deployFromSandboxForbidden: true,
  promoteOnMaxBacktestReturnOnlyForbidden: true,
  requiredEvaluationPartitions: Object.freeze(['TRAIN', 'VALIDATION', 'OUT_OF_SAMPLE_TEST']),
  walkForwardRequired: true,
  explicitCostsRequired: true,
  coverageReportRequired: true,
  regimeBreakdownRequired: true,
});

export const SAFETY_FORBIDDEN_TOKENS = Object.freeze([
  ...FORBIDDEN_STRATEGY_CODE,
  'child_process',
  'exec(',
  'spawn(',
  'WebSocket',
  'XMLHttpRequest',
  'ledger.post',
  'account.open',
  'execution.authority',
  'wallet',
  'broker.placeOrder',
  'while(true)',
] as const);

export function collectSafetyViolations(material: unknown): readonly string[] {
  const violations: string[] = [];
  const scan = (value: unknown): void => {
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      for (const token of SAFETY_FORBIDDEN_TOKENS) {
        if (lower.includes(token.toLowerCase())) {
          violations.push(`forbidden_token:${token}`);
        }
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        scan(item);
      }
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        if ((PROHIBITED_GENOME_NODE_OPS as readonly string[]).includes(key)) {
          violations.push(`prohibited_node_key:${key}`);
        }
        if (item && typeof item === 'object' && 'op' in item) {
          const op = String((item as { op: unknown }).op);
          if ((PROHIBITED_GENOME_NODE_OPS as readonly string[]).includes(op)) {
            violations.push(`prohibited_node_op:${op}`);
          }
        }
        scan(item);
      }
    }
  };
  scan(material);
  return Object.freeze([...new Set(violations)]);
}

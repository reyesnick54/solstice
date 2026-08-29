import type { PolicyCheckContext, PolicyDecision } from './types.ts';

/**
 * ACCESS-06: policy checks at discovery, quote, hold, confirm, and activation.
 * Policy may only get stricter over time; a stale policy version invalidates holds.
 */
export type AccessPolicyPort = {
  check(context: PolicyCheckContext): PolicyDecision;
  currentVersion(): string;
};

export class PermissiveSimulationPolicy implements AccessPolicyPort {
  private version: string;

  constructor(version = 'access-policy-sim-v1') {
    this.version = version;
  }

  currentVersion(): string {
    return this.version;
  }

  setVersion(version: string): void {
    this.version = version;
  }

  check(context: PolicyCheckContext): PolicyDecision {
    if (context.requestedUnits <= 0) {
      return { outcome: 'DENY', code: 'INVALID_UNITS', message: 'requested units must be positive' };
    }
    if (context.policyVersion !== this.version) {
      return { outcome: 'DENY', code: 'POLICY_STALE', message: 'policy version no longer valid' };
    }
    return { outcome: 'ALLOW', policyVersion: this.version, reason: `${context.stage} permitted` };
  }
}

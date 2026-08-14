import { ComplianceKernel } from '@solstice/compliance-kernel';
import { EvidenceVault } from '@solstice/evidence-vault';
import { CAPABILITIES } from '@solstice/flags';
import {
  AuthorityIssuer,
  systemClock,
  type Clock,
} from '@solstice/permissions';

import { AccountsService } from './open-account.ts';

const SIMULATION_AUTHORITY_SECRET = 'solstice-simulation-ea-hmac-v1';

export interface AccountsRuntime {
  readonly capabilities: typeof CAPABILITIES;
  readonly kernel: ComplianceKernel;
  readonly accounts: AccountsService;
  readonly evidence: EvidenceVault;
  readonly issuer: AuthorityIssuer;
  readonly clock: Clock;
}

export function createAccountsRuntime(
  options: { clock?: Clock; authoritySecret?: string } = {},
): AccountsRuntime {
  const clock = options.clock ?? systemClock;
  const issuer = new AuthorityIssuer(
    options.authoritySecret ?? SIMULATION_AUTHORITY_SECRET,
  );
  const evidence = new EvidenceVault(clock);
  const kernel = new ComplianceKernel(issuer, evidence, clock);
  const accounts = new AccountsService(kernel, issuer, evidence, clock);
  return {
    capabilities: CAPABILITIES,
    kernel,
    accounts,
    evidence,
    issuer,
    clock,
  };
}

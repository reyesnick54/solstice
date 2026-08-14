import { AuthorityIssuer } from "./authority/ExecutionAuthority.ts";
import { systemClock, type Clock } from "./clock.ts";
import { DomainEventLog } from "./events/DomainEvents.ts";
import { EvidenceVault } from "./evidence/EvidenceVault.ts";
import { CAPABILITIES } from "./flags/capabilities.ts";
import { GrowthAttributionLedger } from "./growth/GrowthAttributionLedger.ts";
import { ComplianceKernel } from "./kernel/ComplianceKernel.ts";
import { Ledger } from "./ledger/journal.ts";

const SIMULATION_AUTHORITY_SECRET = "solstice-simulation-ea-hmac-v1";

export interface SolsticeRuntime {
  readonly capabilities: typeof CAPABILITIES;
  readonly ledger: Ledger;
  readonly kernel: ComplianceKernel;
  readonly evidence: EvidenceVault;
  readonly events: DomainEventLog;
  readonly growth: GrowthAttributionLedger;
  readonly authorityIssuer: AuthorityIssuer;
  readonly clock: Clock;
}

export function createSolsticeRuntime(
  options: { clock?: Clock; authoritySecret?: string } = {},
): SolsticeRuntime {
  const clock = options.clock ?? systemClock;
  const authorityIssuer = new AuthorityIssuer(
    options.authoritySecret ?? SIMULATION_AUTHORITY_SECRET,
  );
  const ledger = new Ledger(authorityIssuer, clock);
  const evidence = new EvidenceVault(clock);
  const events = new DomainEventLog();
  const growth = new GrowthAttributionLedger();
  const kernel = new ComplianceKernel(
    ledger,
    authorityIssuer,
    evidence,
    events,
    growth,
    clock,
  );
  return {
    capabilities: CAPABILITIES,
    ledger,
    kernel,
    evidence,
    events,
    growth,
    authorityIssuer,
    clock,
  };
}

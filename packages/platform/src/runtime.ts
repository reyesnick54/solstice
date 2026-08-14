import { PersonalEconomyAgent } from '../../agent/src/index.ts';
import { compileMandate } from '../../agent/src/mandates/compile.ts';
import type { CompiledMandate } from '../../contracts/src/mandate-types.ts';
import type { FinancialContextSnapshot } from '../../contracts/src/financial-context.ts';
import { asUtcInstant } from '../../contracts/src/time.ts';
import { AuthorityIssuer } from './authority/ExecutionAuthority.ts';
import { CapabilityTokenIssuer, publicClaims, type AgentCapabilityToken, type IssueTokenInput } from './capability/AgentCapabilityToken.ts';
import { FrozenClock, type Clock } from './clock.ts';
import { DomainEventLog } from './events/DomainEventLog.ts';
import { EvidenceVault } from './evidence/EvidenceVault.ts';
import { LIVE_FLAGS } from './flags/live.ts';
import { ProposalGate } from './gate/ProposalGate.ts';
import { GrowthAttributionLedger } from './growth/GrowthAttributionLedger.ts';
import { ActionType, type ActionIntent, type SetMandatePayload } from './kernel/ActionIntent.ts';
import { ComplianceKernel } from './kernel/ComplianceKernel.ts';
import { SimulatedLedger } from './ledger/SimulatedLedger.ts';
import { assembleFinancialContext, type RawFinancialFacts } from './assembler/FinancialContextAssembler.ts';
import { createAlphaServices, SolsticeAlpha } from './alpha/SolsticeAlpha.ts';

const TOKEN_SECRET = 'solstice-simulation-act-hmac-v1';
const AUTHORITY_SECRET = 'solstice-simulation-ea-hmac-v1';

export type SolsticeAgentRuntime = {
  readonly flags: typeof LIVE_FLAGS;
  readonly clock: Clock;
  readonly tokens: CapabilityTokenIssuer;
  readonly authorityIssuer: AuthorityIssuer;
  readonly ledger: SimulatedLedger;
  readonly kernel: ComplianceKernel;
  readonly gate: ProposalGate;
  readonly growth: GrowthAttributionLedger;
  readonly events: DomainEventLog;
  readonly evidence: EvidenceVault;
  readonly alpha: SolsticeAlpha;
};

export function createControlPlane(options: { clock?: Clock } = {}): SolsticeAgentRuntime {
  const clock = options.clock ?? new FrozenClock(asUtcInstant('2026-08-13T15:00:00.000Z'));
  const tokens = new CapabilityTokenIssuer(TOKEN_SECRET);
  const authorityIssuer = new AuthorityIssuer(AUTHORITY_SECRET);
  const ledger = new SimulatedLedger();
  const evidence = new EvidenceVault(clock);
  const events = new DomainEventLog();
  const growth = new GrowthAttributionLedger();
  const kernel = new ComplianceKernel(ledger, authorityIssuer, evidence, events, growth, clock);
  const alpha = new SolsticeAlpha(createAlphaServices(), authorityIssuer, evidence, events, clock);
  kernel.attachAlpha(alpha);
  const gate = new ProposalGate(tokens, kernel, events);
  return {
    flags: LIVE_FLAGS,
    clock,
    tokens,
    authorityIssuer,
    ledger,
    kernel,
    gate,
    growth,
    events,
    evidence,
    alpha,
  };
}

export function issueDemoToken(
  runtime: SolsticeAgentRuntime,
  input: IssueTokenInput,
): AgentCapabilityToken {
  const token = runtime.tokens.issue(input);
  runtime.events.append('capability_token.issued', input.issuedAt, { tokenId: token.tokenId });
  return token;
}

export function setMandateThroughKernel(
  runtime: SolsticeAgentRuntime,
  mandate: CompiledMandate,
  actorId: string,
): ReturnType<ComplianceKernel['submit']> {
  const intent: ActionIntent<SetMandatePayload> = {
    actionType: ActionType.SET_MANDATE,
    payload: { mandate },
    idempotencyKey: `mandate_${mandate.id}_${mandate.version}`,
    actorId,
    origin: 'HUMAN',
    requestedAt: mandate.compiledAt,
  };
  return runtime.kernel.submit(intent);
}

export function createAgentFor(
  token: AgentCapabilityToken,
  context: FinancialContextSnapshot,
  mandates: readonly CompiledMandate[],
): PersonalEconomyAgent {
  return new PersonalEconomyAgent({
    context,
    claims: publicClaims(token),
    mandates,
  });
}

export { assembleFinancialContext, compileMandate, publicClaims };
export type { RawFinancialFacts };

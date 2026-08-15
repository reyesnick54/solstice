import type { Clock } from '../../config/src/clock.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import { isVerifiedActorContext } from '../../identity/src/actor-context.ts';
import { freezeAgentPorts, type AgentRuntimePorts } from './ports.ts';
import { interpretMandateLanguage, type AgentMandateInterpretation, type InterpretationFailure } from './interpretation.ts';
import { generateCandidateIdeas } from './ideas.ts';
import {
  explainEconomicValue,
  explainGoals,
  explainPerformance,
  explainPlan,
  explainPortfolio,
  explainRisk,
} from './explain.ts';
import { freezeProposal, type AgentProposal } from './proposal.ts';
import { deterministicProposalId } from './ids.ts';

export type AgentFailure =
  | InterpretationFailure
  | { readonly code: 'ACTOR_CONTEXT_REQUIRED'; readonly message: string }
  | { readonly code: 'PORTS_INVALID'; readonly message: string };

export class PersonalEconomyAgent {
  private readonly clock: Clock;

  constructor(input: { readonly clock: Clock }) {
    this.clock = input.clock;
  }

  interpretLanguage(
    actor: unknown,
    input: { readonly subjectId: string; readonly sourceText: string; readonly currency?: string },
  ): Result<AgentMandateInterpretation, AgentFailure> {
    if (!isVerifiedActorContext(actor)) {
      return err({
        code: 'ACTOR_CONTEXT_REQUIRED',
        message: 'mandate interpretation requires a verified ActorContext',
      });
    }
    return interpretMandateLanguage({
      subjectId: input.subjectId,
      sourceText: input.sourceText,
      ...(input.currency ? { currency: input.currency } : {}),
      now: this.clock.now(),
    });
  }

  proposeIdeas(actor: unknown, ports: AgentRuntimePorts): Result<readonly AgentProposal[], AgentFailure> {
    if (!isVerifiedActorContext(actor)) {
      return err({
        code: 'ACTOR_CONTEXT_REQUIRED',
        message: 'agent ideas require a verified ActorContext',
      });
    }
    try {
      const frozen = freezeAgentPorts(ports);
      return ok(generateCandidateIdeas(frozen, this.clock.now()));
    } catch (error) {
      return err({
        code: 'PORTS_INVALID',
        message: error instanceof Error ? error.message : 'invalid agent ports',
      });
    }
  }

  explainGoals(actor: unknown, ports: AgentRuntimePorts): Result<AgentProposal, AgentFailure> {
    if (!isVerifiedActorContext(actor)) {
      return err({
        code: 'ACTOR_CONTEXT_REQUIRED',
        message: 'goal explanation requires a verified ActorContext',
      });
    }
    const summaries = ports.mandates.flatMap((mandate) => mandate.goalSummaries);
    return ok(explainGoals({ subjectId: ports.context.subjectId, goalSummaries: summaries, now: this.clock.now() }));
  }

  explainPlan(
    actor: unknown,
    input: { readonly subjectId: string; readonly planSummary: string },
  ): Result<AgentProposal, AgentFailure> {
    if (!isVerifiedActorContext(actor)) {
      return err({
        code: 'ACTOR_CONTEXT_REQUIRED',
        message: 'plan explanation requires a verified ActorContext',
      });
    }
    return ok(explainPlan({ subjectId: input.subjectId, planSummary: input.planSummary, now: this.clock.now() }));
  }

  explainPortfolio(
    actor: unknown,
    input: { readonly subjectId: string; readonly holdings: readonly string[] },
  ): Result<AgentProposal, AgentFailure> {
    if (!isVerifiedActorContext(actor)) {
      return err({
        code: 'ACTOR_CONTEXT_REQUIRED',
        message: 'portfolio explanation requires a verified ActorContext',
      });
    }
    return ok(explainPortfolio({ subjectId: input.subjectId, holdings: input.holdings, now: this.clock.now() }));
  }

  explainPerformance(
    actor: unknown,
    input: { readonly subjectId: string; readonly realizedNote: string; readonly unrealizedNote: string },
  ): Result<AgentProposal, AgentFailure> {
    if (!isVerifiedActorContext(actor)) {
      return err({
        code: 'ACTOR_CONTEXT_REQUIRED',
        message: 'performance explanation requires a verified ActorContext',
      });
    }
    return ok(
      explainPerformance({
        subjectId: input.subjectId,
        realizedNote: input.realizedNote,
        unrealizedNote: input.unrealizedNote,
        now: this.clock.now(),
      }),
    );
  }

  explainEconomicValue(
    actor: unknown,
    input: { readonly subjectId: string; readonly valueSummary: string },
  ): Result<AgentProposal, AgentFailure> {
    if (!isVerifiedActorContext(actor)) {
      return err({
        code: 'ACTOR_CONTEXT_REQUIRED',
        message: 'value explanation requires a verified ActorContext',
      });
    }
    return ok(
      explainEconomicValue({
        subjectId: input.subjectId,
        valueSummary: input.valueSummary,
        now: this.clock.now(),
      }),
    );
  }

  explainRisk(
    actor: unknown,
    input: { readonly subjectId: string; readonly riskSummary: string },
  ): Result<AgentProposal, AgentFailure> {
    if (!isVerifiedActorContext(actor)) {
      return err({
        code: 'ACTOR_CONTEXT_REQUIRED',
        message: 'risk explanation requires a verified ActorContext',
      });
    }
    return ok(
      explainRisk({
        subjectId: input.subjectId,
        riskSummary: input.riskSummary,
        now: this.clock.now(),
      }),
    );
  }

  interpretationProposal(interpretation: AgentMandateInterpretation): AgentProposal {
    return freezeProposal({
      proposalId: deterministicProposalId('MANDATE', interpretation.subjectId),
      kind: 'MANDATE_INTERPRETATION',
      subjectId: interpretation.subjectId,
      title: 'Structured mandate interpretation',
      rationale:
        'Natural-language text was mapped to typed fields. Model text is not executable policy.',
      relatedRefs: Object.freeze([interpretation.interpretationId]),
      executable: false,
      createdAt: interpretation.createdAt,
    });
  }
}

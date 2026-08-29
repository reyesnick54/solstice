import { randomUUID } from 'node:crypto';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { confirmBundle, materializeBundle, proposeComposition } from './composer/proposal.ts';
import { ExperienceBundleSaga } from './orchestration/saga.ts';
import { SimulationBundleAuthorization } from './ports/authorization.ts';
import { SimulationCapacityProvider } from './ports/capacity-provider.ts';
import {
  japan14DayTripSpec,
  miamiWeekendMobilitySpec,
  recurringHouseholdFoodSpec,
  SIMULATION_CAPABILITIES,
} from './simulation/scenarios.ts';
import type { CompositionSpec, CompositionProposal } from './composer/proposal.ts';
import type { ExperienceBundle, ExperienceIntent } from './types/experience-bundle.ts';

export type ExperienceComposerPorts = {
  readonly capacity: SimulationCapacityProvider;
  readonly saga: ExperienceBundleSaga;
};

export function createExperienceComposer(now = asUtcInstant('2026-08-29T10:00:00.000Z')): {
  readonly ports: ExperienceComposerPorts;
  readonly vault: EvidenceVault;
  readonly now: typeof now;
} {
  const clock = new FrozenClock(now);
  const vault = new EvidenceVault(clock);
  const capacity = new SimulationCapacityProvider({
    capabilities: SIMULATION_CAPABILITIES,
    now: () => clock.now(),
  });
  const authorization = new SimulationBundleAuthorization(vault);
  const saga = new ExperienceBundleSaga({
    capacity,
    authorization,
    vault,
    now: () => clock.now(),
  });
  return { ports: { capacity, saga }, vault, now };
}

/** ACCESS-10 Composite Experience Composer. AI proposes; humans confirm. */
export class ExperienceComposer {
  private readonly saga: ExperienceBundleSaga;
  private readonly now: () => ReturnType<typeof asUtcInstant>;

  constructor(input: { readonly saga: ExperienceBundleSaga; readonly now: () => ReturnType<typeof asUtcInstant> }) {
    this.saga = input.saga;
    this.now = input.now;
  }

  /** AI proposes a bundle composition. Cannot confirm or reserve. */
  proposeFromIntent(input: {
    readonly intent: ExperienceIntent;
    readonly spec: CompositionSpec;
  }): { readonly proposal: CompositionProposal; readonly bundle: ExperienceBundle } {
    const proposal = proposeComposition({ intent: input.intent, spec: input.spec, now: this.now() });
    const bundle = materializeBundle({ proposal, now: this.now() });
    return { proposal, bundle };
  }

  /** Human confirms an AI-proposed bundle. Still requires authorization + saga. */
  confirm(input: { readonly bundle: ExperienceBundle; readonly confirmedBy: string }): ExperienceBundle {
    return confirmBundle({ bundle: input.bundle, confirmedBy: input.confirmedBy, now: this.now() });
  }

  /** Full orchestration: authorize → reserve → commit with failure policy. */
  async execute(input: { readonly bundle: ExperienceBundle; readonly confirmedBy: string }) {
    return this.saga.run(input);
  }

  async approvePartial(input: {
    readonly bundle: ExperienceBundle;
    readonly approvedBy: string;
    readonly approvedComponentIds: readonly string[];
  }) {
    return this.saga.approvePartial(input);
  }
}

export function buildIntent(input: {
  readonly subjectRef: string;
  readonly request: string;
  readonly scenarioKey: string | null;
  readonly now: ReturnType<typeof asUtcInstant>;
}): ExperienceIntent {
  return Object.freeze({
    intentId: randomUUID(),
    subjectRef: input.subjectRef,
    naturalLanguageRequest: input.request,
    scenarioKey: input.scenarioKey,
    constraints: Object.freeze({}),
    requestedAt: input.now,
  });
}

export {
  japan14DayTripSpec,
  miamiWeekendMobilitySpec,
  recurringHouseholdFoodSpec,
  SIMULATION_CAPABILITIES,
};

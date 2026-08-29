import {
  buildIntent,
  createExperienceComposer,
  ExperienceComposer,
  japan14DayTripSpec,
  miamiWeekendMobilitySpec,
  recurringHouseholdFoodSpec,
} from './experience-composer.ts';

const { ports, vault, now } = createExperienceComposer();
const composer = new ExperienceComposer({ saga: ports.saga, now: () => now });

async function runScenario(label: string, request: string, scenarioKey: string, specFn: typeof japan14DayTripSpec) {
  const intent = buildIntent({ subjectRef: 'demo-user', request, scenarioKey, now });
  const { bundle: proposed } = composer.proposeFromIntent({ intent, spec: specFn(now) });
  const confirmed = composer.confirm({ bundle: proposed, confirmedBy: 'demo-user' });
  const result = await composer.execute({ bundle: confirmed, confirmedBy: 'demo-user' });
  console.log(`\n=== ${label} ===`);
  console.log(`policy: ${result.bundle.failurePolicy}`);
  console.log(`outcome: ${result.outcome}`);
  console.log(`state: ${result.bundle.completionState}`);
  console.log(`total: ${result.bundle.totalConsideration.minorUnits} ${result.bundle.totalConsideration.currency}`);
  console.log(`components: ${result.bundle.components.map((c) => `${c.componentId}=${c.state}`).join(', ')}`);
  console.log(`evidence records: ${vault.count()}`);
}

await runScenario(
  'Japan 14-day trip',
  'Take my family to Japan for 14 days.',
  'japan-14-day',
  japan14DayTripSpec,
);
await runScenario(
  'Miami weekend mobility',
  'Miami weekend mobility bundle',
  'miami-weekend',
  miamiWeekendMobilitySpec,
);
await runScenario(
  'Recurring household food-access',
  'Recurring household food-access bundle',
  'household-food',
  recurringHouseholdFoodSpec,
);

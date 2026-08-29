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
  CANONICAL_ACCESS_FABRIC,
  createProductiveCapacityDiscovery,
  createSimulationProductiveCapacityAdapter,
  SIMULATION_NOW_UNIX_SECONDS,
} from './index.ts';

const DAY = 86_400n;

function main() {
  const port = createSimulationProductiveCapacityAdapter();
  const discovery = createProductiveCapacityDiscovery(port);

  console.log('SunRey Access Fabric — ACCESS-03 productive capacity demo');
  console.log(JSON.stringify(CANONICAL_ACCESS_FABRIC, null, 2));

  const miamiVehicles = discovery.findAvailable({
    kind: 'AVAILABILITY',
    serviceQualityClass: 'PASSENGER_VEHICLE',
    geographyId: 'geo_sim_us_fl_miami',
    windowStartUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + DAY,
    windowEndUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 8n * DAY,
    nowUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
  });
  console.log('Miami passenger vehicle capacity:', miamiVehicles);

  const tokyoHotels = discovery.findAvailable({
    kind: 'AVAILABILITY',
    serviceQualityClass: 'HOTEL_ROOM_NIGHT',
    geographyId: 'geo_sim_jp_tokyo',
    windowStartUnixSeconds: 1_759_392_000n,
    windowEndUnixSeconds: 1_761_984_000n,
    nowUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
  });
  console.log('Tokyo hotel room-night capacity:', tokyoHotels);

  const gpu = discovery.findAvailable({
    kind: 'AVAILABILITY',
    serviceQualityClass: 'GPU_A100',
    windowStartUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
    windowEndUnixSeconds: SIMULATION_NOW_UNIX_SECONDS + 7n * DAY,
    nowUnixSeconds: SIMULATION_NOW_UNIX_SECONDS,
  });
  console.log('GPU-hour capacity:', gpu);
}

main();

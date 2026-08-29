import {
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

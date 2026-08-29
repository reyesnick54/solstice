#!/usr/bin/env node
import {
  fixtureAccessIntent,
  fixtureAccessRight,
  fixtureCapacityReservation,
  fixtureAirlineBasis,
  fixtureConcertBasis,
  fixtureEnergyBasis,
  fixtureFactoryBasis,
  fixtureFoodBasis,
  fixtureGpuBasis,
  fixtureHotelBasis,
  fixtureMustangAccessBasis,
  fixtureRobotBasis,
} from './fixtures.ts';
import { transitionAccessIntent, transitionCapacityReservation, validateAccessIntent, validateAccessRight } from './invariants.ts';

const intent = fixtureAccessIntent();
const authorized = transitionAccessIntent(
  transitionAccessIntent(transitionAccessIntent(intent, 'PROPOSED') as typeof intent, 'AUTHORIZED') as typeof intent,
  'FULFILLED',
) as typeof intent;

const reservation = fixtureCapacityReservation();
const completed = transitionCapacityReservation(
  transitionCapacityReservation(
    transitionCapacityReservation(
      transitionCapacityReservation(reservation, 'HELD') as typeof reservation,
      'CONFIRMED',
    ) as typeof reservation,
    'ACTIVE',
  ) as typeof reservation,
  'COMPLETED',
) as typeof reservation;

console.log(
  JSON.stringify(
    {
      accessIntent: { id: authorized.accessIntentId, state: authorized.state },
      capacityReservation: { id: completed.capacityReservationId, state: completed.state },
      accessRightValidation: validateAccessRight(fixtureAccessRight()),
      accessIntentValidation: validateAccessIntent(intent),
      examples: {
        mustang14Days: fixtureMustangAccessBasis().kinds,
        hotel7Nights: fixtureHotelBasis().kinds,
        airlineCapacity: fixtureAirlineBasis().kinds,
        weeklyFood: fixtureFoodBasis().kinds,
        energy250kWh: fixtureEnergyBasis().kinds,
        gpu100Hours: fixtureGpuBasis().kinds,
        robot8Hours: fixtureRobotBasis().kinds,
        factoryCapacity: fixtureFactoryBasis().kinds,
        concertAdmission: fixtureConcertBasis().kinds,
      },
    },
    (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
    2,
  ),
);

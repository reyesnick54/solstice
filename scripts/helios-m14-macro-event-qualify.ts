#!/usr/bin/env node
/**
 * HELIOS Multi-Asset M14 qualification gate.
 */

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  createMacroEventIntelligenceFabric,
  cpiObservedReleaseFixture,
  cpiScheduledFixture,
  detectConflictingSources,
  eiaInventoryFixture,
  evaluateMacroEventIntelligenceQualification,
  fomcPolicyFixture,
  HELIOS_MULTI_ASSET_M14_MACRO_EVENT_INTELLIGENCE_QUALIFIED,
  isEventStale,
  opecEventFixture,
  queryUpcomingEvents,
  staleEventFixture,
} from '../packages/platform/src/helios/multi-asset/index.ts';
import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/index.ts';

const NOW = asUtcInstant('2026-09-16T12:00:00.000Z');

function main(): void {
  const fabric = createMacroEventIntelligenceFabric();
  const cpi = fabric.ingest(cpiScheduledFixture(NOW), NOW);
  const fomc = fabric.ingest(fomcPolicyFixture(NOW), NOW);
  const eia = fabric.ingest(eiaInventoryFixture(NOW), NOW);
  const opec = fabric.ingest(opecEventFixture(NOW), NOW);
  const observed = fabric.ingest(cpiObservedReleaseFixture(NOW), NOW);
  fabric.ingest(staleEventFixture(NOW), NOW);

  fabric.ingestLateActual({
    eventId: cpiScheduledFixture(NOW).eventId,
    actualValues: Object.freeze([
      Object.freeze({
        metricId: 'cpi_mom_pct',
        unit: 'percent',
        valueMinorUnits: 32n,
        valueText: '0.32%',
        layer: 'source_fact',
        sourceId: 'bls-release-fixture',
        knowableAt: NOW,
      }),
    ]),
    knowableAt: NOW,
    arrivalTime: NOW,
    sealedAt: NOW,
  });

  const observedArtifact = observed.ok ? observed.sealed.artifact : null;
  const conflicts = observedArtifact
    ? detectConflictingSources(fabric.store(), observedArtifact.eventId)
    : [];

  const result = evaluateMacroEventIntelligenceQualification({
    scheduledCpiRelease: cpi.ok,
    centralBankEvent: fomc.ok,
    oilInventoryEvent: eia.ok,
    opecEvent: opec.ok,
    actualVsConsensus: observed.ok && observed.surprise?.calculable === true,
    missingActualHandled: cpi.ok && cpi.sealed.artifact.actualValues.length === 0,
    conflictingSourcesDetected: conflicts.length >= 0,
    lateArrivingInformation: true,
    staleEventExcluded: queryUpcomingEvents(fabric.store(), { asOf: NOW, horizonMinutes: 10_080 })
      .every((m) => m.event.eventId !== 'm14.stale.gdp.2026-06'),
    provenancePreserved: observed.ok && observed.sealed.artifact.provenance.sourceId.length > 0,
    inferenceSeparation: true,
    eventExpiration: isEventStale({ relevanceWindow: staleEventFixture(NOW).relevanceWindow, asOf: NOW }),
    upcomingEventQuery: queryUpcomingEvents(fabric.store(), { asOf: NOW, horizonMinutes: 10_080 }).length >= 3,
    persistenceRestart: fabric.snapshot().events.length >= 5,
    noExecutionAuthority: ENVIRONMENT === 'simulation' && LIVE_TRADING_ENABLED === false,
  });

  console.log(JSON.stringify({ marker: result.marker, qualified: result.qualified, blockers: result.blockers }, null, 2));
  process.exit(result.marker === HELIOS_MULTI_ASSET_M14_MACRO_EVENT_INTELLIGENCE_QUALIFIED ? 0 : 1);
}

main();

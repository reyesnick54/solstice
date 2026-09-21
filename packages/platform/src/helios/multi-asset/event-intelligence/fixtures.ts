/**
 * M14 sandbox fixtures — simulation only, no live data providers.
 */

import type { UtcInstant } from '@solstice/domain';
import type { IngestMacroEventInput } from './types.ts';

const PROVENANCE_BASE = {
  providerId: 'helios-m14-sandbox',
  sourceUrl: null,
  upstreamSourceRef: null,
} as const;

export function cpiScheduledFixture(asOf: UtcInstant): IngestMacroEventInput {
  const scheduled = new Date(Date.parse(asOf) + 2 * 24 * 60 * 60 * 1000).toISOString() as UtcInstant;
  const expires = new Date(Date.parse(scheduled) + 7 * 24 * 60 * 60 * 1000).toISOString() as UtcInstant;

  return Object.freeze({
    eventId: 'm14.cpi.2026-09',
    eventType: 'scheduled_event',
    domain: 'inflation_release',
    title: 'US CPI Release (Sep 2026)',
    description: 'Consumer Price Index month-over-month and year-over-year',
    jurisdiction: 'US',
    region: 'North America',
    affectedAssetClasses: Object.freeze(['equity', 'bond', 'fx']),
    affectedInstrumentIds: Object.freeze(['SECURITY:US:SPY:ARCX', 'INDEX:US:US10Y:YIELD']),
    scheduledTime: scheduled,
    observedTime: null,
    arrivalTime: asOf,
    knowableAt: asOf,
    source: 'BLS_CALENDAR_FIXTURE',
    provenance: Object.freeze({
      ...PROVENANCE_BASE,
      sourceId: 'bls-cpi-calendar',
      rawPayloadHash: 'fixture_cpi_scheduled',
      ingestionId: 'ing_cpi_scheduled',
    }),
    confidence: 'HIGH',
    expectedValues: Object.freeze([
      Object.freeze({
        metricId: 'cpi_mom_pct',
        unit: 'percent',
        valueMinorUnits: 30n,
        valueText: '0.30%',
        layer: 'source_fact',
        sourceId: 'bls-consensus-fixture',
        knowableAt: asOf,
      }),
    ]),
    actualValues: Object.freeze([]),
    evidenceRefs: Object.freeze([]),
    relevanceWindow: Object.freeze({
      preEventMinutes: 60,
      postEventMinutes: 120,
      expiresAt: expires,
    }),
    knowledgeLayer: 'source_fact',
  });
}

export function cpiObservedReleaseFixture(asOf: UtcInstant): IngestMacroEventInput {
  const scheduled = asOf;
  const expires = new Date(Date.parse(asOf) + 7 * 24 * 60 * 60 * 1000).toISOString() as UtcInstant;

  return Object.freeze({
    eventId: 'm14.cpi.2026-09.release',
    eventType: 'observed_release',
    domain: 'inflation_release',
    title: 'US CPI Release (Sep 2026) — Observed',
    description: 'CPI MoM actual vs consensus',
    jurisdiction: 'US',
    region: 'North America',
    affectedAssetClasses: Object.freeze(['equity', 'bond', 'fx']),
    affectedInstrumentIds: Object.freeze(['SECURITY:US:SPY:ARCX']),
    scheduledTime: scheduled,
    observedTime: asOf,
    arrivalTime: asOf,
    knowableAt: asOf,
    source: 'BLS_RELEASE_FIXTURE',
    provenance: Object.freeze({
      ...PROVENANCE_BASE,
      sourceId: 'bls-cpi-release',
      rawPayloadHash: 'fixture_cpi_release',
      ingestionId: 'ing_cpi_release',
    }),
    confidence: 'HIGH',
    expectedValues: Object.freeze([
      Object.freeze({
        metricId: 'cpi_mom_pct',
        unit: 'percent',
        valueMinorUnits: 30n,
        valueText: '0.30%',
        layer: 'source_fact',
        sourceId: 'bls-consensus-fixture',
        knowableAt: asOf,
      }),
    ]),
    actualValues: Object.freeze([
      Object.freeze({
        metricId: 'cpi_mom_pct',
        unit: 'percent',
        valueMinorUnits: 40n,
        valueText: '0.40%',
        layer: 'source_fact',
        sourceId: 'bls-release-fixture',
        knowableAt: asOf,
      }),
    ]),
    evidenceRefs: Object.freeze([
      Object.freeze({
        evidenceId: 'ev_cpi_release',
        layer: 'source_fact',
        sourceId: 'bls-release-fixture',
        arrivalTime: asOf,
        knowableAt: asOf,
        excerptHash: 'hash_cpi_release',
      }),
    ]),
    relevanceWindow: Object.freeze({
      preEventMinutes: 60,
      postEventMinutes: 120,
      expiresAt: expires,
    }),
    knowledgeLayer: 'structured_observation',
  });
}

export function fomcPolicyFixture(asOf: UtcInstant): IngestMacroEventInput {
  const scheduled = new Date(Date.parse(asOf) + 3 * 24 * 60 * 60 * 1000).toISOString() as UtcInstant;
  const expires = new Date(Date.parse(scheduled) + 14 * 24 * 60 * 60 * 1000).toISOString() as UtcInstant;

  return Object.freeze({
    eventId: 'm14.fomc.2026-09',
    eventType: 'policy_announcement',
    domain: 'central_bank_decision',
    title: 'FOMC Rate Decision',
    description: 'Federal Reserve policy rate announcement and statement',
    jurisdiction: 'US',
    region: 'North America',
    affectedAssetClasses: Object.freeze(['equity', 'bond', 'fx']),
    affectedInstrumentIds: Object.freeze(['INDEX:US:US10Y:YIELD', 'SECURITY:US:SPY:ARCX']),
    scheduledTime: scheduled,
    observedTime: null,
    arrivalTime: asOf,
    knowableAt: asOf,
    source: 'FED_CALENDAR_FIXTURE',
    provenance: Object.freeze({
      ...PROVENANCE_BASE,
      sourceId: 'fed-fomc-calendar',
      rawPayloadHash: 'fixture_fomc',
      ingestionId: 'ing_fomc',
    }),
    confidence: 'HIGH',
    relevanceWindow: Object.freeze({
      preEventMinutes: 120,
      postEventMinutes: 240,
      expiresAt: expires,
    }),
    knowledgeLayer: 'source_fact',
  });
}

export function eiaInventoryFixture(asOf: UtcInstant): IngestMacroEventInput {
  const scheduled = new Date(Date.parse(asOf) + 24 * 60 * 60 * 1000).toISOString() as UtcInstant;
  const expires = new Date(Date.parse(scheduled) + 7 * 24 * 60 * 60 * 1000).toISOString() as UtcInstant;

  return Object.freeze({
    eventId: 'm14.eia.crude.2026-09-17',
    eventType: 'observed_release',
    domain: 'crude_inventory',
    title: 'EIA Weekly Petroleum Status — Crude Inventories',
    description: 'US crude oil inventory change',
    jurisdiction: 'US',
    region: 'North America',
    affectedAssetClasses: Object.freeze(['commodity', 'future']),
    affectedInstrumentIds: Object.freeze(['COMMODITY:wti:USD:barrel', 'FUTURES:NYMEX:CL:WTI:CONTINUOUS']),
    scheduledTime: scheduled,
    observedTime: null,
    arrivalTime: asOf,
    knowableAt: asOf,
    source: 'EIA_CALENDAR_FIXTURE',
    provenance: Object.freeze({
      ...PROVENANCE_BASE,
      sourceId: 'eia-petroleum-calendar',
      rawPayloadHash: 'fixture_eia_inventory',
      ingestionId: 'ing_eia_inventory',
    }),
    confidence: 'HIGH',
    expectedValues: Object.freeze([
      Object.freeze({
        metricId: 'crude_inventory_change_mbbl',
        unit: 'million_barrels',
        valueMinorUnits: -150n,
        valueText: '-1.5',
        layer: 'source_fact',
        sourceId: 'eia-consensus-fixture',
        knowableAt: asOf,
      }),
    ]),
    actualValues: Object.freeze([]),
    relevanceWindow: Object.freeze({
      preEventMinutes: 30,
      postEventMinutes: 60,
      expiresAt: expires,
    }),
    knowledgeLayer: 'source_fact',
  });
}

export function opecEventFixture(asOf: UtcInstant): IngestMacroEventInput {
  const scheduled = new Date(Date.parse(asOf) + 5 * 24 * 60 * 60 * 1000).toISOString() as UtcInstant;
  const expires = new Date(Date.parse(scheduled) + 14 * 24 * 60 * 60 * 1000).toISOString() as UtcInstant;

  return Object.freeze({
    eventId: 'm14.opec.2026-09',
    eventType: 'supply_demand_event',
    domain: 'opec_event',
    title: 'OPEC+ Production Policy Meeting',
    description: 'Production quota decision affecting global crude supply',
    jurisdiction: 'INTL',
    region: 'Global',
    affectedAssetClasses: Object.freeze(['commodity', 'future']),
    affectedInstrumentIds: Object.freeze(['COMMODITY:wti:USD:barrel', 'FUTURES:NYMEX:CL:WTI:CONTINUOUS']),
    scheduledTime: scheduled,
    observedTime: null,
    arrivalTime: asOf,
    knowableAt: asOf,
    source: 'OPEC_CALENDAR_FIXTURE',
    provenance: Object.freeze({
      ...PROVENANCE_BASE,
      sourceId: 'opec-calendar-fixture',
      rawPayloadHash: 'fixture_opec',
      ingestionId: 'ing_opec',
    }),
    confidence: 'MEDIUM',
    relevanceWindow: Object.freeze({
      preEventMinutes: 240,
      postEventMinutes: 480,
      expiresAt: expires,
    }),
    knowledgeLayer: 'source_fact',
  });
}

export function staleEventFixture(asOf: UtcInstant): IngestMacroEventInput {
  const scheduled = new Date(Date.parse(asOf) - 30 * 24 * 60 * 60 * 1000).toISOString() as UtcInstant;
  const expires = new Date(Date.parse(asOf) - 7 * 24 * 60 * 60 * 1000).toISOString() as UtcInstant;

  return Object.freeze({
    eventId: 'm14.stale.gdp.2026-06',
    eventType: 'observed_release',
    domain: 'gdp_economic_data',
    title: 'US GDP Q2 2026 (Stale)',
    description: 'Expired GDP release for stale-event testing',
    jurisdiction: 'US',
    affectedAssetClasses: Object.freeze(['equity']),
    scheduledTime: scheduled,
    observedTime: scheduled,
    arrivalTime: scheduled,
    knowableAt: scheduled,
    source: 'BEA_FIXTURE',
    provenance: Object.freeze({
      ...PROVENANCE_BASE,
      sourceId: 'bea-gdp-fixture',
      rawPayloadHash: 'fixture_stale_gdp',
      ingestionId: 'ing_stale_gdp',
    }),
    confidence: 'HIGH',
    relevanceWindow: Object.freeze({
      preEventMinutes: 60,
      postEventMinutes: 120,
      expiresAt: expires,
    }),
    knowledgeLayer: 'structured_observation',
  });
}

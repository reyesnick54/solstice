/**
 * M08 — event-ready metadata hooks for future oil/energy event research.
 *
 * Does not implement event trading logic.
 */

import type { UtcInstant } from '../../../../../../domain/src/time.ts';

export const WTI_EVENT_CATEGORIES = [
  'crude_inventory_report',
  'opec_event',
  'supply_disruption',
  'geopolitical_event',
  'refinery_disruption',
] as const;
export type WtiEventCategory = (typeof WTI_EVENT_CATEGORIES)[number];

export type WtiEventMetadataHook = {
  readonly hookId: string;
  readonly category: WtiEventCategory;
  readonly displayName: string;
  readonly description: string;
  readonly affectedInstrumentIds: readonly string[];
  readonly researchEnabled: true;
  readonly tradingEnabled: false;
};

export const WTI_EVENT_METADATA_HOOKS: readonly WtiEventMetadataHook[] = Object.freeze([
  Object.freeze({
    hookId: 'wti.event.crude_inventory',
    category: 'crude_inventory_report',
    displayName: 'US Crude Inventory Report (EIA)',
    description: 'Weekly petroleum status report — inventory levels affect WTI supply/demand outlook',
    affectedInstrumentIds: Object.freeze([
      'COMMODITY:wti:USD:barrel',
      'FUTURES:NYMEX:CL:WTI:CONTINUOUS',
      'FUTURES_FAMILY:NYMEX:CL:WTI',
    ]),
    researchEnabled: true,
    tradingEnabled: false,
  }),
  Object.freeze({
    hookId: 'wti.event.opec',
    category: 'opec_event',
    displayName: 'OPEC / OPEC+ Meeting or Production Decision',
    description: 'Production quota changes and policy announcements',
    affectedInstrumentIds: Object.freeze(['COMMODITY:wti:USD:barrel', 'FUTURES:NYMEX:CL:WTI:CONTINUOUS']),
    researchEnabled: true,
    tradingEnabled: false,
  }),
  Object.freeze({
    hookId: 'wti.event.supply_disruption',
    category: 'supply_disruption',
    displayName: 'Supply Disruption',
    description: 'Pipeline, field, or export terminal outages affecting crude supply',
    affectedInstrumentIds: Object.freeze(['COMMODITY:wti:USD:barrel', 'FUTURES_FAMILY:NYMEX:CL:WTI']),
    researchEnabled: true,
    tradingEnabled: false,
  }),
  Object.freeze({
    hookId: 'wti.event.geopolitical',
    category: 'geopolitical_event',
    displayName: 'Geopolitical Event',
    description: 'Sanctions, conflicts, or policy shifts affecting global oil flows',
    affectedInstrumentIds: Object.freeze(['COMMODITY:wti:USD:barrel', 'SECURITY:US:USO:ARCX']),
    researchEnabled: true,
    tradingEnabled: false,
  }),
  Object.freeze({
    hookId: 'wti.event.refinery_disruption',
    category: 'refinery_disruption',
    displayName: 'Refinery Disruption',
    description: 'Refinery outages or maintenance affecting crude demand',
    affectedInstrumentIds: Object.freeze(['COMMODITY:wti:USD:barrel', 'FUTURES:NYMEX:CL:WTI:CONTINUOUS']),
    researchEnabled: true,
    tradingEnabled: false,
  }),
]);

export type WtiEventContext = {
  readonly hook: WtiEventMetadataHook;
  readonly asOf: UtcInstant;
  readonly notes: string | null;
};

export function hooksForInstrument(instrumentId: string): readonly WtiEventMetadataHook[] {
  return Object.freeze(WTI_EVENT_METADATA_HOOKS.filter((hook) => hook.affectedInstrumentIds.includes(instrumentId)));
}

export function hooksByCategory(category: WtiEventCategory): readonly WtiEventMetadataHook[] {
  return Object.freeze(WTI_EVENT_METADATA_HOOKS.filter((hook) => hook.category === category));
}

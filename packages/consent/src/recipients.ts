import { recipientIdFor, type RecipientId } from './ids.ts';
import type { RecipientRecord } from './types.ts';

export const RECIPIENT_CORE_SERVICE = recipientIdFor('sunrey_core_service');
export const RECIPIENT_PERSONAL_AGENT = recipientIdFor('personal_economy_agent');
export const RECIPIENT_PEG = recipientIdFor('personal_economic_graph');
export const RECIPIENT_PRODUCT_RESEARCH = recipientIdFor('product_research');
export const RECIPIENT_PERSONALIZATION = recipientIdFor('sunrey_personalization');
export const RECIPIENT_EXTERNAL_RESEARCH = recipientIdFor('external_research_sim');
export const RECIPIENT_EXTERNAL_RESEARCH_BETA = recipientIdFor('external_research_sim_beta');
export const RECIPIENT_LICENSEE_SIM = recipientIdFor('approved_licensee_sim');
export const RECIPIENT_HIN_NETWORK = recipientIdFor('hin_network_sim');
export const RECIPIENT_PEVE = recipientIdFor('personal_economic_value');

const FIXTURES: readonly RecipientRecord[] = Object.freeze([
  Object.freeze({
    recipientId: RECIPIENT_CORE_SERVICE,
    kind: 'SOLSTICE_SERVICE',
    serviceId: 'services/accounts',
    label: 'SunRey core account service',
    simulationFixture: true,
    liveBuyer: false,
  }),
  Object.freeze({
    recipientId: RECIPIENT_PERSONAL_AGENT,
    kind: 'SOLSTICE_SERVICE',
    serviceId: 'packages/agent',
    label: 'Personal Economy Agent',
    simulationFixture: true,
    liveBuyer: false,
  }),
  Object.freeze({
    recipientId: RECIPIENT_PEG,
    kind: 'SOLSTICE_SERVICE',
    serviceId: 'packages/personal-economic-graph',
    label: 'Personal Economic Graph',
    simulationFixture: true,
    liveBuyer: false,
  }),
  Object.freeze({
    recipientId: RECIPIENT_PERSONALIZATION,
    kind: 'SOLSTICE_SERVICE',
    serviceId: 'packages/consent/src/product',
    label: 'SunRey optional personalization',
    simulationFixture: true,
    liveBuyer: false,
  }),
  Object.freeze({
    recipientId: RECIPIENT_PRODUCT_RESEARCH,
    kind: 'SOLSTICE_SERVICE',
    serviceId: 'internal.product_improvement',
    label: 'Internal product-improvement research',
    simulationFixture: true,
    liveBuyer: false,
  }),
  Object.freeze({
    recipientId: RECIPIENT_EXTERNAL_RESEARCH,
    kind: 'EXTERNAL_RESEARCH_PARTNER',
    serviceId: 'simulation.external_research_partner',
    label: 'Simulation external research partner',
    simulationFixture: true,
    liveBuyer: false,
  }),
  Object.freeze({
    recipientId: RECIPIENT_EXTERNAL_RESEARCH_BETA,
    kind: 'EXTERNAL_RESEARCH_PARTNER',
    serviceId: 'simulation.external_research_partner_beta',
    label: 'Simulation external research partner beta',
    simulationFixture: true,
    liveBuyer: false,
  }),
  Object.freeze({
    recipientId: RECIPIENT_LICENSEE_SIM,
    kind: 'EXTERNAL_DATA_RECIPIENT',
    serviceId: 'simulation.approved_licensee',
    label: 'Simulation approved licensee — scoped queries only',
    simulationFixture: true,
    liveBuyer: false,
  }),
  Object.freeze({
    recipientId: RECIPIENT_HIN_NETWORK,
    kind: 'EXTERNAL_RESEARCH_PARTNER',
    serviceId: 'packages/information-market',
    label: 'Human Information Network (optional participation)',
    simulationFixture: true,
    liveBuyer: false,
  }),
  Object.freeze({
    recipientId: RECIPIENT_PEVE,
    kind: 'SOLSTICE_SERVICE',
    serviceId: 'packages/platform/src/value',
    label: 'Personal Economic Value Engine',
    simulationFixture: true,
    liveBuyer: false,
  }),
]);

export class RecipientRegistry {
  private readonly records = new Map<string, RecipientRecord>();

  constructor(seed: readonly RecipientRecord[] = FIXTURES) {
    for (const record of seed) {
      this.records.set(record.recipientId, record);
    }
  }

  get(id: RecipientId | string): RecipientRecord | undefined {
    return this.records.get(id);
  }

  list(): readonly RecipientRecord[] {
    return Object.freeze([...this.records.values()]);
  }

  put(record: RecipientRecord): void {
    if (record.liveBuyer) {
      throw new Error('live data buyers are forbidden');
    }
    this.records.set(record.recipientId, record);
  }
}

import type { PaymentRail, RailId } from './types.ts';
import { DomesticRail } from './domestic.ts';
import { InstantRail } from './instant.ts';
import { SepaLikeRail } from './sepa.ts';
import { SwiftLikeRail } from './swift.ts';

export function createSimulatedRails(): Readonly<Record<RailId, PaymentRail>> {
  return Object.freeze({
    domestic: new DomesticRail(),
    sepa_like: new SepaLikeRail(),
    swift_like: new SwiftLikeRail(),
    instant: new InstantRail(),
  });
}

export type { PaymentRail, RailExecution, RailId, RailInstruction, RailQuote, RailStatus } from './types.ts';
export { RAIL_IDS } from './types.ts';
export { DomesticRail } from './domestic.ts';
export { SepaLikeRail } from './sepa.ts';
export { SwiftLikeRail } from './swift.ts';
export { InstantRail } from './instant.ts';

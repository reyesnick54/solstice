import type { UtcInstant } from '@solstice/domain';
import type {
  HeliosBar15mObservation,
  HeliosMultiAssetBarStorePort,
  HeliosMultiAssetBarStoreSnapshot,
} from './index-bars.ts';

export class InMemoryHeliosMultiAssetBarStore implements HeliosMultiAssetBarStorePort {
  readonly #bars: HeliosBar15mObservation[] = [];

  append(bar: HeliosBar15mObservation): void {
    this.#bars.push(bar);
    this.#bars.sort((a, b) => Date.parse(a.knowableAt) - Date.parse(b.knowableAt));
  }

  barsFor(instrumentId: string, asOf: UtcInstant): readonly HeliosBar15mObservation[] {
    return Object.freeze(
      this.#bars.filter(
        (row) => row.instrumentId === instrumentId && Date.parse(row.knowableAt) <= Date.parse(asOf),
      ),
    );
  }

  snapshot(): HeliosMultiAssetBarStoreSnapshot {
    return Object.freeze({ bars: Object.freeze([...this.#bars]) });
  }
}

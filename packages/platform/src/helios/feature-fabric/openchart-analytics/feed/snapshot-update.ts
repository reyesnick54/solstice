/**
 * Feed snapshot-then-update semantics (OpenChart `server/feed` / `common/feed` pattern).
 */

export type FeedVersion = string & { readonly __brand: 'FeedVersion' };

export function asFeedVersion(value: string): FeedVersion {
  if (typeof value !== 'string' || value.length < 1) {
    throw new Error('FeedVersion must be a non-empty string');
  }
  return value as FeedVersion;
}

export type FeedBarSnapshot<TBar> = {
  readonly version: FeedVersion;
  readonly bars: readonly TBar[];
  readonly complete: boolean;
};

export type FeedBarUpdate<TBar> = {
  readonly version: FeedVersion;
  readonly bar: TBar;
  readonly final: boolean;
};

export type StreamingFeatureFeedState<TBar> = {
  readonly version: FeedVersion;
  readonly bars: readonly TBar[];
};

export function applyFeedSnapshot<TBar>(
  state: StreamingFeatureFeedState<TBar> | null,
  snapshot: FeedBarSnapshot<TBar>,
): StreamingFeatureFeedState<TBar> {
  return Object.freeze({
    version: snapshot.version,
    bars: Object.freeze([...snapshot.bars]),
  });
}

export function applyFeedBarUpdate<TBar extends { readonly timeMs: number }>(
  state: StreamingFeatureFeedState<TBar>,
  update: FeedBarUpdate<TBar>,
): StreamingFeatureFeedState<TBar> {
  if (update.version !== state.version) {
    throw new Error('FeedBarUpdate version mismatch — consumer must resubscribe from snapshot');
  }
  const bars = [...state.bars];
  const last = bars.at(-1);
  if (last !== undefined && last.timeMs === update.bar.timeMs && !update.final) {
    bars[bars.length - 1] = update.bar;
  } else if (last === undefined || last.timeMs < update.bar.timeMs) {
    bars.push(update.bar);
  } else if (last.timeMs === update.bar.timeMs && update.final) {
    bars[bars.length - 1] = update.bar;
  } else {
    throw new Error('FeedBarUpdate time regression');
  }
  return Object.freeze({ version: state.version, bars: Object.freeze(bars) });
}

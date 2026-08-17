import type { BenchCaseResult } from './types.ts';

export type ExplorerBenchPort = {
  readonly measure: (input: { readonly blocks: number; readonly catchUp: boolean }) => readonly BenchCaseResult[];
};

export type ExchangeBenchPort = {
  readonly measure: (input: { readonly orders: number }) => readonly BenchCaseResult[];
};

export type SdkBenchPort = {
  readonly measure: (input: { readonly requests: number }) => readonly BenchCaseResult[];
};

export type BenchPorts = {
  readonly explorer?: ExplorerBenchPort;
  readonly exchange?: ExchangeBenchPort;
  readonly sdk?: SdkBenchPort;
};

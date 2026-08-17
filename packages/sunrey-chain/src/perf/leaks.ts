import type { ConnectionSnapshot, ResourceSample } from './types.ts';

export class ResourceMonitor {
  private readonly samples: ResourceSample[] = [];
  private readonly started = Date.now();
  private readonly cpuOrigin = process.cpuUsage();

  sample(): ResourceSample {
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage(this.cpuOrigin);
    const row: ResourceSample = {
      atMs: Date.now() - this.started,
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      cpuUserMs: cpu.user / 1000,
      cpuSystemMs: cpu.system / 1000,
    };
    this.samples.push(row);
    return row;
  }

  snapshot(): readonly ResourceSample[] {
    return this.samples.slice();
  }

  monotonicGrowth(thresholdBytes: number): { readonly flagged: boolean; readonly delta: number } {
    if (this.samples.length < 2) {
      return { flagged: false, delta: 0 };
    }
    const first = this.samples[0]!;
    const last = this.samples[this.samples.length - 1]!;
    const delta = last.rssBytes - first.rssBytes;
    return { flagged: delta > thresholdBytes, delta };
  }
}

export class ConnectionTracker {
  p2p = 0;
  rpc = 0;
  databasePools = 0;
  eventSubscriptions = 0;

  open(kind: keyof ConnectionSnapshot): void {
    this[kind] += 1;
  }

  close(kind: keyof ConnectionSnapshot): void {
    this[kind] = Math.max(0, this[kind] - 1);
  }

  snapshot(): ConnectionSnapshot {
    return {
      p2p: this.p2p,
      rpc: this.rpc,
      databasePools: this.databasePools,
      eventSubscriptions: this.eventSubscriptions,
    };
  }

  leaked(): boolean {
    return this.p2p > 0 || this.rpc > 0 || this.databasePools > 0 || this.eventSubscriptions > 0;
  }
}

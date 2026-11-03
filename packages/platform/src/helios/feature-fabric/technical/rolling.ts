/**
 * Rolling window helpers — deterministic, adapted from BYTEX RollingWindow semantics (Apache-2.0).
 */

export class RollingWindow {
  private readonly capacity: number;
  private readonly buffer: number[] = [];
  private head = 0;
  private count = 0;

  constructor(capacity: number) {
    if (capacity < 1) {
      throw new RangeError('RollingWindow capacity must be >= 1');
    }
    this.capacity = capacity;
  }

  get size(): number {
    return this.count;
  }

  get isFull(): boolean {
    return this.count >= this.capacity;
  }

  clear(): void {
    this.buffer.length = 0;
    this.head = 0;
    this.count = 0;
  }

  add(value: number): void {
    if (this.count < this.capacity) {
      this.buffer.push(value);
      this.count += 1;
      return;
    }
    this.buffer[this.head] = value;
    this.head = (this.head + 1) % this.capacity;
  }

  at(index: number): number {
    if (index < 0 || index >= this.count) {
      throw new RangeError('index out of range');
    }
    if (this.count < this.capacity) {
      const value = this.buffer[index];
      if (value === undefined) {
        throw new RangeError('missing buffer slot');
      }
      return value;
    }
    const start = this.head;
    const physical = (start + index) % this.capacity;
    const value = this.buffer[physical];
    if (value === undefined) {
      throw new RangeError('missing buffer slot');
    }
    return value;
  }

  average(): number {
    if (this.count === 0) {
      return 0;
    }
    let sum = 0;
    for (let i = 0; i < this.count; i += 1) {
      sum += this.at(i);
    }
    return sum / this.count;
  }

  standardDeviation(): number {
    if (this.count === 0) {
      return 0;
    }
    const mean = this.average();
    let variance = 0;
    for (let i = 0; i < this.count; i += 1) {
      const diff = this.at(i) - mean;
      variance += diff * diff;
    }
    variance /= this.count;
    return Math.sqrt(variance);
  }
}

export function minorToIndicatorPrice(minor: bigint): number {
  return Number(minor) / 10_000;
}

export function scaleIndicatorOutput(value: number): number {
  return Math.round(value * 10_000);
}

export function unscaleIndicatorOutput(scaled: number): number {
  return scaled / 10_000;
}

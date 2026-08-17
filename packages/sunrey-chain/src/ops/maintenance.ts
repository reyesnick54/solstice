import { opsErr, opsOk, type OpsResult } from './types.ts';

export class MaintenanceMode {
  #active = false;

  enable(): void {
    this.#active = true;
  }

  disable(): void {
    this.#active = false;
  }

  get active(): boolean {
    return this.#active;
  }

  assertWritable(action: string): OpsResult<true> {
    if (this.#active && action !== 'readiness' && action !== 'status') {
      return opsErr('MAINTENANCE_MODE', `node is in maintenance mode; refused ${action}`);
    }
    return opsOk(true);
  }
}

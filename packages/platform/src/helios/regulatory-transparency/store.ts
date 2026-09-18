import type {
  SupervisoryExportRequest,
  SupervisoryExportPackage,
  RegulatoryChangeRequest,
  PolicyVersionRecord,
  RegulatoryTransparencyStoreSnapshot,
  ScheduledActivation,
} from './types.ts';
import type { SupervisoryExportRequestId, SupervisoryExportPackageId, RegulatoryChangeRequestId, PolicyVersionRef } from './ids.ts';

export class InMemoryRegulatoryTransparencyStore {
  private readonly exportRequests = new Map<SupervisoryExportRequestId, SupervisoryExportRequest>();
  private readonly exportPackages = new Map<SupervisoryExportPackageId, SupervisoryExportPackage>();
  private readonly changeRequests = new Map<RegulatoryChangeRequestId, RegulatoryChangeRequest>();
  private readonly policyVersions = new Map<PolicyVersionRef, PolicyVersionRecord>();
  private readonly activatedVersionRefs = new Set<PolicyVersionRef>();
  private readonly scheduledActivations: ScheduledActivation[] = [];
  private readonly activationExecuted = new Set<RegulatoryChangeRequestId>();
  private readonly scheduleExecuted = new Set<RegulatoryChangeRequestId>();

  putExportRequest(request: SupervisoryExportRequest): void {
    this.exportRequests.set(request.exportRequestId, request);
  }

  getExportRequest(id: SupervisoryExportRequestId): SupervisoryExportRequest | null {
    return this.exportRequests.get(id) ?? null;
  }

  putExportPackage(pkg: SupervisoryExportPackage): void {
    this.exportPackages.set(pkg.packageId, pkg);
  }

  getExportPackage(id: SupervisoryExportPackageId): SupervisoryExportPackage | null {
    return this.exportPackages.get(id) ?? null;
  }

  putChangeRequest(request: RegulatoryChangeRequest): void {
    this.changeRequests.set(request.changeRequestId, request);
  }

  getChangeRequest(id: RegulatoryChangeRequestId): RegulatoryChangeRequest | null {
    return this.changeRequests.get(id) ?? null;
  }

  putPolicyVersion(version: PolicyVersionRecord): void {
    if (this.policyVersions.has(version.versionRef)) {
      const existing = this.policyVersions.get(version.versionRef)!;
      if (existing.contentHash !== version.contentHash) {
        throw new Error(`policy version ${version.versionRef} is immutable and cannot change meaning`);
      }
      return;
    }
    this.policyVersions.set(version.versionRef, version);
  }

  getPolicyVersion(ref: PolicyVersionRef): PolicyVersionRecord | null {
    return this.policyVersions.get(ref) ?? null;
  }

  markActivated(ref: PolicyVersionRef): void {
    this.activatedVersionRefs.add(ref);
  }

  isActivated(ref: PolicyVersionRef): boolean {
    return this.activatedVersionRefs.has(ref);
  }

  scheduleActivation(schedule: ScheduledActivation): void {
    this.scheduledActivations.push(schedule);
  }

  pendingScheduledActivations(): readonly ScheduledActivation[] {
    return Object.freeze(
      this.scheduledActivations.filter(
        (s) => !s.executed && !this.scheduleExecuted.has(s.changeRequestId),
      ),
    );
  }

  markActivationExecuted(changeRequestId: RegulatoryChangeRequestId): void {
    this.activationExecuted.add(changeRequestId);
    this.scheduleExecuted.add(changeRequestId);
  }

  wasActivationExecuted(changeRequestId: RegulatoryChangeRequestId): boolean {
    return this.activationExecuted.has(changeRequestId);
  }

  snapshot(): RegulatoryTransparencyStoreSnapshot {
    return Object.freeze({
      exportRequests: Object.freeze([...this.exportRequests.values()]),
      exportPackages: Object.freeze([...this.exportPackages.values()]),
      changeRequests: Object.freeze([...this.changeRequests.values()]),
      policyVersions: Object.freeze([...this.policyVersions.values()]),
      activatedVersionRefs: Object.freeze([...this.activatedVersionRefs]),
      scheduledActivations: Object.freeze(
        this.scheduledActivations.map((s) => Object.freeze({ ...s })),
      ),
    });
  }

  restore(snapshot: RegulatoryTransparencyStoreSnapshot): void {
    this.exportRequests.clear();
    this.exportPackages.clear();
    this.changeRequests.clear();
    this.policyVersions.clear();
    this.activatedVersionRefs.clear();
    this.scheduledActivations.length = 0;
    this.activationExecuted.clear();
    this.scheduleExecuted.clear();

    for (const request of snapshot.exportRequests) {
      this.exportRequests.set(request.exportRequestId, request);
    }
    for (const pkg of snapshot.exportPackages) {
      this.exportPackages.set(pkg.packageId, pkg);
    }
    for (const request of snapshot.changeRequests) {
      this.changeRequests.set(request.changeRequestId, request);
    }
    for (const version of snapshot.policyVersions) {
      this.policyVersions.set(version.versionRef, version);
    }
    for (const ref of snapshot.activatedVersionRefs) {
      this.activatedVersionRefs.add(ref);
    }
    for (const schedule of snapshot.scheduledActivations) {
      this.scheduledActivations.push(Object.freeze({ ...schedule }));
      if (schedule.executed) {
        this.activationExecuted.add(schedule.changeRequestId);
        this.scheduleExecuted.add(schedule.changeRequestId);
      }
    }
  }
}

import type { CustomerId } from '../../domain/src/customer.ts';
import type { WebAuthnChallenge, WebAuthnCredential, IdentitySession, RegisteredDevice } from './auth.ts';
import type { CapabilityGrant } from './capability.ts';
import type { KycRecord } from './kyc.ts';
import type { BusinessIdentity, PersonIdentity } from './model.ts';
import type { RecoveryRequest } from './recovery.ts';
import type { SolsticeIdentityId } from './ids.ts';

export type IdentitySnapshot = {
  readonly identities: readonly PersonIdentity[];
  readonly businesses: readonly BusinessIdentity[];
  readonly credentials: readonly WebAuthnCredential[];
  readonly challenges: readonly WebAuthnChallenge[];
  readonly sessions: readonly IdentitySession[];
  readonly devices: readonly RegisteredDevice[];
  readonly kycRecords: readonly KycRecord[];
  readonly grants: readonly CapabilityGrant[];
  readonly recoveries: readonly RecoveryRequest[];
  readonly customerLinks: readonly { readonly identityId: SolsticeIdentityId; readonly customerId: CustomerId }[];
};

export class IdentityStore {
  readonly identities = new Map<string, PersonIdentity>();
  readonly businesses = new Map<string, BusinessIdentity>();
  readonly credentials = new Map<string, WebAuthnCredential>();
  readonly challenges = new Map<string, WebAuthnChallenge>();
  readonly sessions = new Map<string, IdentitySession>();
  readonly devices = new Map<string, RegisteredDevice>();
  readonly kycRecords = new Map<string, KycRecord>();
  readonly grants = new Map<string, CapabilityGrant>();
  readonly recoveries = new Map<string, RecoveryRequest>();
  readonly customerByIdentity = new Map<string, CustomerId>();
  readonly identityByCustomer = new Map<string, SolsticeIdentityId>();
  readonly identityByActor = new Map<string, SolsticeIdentityId>();
  readonly sessionsByActor = new Map<string, string[]>();

  snapshot(): IdentitySnapshot {
    return Object.freeze({
      identities: Object.freeze([...this.identities.values()]),
      businesses: Object.freeze([...this.businesses.values()]),
      credentials: Object.freeze([...this.credentials.values()]),
      challenges: Object.freeze([...this.challenges.values()]),
      sessions: Object.freeze([...this.sessions.values()]),
      devices: Object.freeze([...this.devices.values()]),
      kycRecords: Object.freeze([...this.kycRecords.values()]),
      grants: Object.freeze([...this.grants.values()]),
      recoveries: Object.freeze([...this.recoveries.values()]),
      customerLinks: Object.freeze(
        [...this.customerByIdentity.entries()].map(([identityId, customerId]) =>
          Object.freeze({ identityId: identityId as SolsticeIdentityId, customerId }),
        ),
      ),
    });
  }

  hydrate(snapshot: IdentitySnapshot): void {
    this.identities.clear();
    this.businesses.clear();
    this.credentials.clear();
    this.challenges.clear();
    this.sessions.clear();
    this.devices.clear();
    this.kycRecords.clear();
    this.grants.clear();
    this.recoveries.clear();
    this.customerByIdentity.clear();
    this.identityByCustomer.clear();
    this.identityByActor.clear();
    this.sessionsByActor.clear();
    for (const identity of snapshot.identities) {
      this.identities.set(identity.id, identity);
    }
    for (const business of snapshot.businesses) {
      this.businesses.set(business.id, business);
    }
    for (const credential of snapshot.credentials) {
      this.credentials.set(credential.credentialId, credential);
    }
    for (const challenge of snapshot.challenges) {
      this.challenges.set(challenge.challengeId, challenge);
    }
    for (const session of snapshot.sessions) {
      this.sessions.set(session.sessionId, session);
      const list = this.sessionsByActor.get(session.actorId) ?? [];
      list.push(session.sessionId);
      this.sessionsByActor.set(session.actorId, list);
      this.identityByActor.set(session.actorId, session.subjectId);
    }
    for (const device of snapshot.devices) {
      this.devices.set(device.deviceId, device);
    }
    for (const record of snapshot.kycRecords) {
      this.kycRecords.set(record.id, record);
    }
    for (const grant of snapshot.grants) {
      this.grants.set(grant.grantId, grant);
    }
    for (const recovery of snapshot.recoveries) {
      this.recoveries.set(recovery.id, recovery);
    }
    for (const link of snapshot.customerLinks) {
      this.customerByIdentity.set(link.identityId, link.customerId);
      this.identityByCustomer.set(link.customerId, link.identityId);
    }
  }
}

import { err, ok, type Result } from '@solstice/domain';

export type SponsorId = string;

export type VerifiedSponsor = {
  readonly id: SponsorId;
  readonly legalName: string;
  readonly verified: true;
  readonly verificationRef: string;
};

export type UnverifiedSponsor = {
  readonly id: SponsorId;
  readonly legalName: string;
  readonly verified: false;
};

export type Sponsor = VerifiedSponsor | UnverifiedSponsor;

export function asVerifiedSponsor(input: {
  readonly id: SponsorId;
  readonly legalName: string;
  readonly verificationRef: string;
}): Result<VerifiedSponsor, { readonly code: 'UNVERIFIED_SPONSOR' }> {
  if (input.verificationRef.length === 0) {
    return err({ code: 'UNVERIFIED_SPONSOR' });
  }
  return ok(
    Object.freeze({
      id: input.id,
      legalName: input.legalName,
      verified: true as const,
      verificationRef: input.verificationRef,
    }),
  );
}

export function asUnverifiedSponsor(input: {
  readonly id: SponsorId;
  readonly legalName: string;
}): UnverifiedSponsor {
  return Object.freeze({
    id: input.id,
    legalName: input.legalName,
    verified: false as const,
  });
}

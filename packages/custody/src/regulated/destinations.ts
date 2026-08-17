export const REGULATED_DESTINATION_STATES = [
  'NEW',
  'VERIFICATION_REQUIRED',
  'APPROVED',
  'RESTRICTED',
  'REVOKED',
] as const;
export type RegulatedDestinationState = (typeof REGULATED_DESTINATION_STATES)[number];

export type BoundDestination = {
  readonly destinationId: string;
  readonly chainId: string;
  readonly networkId: string;
  readonly address: string;
  readonly state: RegulatedDestinationState;
  readonly approvedBinding: string | null;
};

export function destinationBinding(input: {
  readonly chainId: string;
  readonly networkId: string;
  readonly address: string;
}): string {
  return `${input.chainId}/${input.networkId}/${input.address}`;
}

export function registerDestination(input: {
  readonly destinationId: string;
  readonly chainId: string;
  readonly networkId: string;
  readonly address: string;
}): BoundDestination {
  return Object.freeze({
    destinationId: input.destinationId,
    chainId: input.chainId,
    networkId: input.networkId,
    address: input.address,
    state: 'NEW',
    approvedBinding: null,
  });
}

export function transitionDestination(
  current: BoundDestination,
  next: RegulatedDestinationState,
): BoundDestination {
  const approvedBinding =
    next === 'APPROVED' ? destinationBinding(current) : next === 'VERIFICATION_REQUIRED' ? null : current.approvedBinding;
  return Object.freeze({
    ...current,
    state: next,
    approvedBinding,
  });
}

export function destinationMatchesApproval(
  destination: BoundDestination,
  chainId: string,
  networkId: string,
  address: string,
): boolean {
  if (destination.state !== 'APPROVED' || destination.approvedBinding === null) {
    return false;
  }
  return destination.approvedBinding === destinationBinding({ chainId, networkId, address });
}

export type SecurityClock = {
  now(): string;
};

export const systemSecurityClock: SecurityClock = {
  now: () => new Date().toISOString(),
};

# Mobile secure storage

Platform-appropriate secure local storage holds:

- wallet key handle
- delegated session key
- authentication credential
- device registration credential

There is no plaintext backend export. Sync uses authenticated transport
and does not invent a custom encryption protocol.

Mobile biometric authentication may unlock local credential use according
to platform policy. Biometrics themselves do not leave the device through
SunRey APIs.

Clients or providers may supply a rooted / compromised device-risk
signal. It is one security input. Detection is not assumed to be perfect.
A revoked device still loses authenticated sync access according to
Chunk 96 trust policy.

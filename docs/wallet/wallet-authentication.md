# Wallet authentication

Application authentication is owned by the wallet security layer and
reuses Solstice Identity vocabulary (passkeys / WebAuthn-compatible
challenges, device authentication, approved MFA, recovery
authentication).

A passkey credential authenticates a user, device, or session. It is
never treated as the native blockchain private key.

`WalletAuthenticationPolicy.loginIsNotNativeSigning` is always `true`.
`WalletSession.grantsNativeSigning` is always `false`.

# Agent permissions

A `UserAgentMandate` binds agent ID, owner, wallet/account, environment,
action classes, assets, markets, quantity limits, budget, frequency,
destinations, risk policy, approval requirements, expiry, optional
delegated signing key, and revocation policy.

## Action classes

`READ_FINANCIAL_STATE`, `PREPARE_PAYMENT`, `EXECUTE_PREAPPROVED_PAYMENT`,
`PREPARE_EXCHANGE_ORDER`, `EXECUTE_BOUNDED_EXCHANGE_ORDER`,
`REBALANCE_WITHIN_POLICY`, `MANAGE_ALLOWED_PRODUCTIVE_SERVICE`,
`REQUEST_HUMAN_APPROVAL`.

## High-risk actions

New withdrawal destinations, wallet recovery, key rotation, changing the
agent's own mandate, transfers beyond limit, new regulated products, and
leverage/borrowing require direct human approval.

## Self-expansion

An agent cannot raise its budget, add an asset or destination, extend
expiry, change approval requirements, or create a master delegation.

## Assets and markets

Permissions are exact IDs. No wildcard unless explicitly configured
(`allowWildcardAssets: false` by default). Newly listed markets require
user/policy authorization.

## Destinations

Payments may be limited to trusted destinations, approved merchants,
approved machine/service identities, or specific addresses.

## Human Information

PDV / Human Information rights are separately permissioned. A generic
financial mandate does not grant raw PDV access.

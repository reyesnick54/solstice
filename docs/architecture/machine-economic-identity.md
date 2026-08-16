# Machine economic identity

Canonical types live at
`packages/sunrey-chain/src/machine-economy/types.ts`.

A versioned `MachineEconomicIdentity` includes:

- `machineId` / `actorId`
- `machineType` mapped to canonical `ActorType`
- owner, controller, optional operator
- hardware / software / firmware / model references
- CryptoSuite machine keys (`MACHINE_SIGNING` only)
- capability manifest
- approved assets
- spending mandate
- resource mandate
- jurisdiction and policy references
- activation, expiration, revocation, schema version

## Machine types

`AI_AGENT`, `ROBOT`, `DEVICE`, `AUTOMATED_SERVICE`, `COMPUTE_NODE`,
`PRODUCTIVE_MACHINE`, `SENSOR`, `VEHICLE_MACHINE`,
`INDUSTRIAL_MACHINE`.

Actor mapping:

| Machine type | ActorType |
| --- | --- |
| AI_AGENT | AI_AGENT |
| ROBOT | ROBOT |
| DEVICE | DEVICE |
| AUTOMATED_SERVICE | PRODUCTIVE_ASSET |
| COMPUTE_NODE | PRODUCTIVE_ASSET |
| PRODUCTIVE_MACHINE | PRODUCTIVE_ASSET |
| SENSOR | DEVICE |
| VEHICLE_MACHINE | ROBOT |
| INDUSTRIAL_MACHINE | PRODUCTIVE_ASSET |

## Status

`ACTIVE`, `RESTRICTED`, `SUSPENDED`, `REVOKED`.

Revocation blocks future actions. Finalized history remains. Outstanding
escrows enter `RECOVERY_HOLD` rather than disappearing. The controller
may rotate keys and recover the identity.

## Capabilities

Capabilities are granted by the controller. No capability means no
commerce. Supported values are the explicit purchase/sell pairs for
compute, energy, storage, bandwidth, goods, logistics, and services.

## Mandates

`MachineSpendingMandate` uses exact integer quantities: allowed
assets, per-transaction maximum, per-epoch maximum, outstanding
commitment maximum, counterparty classes, service categories,
purpose constraints, expiration, and approval threshold
(`AUTO_WITHIN_MANDATE`, `CONTROLLER_CONFIRMATION_REQUIRED`,
`MULTI_PARTY_APPROVAL_REQUIRED`, `DENIED`).

Protocol fees are included in mandate accounting. A machine cannot
bypass a limit by treating the fee as extra-mandate spend.

`MachineResourceMandate` uses `UnitRegistry` for nonfinancial
ceilings: compute, energy, bandwidth, storage, production
commitment, and delivery obligation.

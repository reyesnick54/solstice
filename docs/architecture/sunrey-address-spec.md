# SunRey Blockchain address specification

Format version: `1`

## Binary (canonical, 42 bytes)

| Offset | Size | Field |
| --- | --- | --- |
| 0 | 2 | Magic `SR` |
| 2 | 1 | Address version (`1`) |
| 3 | 1 | Network class (`1` development, `2` reserved test network, `3` reserved production) |
| 4 | 1 | Address class |
| 5 | 1 | Algorithm / address-version |
| 6 | 32 | SHA-256 payload of the public-key or account descriptor |
| 38 | 4 | SHA-256 checksum over domain `SUNREY-ADDR-V1` and bytes `0..38` |

Maximum binary length is 42 bytes.

## Text (canonical)

`{hrp}1{rfc4648-base32(version || class || algorithm || payload || checksum)}`

Human-readable prefixes:

- `srdev` — development (`net_sunrey_simulation`, `net_sunrey_local_dev`)
- `srtst` — reserved test class, including `net_sunrey_testnet_1` (SunRey Testnet 1)
- `srprd` — reserved future production network

Maximum text length is 90 characters.

## Address classes

`SINGLE_KEY_ACCOUNT`, `POLICY_ACCOUNT`, `MULTI_AUTH_ACCOUNT`,
`MACHINE_ACCOUNT`, `INSTITUTIONAL_ACCOUNT`, `WATCH_ONLY_ACCOUNT`.

Other classes are reserved for governed protocol upgrades.

## Algorithms

`ED25519_V1`, `HYBRID_SIM_V1`, `PQ_SIM_V1`. New algorithms are added by
CryptoSuite registration, not by creating a second wallet system.

## Rejection

- wrong network class versus expected network
- checksum mismatch
- unknown version / reserved class without an upgrade
- unknown algorithm

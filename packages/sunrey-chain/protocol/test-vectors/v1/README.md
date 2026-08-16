# Protocol v1 test vectors

Reusable fixtures for the TypeScript reference and later Rust node code.

`vectors.json` records expected rejection codes and the canonical
hex of the valid SunRey Coin transfer-shaped envelope.

Do not compute consensus hashes from this JSON file. Hash the
`signedBytesHex` / `unsignedBytesHex` protobuf payloads.

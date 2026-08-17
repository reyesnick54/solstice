# syntax=docker/dockerfile:1.7
# SunRey validator / seed node image. Simulation testnet only.
# Image pins: packages/sunrey-chain/supply-chain/image-pins.json
# Release builds must pass digest-qualified ARG values, not floating tags alone.
ARG RUST_IMAGE=docker.io/library/rust:1.83-bookworm
ARG DISTROLESS_CC_IMAGE=gcr.io/distroless/cc-debian12:nonroot
FROM ${RUST_IMAGE} AS build
WORKDIR /src
COPY packages/sunrey-chain/node /src/node
COPY packages/sunrey-chain/rust /src/rust
WORKDIR /src/node
RUN cargo build --release --bin sunrey-validator-node --locked

FROM ${DISTROLESS_CC_IMAGE}
ARG SOURCE_COMMIT=unknown
ARG PROTOCOL_VERSION=1
LABEL org.opencontainers.image.title="sunrey-node" \
      org.opencontainers.image.source="https://github.com/reyesnick54/solstice" \
      sunrey.protocol.version="${PROTOCOL_VERSION}" \
      sunrey.source.commit="${SOURCE_COMMIT}" \
      sunrey.network="net_sunrey_testnet_1" \
      sunrey.environment="simulation"
COPY --from=build /src/node/target/release/sunrey-validator-node /usr/local/bin/sunrey-node
USER nonroot
EXPOSE 26656 26657
HEALTHCHECK --interval=30s --timeout=5s CMD ["/usr/local/bin/sunrey-node", "--help"]
ENTRYPOINT ["/usr/local/bin/sunrey-node"]

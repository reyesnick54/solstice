# syntax=docker/dockerfile:1.7
# SunRey validator / seed node image. Simulation testnet only.
FROM rust:1.83-bookworm AS build
WORKDIR /src
COPY packages/sunrey-chain/node /src/node
COPY packages/sunrey-chain/rust /src/rust
WORKDIR /src/node
RUN cargo build --release --bin sunrey-validator-node --locked || cargo build --release --bin sunrey-validator-node

FROM gcr.io/distroless/cc-debian12:nonroot
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

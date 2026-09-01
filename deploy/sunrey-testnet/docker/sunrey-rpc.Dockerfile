# syntax=docker/dockerfile:1.7
# Image pins: packages/sunrey-chain/supply-chain/image-pins.json
ARG RUST_IMAGE=docker.io/library/rust:1.83-bookworm
ARG DISTROLESS_CC_IMAGE=gcr.io/distroless/cc-debian12:nonroot
FROM ${RUST_IMAGE} AS build
WORKDIR /src
COPY packages/sunrey-chain/rust /src/rust
COPY packages/sunrey-chain/schemas /src/schemas
WORKDIR /src/rust
RUN cargo build --release -p sunrey-rpc --bin sunrey-node --locked

FROM ${DISTROLESS_CC_IMAGE}
ARG SOURCE_COMMIT=unknown
ARG PROTOCOL_VERSION=1
LABEL org.opencontainers.image.title="sunrey-rpc" \
      sunrey.protocol.version="${PROTOCOL_VERSION}" \
      sunrey.source.commit="${SOURCE_COMMIT}" \
      sunrey.environment="simulation"
COPY --from=build /src/rust/target/release/sunrey-node /usr/local/bin/sunrey-rpc
USER nonroot
EXPOSE 26657
HEALTHCHECK --interval=30s --timeout=5s CMD ["/usr/local/bin/sunrey-rpc", "--help"]
ENTRYPOINT ["/usr/local/bin/sunrey-rpc"]

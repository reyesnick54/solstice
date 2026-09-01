# syntax=docker/dockerfile:1.7
# Image pins: packages/sunrey-chain/supply-chain/image-pins.json
ARG RUST_IMAGE=docker.io/library/rust:1.83-bookworm
ARG DISTROLESS_CC_IMAGE=gcr.io/distroless/cc-debian12:nonroot
FROM ${RUST_IMAGE} AS build
WORKDIR /src
COPY packages/sunrey-chain/node /src/node
COPY packages/sunrey-chain/rust /src/rust
COPY packages/sunrey-chain/schemas /src/schemas
WORKDIR /src/node
RUN cargo build --release --bin sunrey-relayer --locked

FROM ${DISTROLESS_CC_IMAGE}
ARG SOURCE_COMMIT=unknown
LABEL org.opencontainers.image.title="sunrey-relayer" \
      sunrey.source.commit="${SOURCE_COMMIT}" \
      sunrey.environment="simulation"
COPY --from=build /src/node/target/release/sunrey-relayer /usr/local/bin/sunrey-relayer
USER nonroot
HEALTHCHECK --interval=30s --timeout=5s CMD ["/usr/local/bin/sunrey-relayer", "--help"]
ENTRYPOINT ["/usr/local/bin/sunrey-relayer"]

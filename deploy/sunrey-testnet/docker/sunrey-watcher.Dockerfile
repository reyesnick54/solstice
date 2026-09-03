# syntax=docker/dockerfile:1.7
ARG RUST_IMAGE=docker.io/library/rust:1.83-bookworm
ARG DISTROLESS_CC_IMAGE=gcr.io/distroless/cc-debian12:nonroot
FROM ${RUST_IMAGE} AS build
WORKDIR /src
COPY packages/sunrey-chain/node /src/node
COPY packages/sunrey-chain/rust /src/rust
WORKDIR /src/rust
RUN cargo build --release -p sunrey-interop --bin sunrey-watcher --locked

FROM ${DISTROLESS_CC_IMAGE}
ARG SOURCE_COMMIT=unknown
LABEL org.opencontainers.image.title="sunrey-watcher" \
      sunrey.source.commit="${SOURCE_COMMIT}" \
      sunrey.environment="simulation" \
      sunrey.service.role="WATCHER"
COPY --from=build /src/rust/target/release/sunrey-watcher /usr/local/bin/sunrey-watcher
USER nonroot
HEALTHCHECK --interval=30s --timeout=5s CMD ["/usr/local/bin/sunrey-watcher", "--help"]
ENTRYPOINT ["/usr/local/bin/sunrey-watcher"]

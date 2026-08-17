# syntax=docker/dockerfile:1.7
FROM rust:1.83-bookworm AS build
WORKDIR /src
COPY packages/sunrey-chain/node /src/node
COPY packages/sunrey-chain/rust /src/rust
WORKDIR /src/node
RUN cargo build --release --bin sunrey-relayer

FROM gcr.io/distroless/cc-debian12:nonroot
ARG SOURCE_COMMIT=unknown
LABEL org.opencontainers.image.title="sunrey-relayer" \
      sunrey.source.commit="${SOURCE_COMMIT}" \
      sunrey.environment="simulation"
COPY --from=build /src/node/target/release/sunrey-relayer /usr/local/bin/sunrey-relayer
USER nonroot
HEALTHCHECK --interval=30s --timeout=5s CMD ["/usr/local/bin/sunrey-relayer", "--help"]
ENTRYPOINT ["/usr/local/bin/sunrey-relayer"]

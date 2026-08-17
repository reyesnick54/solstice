# syntax=docker/dockerfile:1.7
FROM rust:1.83-bookworm AS build
WORKDIR /src
COPY packages/sunrey-chain/rust /src/rust
WORKDIR /src/rust
RUN cargo build --release -p sunrey-rpc --bin sunrey-node

FROM gcr.io/distroless/cc-debian12:nonroot
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

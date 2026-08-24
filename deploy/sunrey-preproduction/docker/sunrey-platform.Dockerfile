# syntax=docker/dockerfile:1.7
# Image pins: packages/sunrey-chain/supply-chain/image-pins.json
ARG NODE_IMAGE=docker.io/library/node:22-bookworm-slim
FROM ${NODE_IMAGE}
ARG SOURCE_COMMIT=unknown
ARG SERVICE=api
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages ./packages
COPY services ./services
COPY scripts ./scripts
COPY db ./db
RUN useradd --uid 65532 --create-home --shell /usr/sbin/nologin sunrey \
  && chown -R 65532:65532 /app
USER 65532
ENV SUNREY_SERVICE=${SERVICE}
ENV ENVIRONMENT=simulation
ENV PRODUCTION_AUTHORIZED=false
ENV SUNREY_API_HOST=0.0.0.0
ENV SUNREY_API_PORT=8443
LABEL org.opencontainers.image.title="sunrey-platform" \
      sunrey.service="${SERVICE}" \
      sunrey.source.commit="${SOURCE_COMMIT}" \
      sunrey.environment="simulation"
EXPOSE 8443
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:8443/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
ENTRYPOINT ["node", "--experimental-strip-types", "--disable-warning=ExperimentalWarning"]
CMD ["services/api/src/preview-main.ts"]

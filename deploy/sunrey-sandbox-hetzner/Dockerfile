# syntax=docker/dockerfile:1.7
# SunRey Simulation RC2 — Hetzner sandbox Consumer BFF image.
ARG NODE_IMAGE=docker.io/library/node:22-bookworm-slim
FROM ${NODE_IMAGE}
ARG SOURCE_COMMIT=unknown
WORKDIR /app
RUN apt-get update \
  && apt-get install --no-install-recommends --yes curl \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --uid 65532 --create-home --shell /usr/sbin/nologin sunrey
COPY package.json package-lock.json ./
COPY packages ./packages
COPY services ./services
COPY apps ./apps
COPY tools ./tools
COPY scripts ./scripts
COPY db ./db
RUN npm ci --ignore-scripts
RUN chown -R 65532:65532 /app
USER 65532
ENV ENVIRONMENT=simulation
ENV PRODUCTION_AUTHORIZED=false
ENV SUNREY_API_HOST=0.0.0.0
ENV SUNREY_API_PORT=8443
LABEL org.opencontainers.image.title="sunrey-sandbox-bff" \
      sunrey.service="consumer-bff" \
      sunrey.source.commit="${SOURCE_COMMIT}" \
      sunrey.environment="simulation"
EXPOSE 8443
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8443/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
ENTRYPOINT ["node", "--experimental-strip-types", "--disable-warning=ExperimentalWarning"]
CMD ["services/api/src/preview-main.ts"]

# syntax=docker/dockerfile:1.7
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
RUN apt-get update \
  && apt-get install --no-install-recommends --yes curl \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --uid 65532 --create-home --shell /usr/sbin/nologin sunrey
RUN npm ci --ignore-scripts \
  && chown -R 65532:65532 /app
USER 65532
ENV SUNREY_SERVICE=${SERVICE}
ENV ENVIRONMENT=simulation
ENV PRODUCTION_AUTHORIZED=false
ENV SUNREY_API_HOST=0.0.0.0
ENV SUNREY_API_PORT=8080
# Cloud Run preview has no colocated PostgreSQL; DURABLE mode crashes before bind.
ENV SUNREY_PRODUCT_INTEGRATION_MODE=IN_MEMORY
LABEL org.opencontainers.image.title="sunrey-platform" \
      sunrey.service="${SERVICE}" \
      sunrey.source.commit="${SOURCE_COMMIT}" \
      sunrey.environment="simulation"
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD ["node", "-e", "fetch('http://127.0.0.1:8080/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
ENTRYPOINT ["sh", "-c"]
CMD ["SUNREY_PRODUCT_INTEGRATION_MODE=IN_MEMORY exec node --experimental-strip-types --disable-warning=ExperimentalWarning services/api/src/preview-main.ts"]

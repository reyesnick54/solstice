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
RUN useradd --uid 65532 --create-home --shell /usr/sbin/nologin sunrey \
  && chown -R 65532:65532 /app
USER 65532
ENV SUNREY_SERVICE=${SERVICE}
ENV ENVIRONMENT=simulation
ENV PRODUCTION_AUTHORIZED=false
ENV SUNREY_API_HOST=0.0.0.0
ENV SUNREY_API_PORT=8080
LABEL org.opencontainers.image.title="sunrey-platform" \
      sunrey.service="${SERVICE}" \
      sunrey.source.commit="${SOURCE_COMMIT}" \
      sunrey.environment="simulation"
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD ["node", "-e", "fetch('http://127.0.0.1:8080/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
ENTRYPOINT ["node", "--experimental-strip-types", "--disable-warning=ExperimentalWarning"]
CMD ["services/api/src/preview-main.ts"]

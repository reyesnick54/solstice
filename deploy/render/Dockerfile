# syntax=docker/dockerfile:1.7
# SunRey sandbox Consumer BFF on Render (simulation only).
ARG NODE_IMAGE=docker.io/library/node:22-bookworm-slim
FROM ${NODE_IMAGE}
WORKDIR /app
RUN apt-get update \
  && apt-get install --no-install-recommends --yes ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --uid 65532 --create-home --shell /usr/sbin/nologin sunrey
COPY package.json package-lock.json ./
COPY packages ./packages
COPY services ./services
COPY apps ./apps
COPY tools ./tools
COPY scripts ./scripts
COPY db ./db
COPY config ./config
COPY deploy/render/start.sh ./deploy/render/start.sh
RUN npm ci --ignore-scripts \
  && chmod 0755 ./deploy/render/start.sh \
  && chown -R 65532:65532 /app
USER 65532
ENV ENVIRONMENT=simulation
ENV PRODUCTION_AUTHORIZED=false
ENV SUNREY_API_HOST=0.0.0.0
# Port comes from Render's PORT variable (preview-main reads SUNREY_API_PORT ?? PORT).
LABEL org.opencontainers.image.title="sunrey-sandbox-bff-render" \
      sunrey.service="consumer-bff" \
      sunrey.environment="simulation"
EXPOSE 10000
ENTRYPOINT ["/app/deploy/render/start.sh"]

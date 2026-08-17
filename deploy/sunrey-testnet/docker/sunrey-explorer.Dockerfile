# syntax=docker/dockerfile:1.7
# Image pins: packages/sunrey-chain/supply-chain/image-pins.json
# Runtime has no npm/apt and no development secrets.
ARG NODE_IMAGE=docker.io/library/node:22-bookworm-slim
FROM ${NODE_IMAGE}
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/sunrey-chain ./packages/sunrey-chain
COPY packages/security ./packages/security
COPY packages/evidence ./packages/evidence
RUN rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
 && rm -rf /usr/local/lib/node_modules/npm /root/.npm
USER node
ENV NODE_ENV=production
ENV SUNREY_FIXTURE_ENV=local
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "process.exit(0)"
LABEL org.opencontainers.image.title="sunrey-explorer" \
      sunrey.banner="SUNREY TESTNET" \
      sunrey.environment="simulation"
CMD ["node", "--experimental-strip-types", "packages/sunrey-chain/src/testnet/demo.ts"]

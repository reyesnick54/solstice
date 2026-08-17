# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/sunrey-chain ./packages/sunrey-chain
COPY packages/security ./packages/security
USER node
ENV SUNREY_FIXTURE_ENV=local
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "process.exit(0)"
LABEL org.opencontainers.image.title="sunrey-faucet" \
      sunrey.environment="simulation"
CMD ["node", "--experimental-strip-types", "packages/sunrey-chain/src/testnet/demo.ts"]

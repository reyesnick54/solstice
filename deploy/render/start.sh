#!/bin/sh
# SunRey sandbox BFF on Render.
#
# Render injects SUNREY_DATABASE_URL (the managed Postgres internal connection
# string). The persistence layer takes host/port/bootstrap credentials as
# separate variables, so derive them here, then: bootstrap roles and the four
# bounded-domain databases (idempotent), apply migrations, and start the BFF.
# ENVIRONMENT stays simulation; no LIVE_* flag is set anywhere in this file.
set -eu

NODE="node --experimental-strip-types --disable-warning=ExperimentalWarning"

if [ -n "${SUNREY_DATABASE_URL:-}" ]; then
  eval "$(node -e '
    const u = new URL(process.env.SUNREY_DATABASE_URL);
    const q = (v) => "'\''" + String(v).replace(/'\''/g, "'\''\\'\'''\''") + "'\''";
    const out = {
      SUNREY_PG_HOST: u.hostname,
      SUNREY_PG_PORT: u.port || "5432",
      SUNREY_PG_BOOTSTRAP_USER: decodeURIComponent(u.username),
      SUNREY_PG_BOOTSTRAP_PASSWORD: decodeURIComponent(u.password),
    };
    for (const [k, v] of Object.entries(out)) console.log(`export ${k}=${q(v)}`);
  ')"
fi

export SUNREY_BUILD_GIT_SHA="${RENDER_GIT_COMMIT:-${SUNREY_BUILD_GIT_SHA:-unknown}}"
export SUNREY_SOURCE_COMMIT="${SUNREY_BUILD_GIT_SHA}"

echo '{"level":"info","service":"sunrey-render-start","message":"bootstrap"}'
$NODE scripts/postgres-bootstrap.mjs
echo '{"level":"info","service":"sunrey-render-start","message":"migrate"}'
$NODE scripts/postgres-migrate.mjs
echo '{"level":"info","service":"sunrey-render-start","message":"start bff"}'
exec $NODE services/api/src/preview-main.ts

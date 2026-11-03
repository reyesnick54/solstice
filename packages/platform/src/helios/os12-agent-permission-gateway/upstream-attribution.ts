/**
 * Seris (Apache-2.0) pattern attribution — runtime/tool/gateway/session ideas only.
 * Desktop application code is intentionally not imported.
 *
 * Upstream: https://github.com/aowang-ai/seris
 * Reference: f73dbbb0cd7e3b52601abf905bb871cdb9098550
 */
export const HELIOS_OS12_SERIS_UPSTREAM = Object.freeze({
  repository: 'aowang-ai/seris',
  referenceSha: 'f73dbbb0cd7e3b52601abf905bb871cdb9098550',
  license: 'Apache-2.0',
  adaptedSurfaces: Object.freeze([
    'explicit tool allow-lists (runtime/activeTools)',
    'per-session tool selection persistence (runtime/sessionStore ToolSelection)',
    'provider-neutral model factory metadata (loop/modelFactory)',
    'research-only autopilot safety floor (autopilot/engine)',
  ]),
});

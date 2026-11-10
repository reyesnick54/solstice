// Development fallback. build.mjs overwrites this file in dist/ with the
// environment-specific configuration.
export const CONFIG = Object.freeze({
  apiBase: 'http://127.0.0.1:8443',
  explorerUrl: '',
  environmentLabel: 'Sandbox',
  release: 'source',
  builtAt: null,
});

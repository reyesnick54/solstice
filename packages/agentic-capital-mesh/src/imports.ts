/**
 * Shared cross-package imports for agentic-capital-mesh submodules.
 * Subdirectories import through this file to avoid extra ../ depth in boundary lint.
 */
export { err, ok, type Result } from '../../domain/src/result.ts';
export type { UtcInstant } from '../../domain/src/time.ts';
export type { Clock } from '../../config/src/clock.ts';

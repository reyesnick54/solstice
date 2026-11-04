/**
 * Shared cross-package imports for agentic-capital-mesh submodules.
 * Subdirectories import through this file to avoid extra ../ depth in boundary lint.
 */
export { err, ok, type Result } from '@solstice/domain';
export type { UtcInstant } from '@solstice/domain';
export type { Clock } from '@solstice/config';

/**
 * Initialization-marker detection (task-003-git-backed-sot, REQ-SYS-01, spec-011-storage-layout
 * "Initialization-marker detection algorithm"). Intentionally shallow — top-level non-emptiness
 * only; deep validation of individual pillar files is each pillar's own schema-load responsibility
 * (REQ-SYS-02), not this check's job.
 */
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

/** The three states a project can be in relative to WingFoil initialization (spec-011). */
export type InitState = 'absent' | 'incomplete' | 'initialized';

/**
 * Detect whether `root` (a resolved project root — see {@link resolveProjectRoot} in
 * `./git-root`) is already WingFoil-initialized: `.wingfoil/` must exist AND contain at least one
 * entry. No other marker file is consulted.
 */
export function detectInitState(root: string): InitState {
  const wingfoilDir = join(root, '.wingfoil');
  if (!existsSync(wingfoilDir)) return 'absent';
  const entries = readdirSync(wingfoilDir);
  return entries.length > 0 ? 'initialized' : 'incomplete';
}

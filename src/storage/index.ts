/**
 * `storage` module — git-backed file storage (YAML + Markdown); single source of truth
 * (REQ-SYS-01, task-003-git-backed-sot). Single entry point for: resolving the WingFoil project
 * root, detecting initialization state, rendering a Memory type's `path` pattern
 * (spec-001-memory-yaml-schema) against concrete values, reading/writing document bytes, and
 * computing the whole-project state snapshot the REQ-SYS-01 fit criterion is stated in terms of.
 */
export const MODULE_NAME = 'storage' as const;

export { StorageError, E_NO_GIT_ROOT, E_NOT_AT_GIT_ROOT, E_MISSING_PATH_VALUE } from './errors';
export { findGitRoot, resolveProjectRoot } from './git-root';
export { detectInitState } from './init-state';
export type { InitState } from './init-state';
export { renderMemoryPath, resolveMemoryPath } from './memory-path';
export { extractFrontmatter } from './frontmatter';
export { readDocument, documentExists, writeDocument } from './document';
export { computeStateSnapshot, serializeSnapshot } from './snapshot';
export type { SnapshotEntry } from './snapshot';

/**
 * Plain document read/write (task-003-git-backed-sot, REQ-SYS-01). Every Memory/DNA/Directives/
 * Workflow mutation is a regular file write with no side-channel state — no `.wingfoil/state/`
 * index (REQ-SYS-03), no cache file that isn't itself just a copy of what's already on disk.
 * `git add`/`git commit` of the result is the caller's job (dev-loop's commit conventions, CLAUDE.md
 * §5.1) — this module only owns the bytes at an already-resolved absolute path (see
 * `./memory-path`).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';

/** Read a document's full contents as UTF-8 text. */
export function readDocument(absolutePath: string): string {
  return readFileSync(absolutePath, 'utf-8');
}

/** Whether a document exists at `absolutePath`. */
export function documentExists(absolutePath: string): boolean {
  return existsSync(absolutePath);
}

/**
 * Write `content` to `absolutePath`, creating any missing parent directories. No other file or
 * directory is created or touched — the write is exactly this one path, nothing else.
 */
export function writeDocument(absolutePath: string, content: string): void {
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content, 'utf-8');
}

/**
 * Immutable built-in assets pre-flight check (REQ-SEC-07, spec-011-storage-layout's
 * `{built-in,custom}` split — task-042-immutable-builtin-assets).
 *
 * `directives/{built-in,custom}/` and `workflows/{built-in,custom}/` share the exact same structural
 * contract (spec-011 §"`directives/{built-in,custom}/` split" / §"`workflows/{built-in,custom}/`
 * split"): `built-in/` is reserved for the official templates shipped by the `wingfoil` npm package
 * (empty today, `.gitkeep` only) and only a file under `custom/` may ever be removed. Classification
 * is purely **structural** — which subdirectory currently holds the file — not the directive
 * frontmatter's own `kind:` field: spec-011 is explicit that promoting a stand-in from `custom/` to
 * `built-in/` is what makes it protected, independent of any other metadata, so a path-based check is
 * the single source of truth for both pillars.
 *
 * This lives in `src/core` (not `src/directives`/`src/workflow`) because REQ-SEC-07 crosscuts both
 * pillars identically and both the CLI and MCP surfaces must enforce it the same way (REQ-SYS-05) —
 * the same reasoning `requireGitIdentity` (REQ-SEC-01, task-014) already established for a
 * cross-cutting mutating-op pre-flight. Neither `directive remove` nor `workflow remove` exists yet
 * in `CORE_MODULES` (spec-006 §3 reserves both as future `mutates: true` operations); per the same
 * precedent (task-014, task-016), this task delivers the shared, fully-tested primitive now and
 * defers wiring it into the actual mutating op to the dependent task (task-052-directive-remove for
 * `directive.remove`; a future task for `workflow.remove`).
 */
import { coreErr, coreOk, type CoreResult } from './types';

/** The two pillars REQ-SEC-07 protects — `built-in/` is immutable in both (spec-011). */
export type AssetKind = 'directive' | 'workflow';

/** The spec-011 subdirectory name reserved for official, npm-shipped templates. */
const BUILT_IN_SEGMENT = 'built-in';

/**
 * True when `relativePath` (POSIX-separated, relative to `.wingfoil/`, e.g.
 * `directives/built-in/testing.md` or `workflows/custom/arch-review.yaml`) falls under a `built-in/`
 * subdirectory — a full path SEGMENT match, so a filename that merely contains the substring
 * `built-in` (e.g. `directives/custom/built-in-notes.md`) is not mistaken for a protected asset. Pure
 * predicate — no filesystem access, no wall-clock/randomness (REQ-SYS-07).
 */
export function isBuiltInAssetPath(relativePath: string): boolean {
  return relativePath.split('/').includes(BUILT_IN_SEGMENT);
}

/**
 * REQ-SEC-07 pre-flight: refuse to remove a built-in `directive`/`workflow`. Mirrors
 * `requireGitIdentity`'s shape exactly (`CoreResult<void>`, safe to call before any read/write) —
 * intended as the FIRST check `directiveRemove`/`workflowRemove` run, before any reference/usage
 * check, so a built-in asset is rejected on structure alone regardless of whether it happens to also
 * be referenced. Returns a `CONFLICT` `CoreResult.error` (exit 1 via `exitCodeForError`) carrying the
 * exact REQ-SEC-07 fit-criterion wording ("built-in directives cannot be removed" / "built-in
 * workflows cannot be removed" — do not reword, the BDD scenarios assert it verbatim); otherwise `ok`.
 */
export function requireCustomAsset(kind: AssetKind, relativePath: string): CoreResult<void> {
  if (isBuiltInAssetPath(relativePath)) {
    return coreErr({ code: 'CONFLICT', message: `built-in ${kind}s cannot be removed` });
  }
  return coreOk<void>(undefined);
}

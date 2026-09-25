/**
 * Storage confinement — **the one place that decides whether a path is inside the project root**
 * (REQ-SEC-06, `task-017-storage-confinement`; extended to the filesystem by `task-102` for
 * `bug-044-symlinked-directives-custom-escapes-confinement`).
 *
 * `resolveConfinedMemoryPath` (`./memory-path.ts`) shipped that boundary first, but only over a
 * rendered Memory-path *pattern* and only **textually**: `resolve` + `relative`. Textual resolution
 * answers a different question from the filesystem's. `.wingfoil/directives/custom/legacy-rule.md`
 * has no traversal in it and every segment is inside the project — and when `custom` is a symlink to
 * a directory elsewhere, the file it names is not in the project at all. `src/core/builtin-asset.ts`
 * predicted exactly this when it refused to normalise `.`/`..` textually: "a symlinked `custom/`
 * aliasing `built-in/` defeats any string-level normalisation".
 *
 * So the predicate lives here and `resolveConfinedMemoryPath` calls it, rather than a second
 * boundary check being written next to it — two places deciding confinement is how a guarantee
 * becomes a suggestion. {@link escapesRoot} is the decision; {@link resolveRealPathInRoot} is the
 * filesystem-resolving entry point a caller uses when the path names a real file on disk.
 *
 * Both are deterministic (REQ-SYS-07): no wall clock, no randomness, no unordered iteration — only
 * `path` arithmetic and `realpathSync`, whose answer is a property of the filesystem.
 */
import { realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

/**
 * True when `target` is **not strictly inside** `resolvedRoot` — the root itself (a mutating op's
 * target is a file *within* the project, never the project), a climb above it, or an unrelated
 * absolute path. Both arguments must already be absolute; nothing here touches the filesystem.
 */
export function escapesRoot(resolvedRoot: string, target: string): boolean {
  const rel = relative(resolvedRoot, target);
  return rel.length === 0 || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel);
}

/**
 * The real location of `directory`, following symlinks as far as the filesystem actually goes and
 * keeping the not-yet-existing tail verbatim.
 *
 * `realpathSync` throws `ENOENT` for a path that does not exist, which would make a confinement
 * check fail differently depending on whether the caller's target had been created yet — a guard
 * must answer the same question either way. Walking up to the nearest existing ancestor is the
 * resolution the filesystem itself would give once the missing directories were created.
 */
function realpathOfDirectory(directory: string): string {
  const pending: string[] = [];
  let current = resolve(directory);
  for (;;) {
    try {
      return join(realpathSync(current), ...pending);
    } catch {
      const parent = dirname(current);
      // `dirname` is its own fixed point at the filesystem root: nothing above it left to resolve.
      if (parent === current) return join(current, ...pending);
      pending.unshift(basename(current));
      current = parent;
    }
  }
}

/** What {@link resolveRealPathInRoot} found out about a path. */
export interface RealPathResolution {
  /** The textual resolution under the root — what a prefix check would have compared. */
  readonly absolute: string;
  /** The filesystem resolution: the target's real parent directory, plus the target's own name. */
  readonly real: string;
  /** Whether {@link real} is strictly inside the (itself real-resolved) root. */
  readonly within: boolean;
}

/**
 * Resolve `relativePath` under `root` **on the filesystem** and report whether the result is still
 * inside the project. The root is real-resolved too, so a project that itself lives under a
 * symlinked path (a `/tmp` that is a link to `/private/tmp`, a home directory reached through one)
 * does not read as its own escape.
 *
 * **The target's parent is resolved; the target's own name is not** — and that asymmetry is the
 * contract, not an oversight. A directive that is a **symlinked file** inside a real directory is
 * removable and must stay so: `unlink` removes the link, the target survives, and git stages the
 * link as an ordinary blob. It is reaching *through* a symlinked **directory** that leaves the
 * project — that is the file git itself refuses to stage ("beyond a symbolic link") and the one
 * whose deletion lands outside the root. Resolving the leaf as well would turn a working removal
 * into a refusal without protecting anything.
 *
 * @param root - The project root; need not be real-resolved by the caller.
 * @param relativePath - A root-relative path (an absolute one is honoured as given, and then judged
 *   by the same boundary).
 */
export function resolveRealPathInRoot(root: string, relativePath: string): RealPathResolution {
  const realRoot = realpathOfDirectory(root);
  const absolute = resolve(realRoot, relativePath);
  const real = join(realpathOfDirectory(dirname(absolute)), basename(absolute));
  return { absolute, real, within: !escapesRoot(realRoot, real) };
}

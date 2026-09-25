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
 * {@link targetIsSymlink} (task-106, `bug-120`) is a **different question** kept in the same module
 * because it is asked in the same breath: not *where does this path lead* but *would the syscall
 * land on this path at all*. It is asked only by callers whose syscall follows links — a write —
 * and never by a delete, which acts on the link and must go on doing so.
 *
 * All three are deterministic (REQ-SYS-07): no wall clock, no randomness, no unordered iteration —
 * only `path` arithmetic, `realpathSync` and `lstatSync`, whose answers are properties of the
 * filesystem.
 */
import { lstatSync, realpathSync } from 'node:fs';
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
 * whose deletion lands outside the root.
 *
 * **That reasoning is a deletion's, and this function has write callers too.** For `unlinkSync` it
 * holds entire: resolving the leaf would turn a working removal into a refusal protecting nothing.
 * `task-105` added two **write** consumers — `resolveConfinedMemoryPath` (`./memory-path.ts`) and
 * `requireConfinedTarget` inside `commitMemoryTransition` (`../core/memory-transition.ts`) — and
 * `writeFileSync` **follows** a symlinked leaf where `unlinkSync` acts on it, which put bytes
 * outside the root on both of them (`bug-120-a-symlinked-document-leaf-is-followed-by-the-write`).
 *
 * That is answered **beside** this function rather than inside it, by `task-106`: the write paths
 * ask {@link targetIsSymlink} as well, and refuse a symlinked target outright. This function is
 * unchanged, so the delete path is unchanged with it — a wider boundary here would have red exactly
 * the `bug-044` case the paragraph above exists to keep working. So the asymmetry is read per verb:
 * resolve the parent everywhere, refuse a symlinked leaf where the syscall would follow it.
 * `dl-086` carries the argument about which state a guard over a filesystem effect may read.
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

/**
 * True when `target`'s **own name** is a symbolic link — the question a write must ask and a delete
 * must not (task-106, `bug-120-a-symlinked-document-leaf-is-followed-by-the-write`).
 *
 * `writeFileSync` follows a symlinked leaf: the bytes land at the link's destination, not at the
 * path the operation named, and {@link resolveRealPathInRoot} does not see it because it resolves
 * the parent and keeps the basename. `unlinkSync` is the opposite — it acts on the link — so the
 * same input is a defect for one verb and correct behaviour for the other (`bug-044`'s benign case).
 * Hence a separate predicate, asked only where the syscall follows links, rather than a wider
 * boundary that would decide both.
 *
 * **`lstat`, not `exists`.** `existsSync` follows links and is therefore **false** for a dangling
 * one, which is how `requireAbsentTarget` (`../core/write-guard.ts`) read an occupied path as free
 * and let `memory add` write through it and commit (`bug-120` D1). `lstatSync` inspects the link
 * itself and answers `true`. Its `ENOENT` — nothing at the path at all, the ordinary case for a
 * document about to be created — is the one failure absorbed here, along with any other `lstat`
 * error: a path this cannot inspect is not a link it can report, and every caller has already
 * decided confinement separately.
 *
 * **Not an adversarial defence, and the window is real.** Node's `fs` exposes no `O_NOFOLLOW` on a
 * path-based API, so nothing closes the gap between this check and the write that follows it; only
 * file-descriptor primitives (`openat`) would. `dl-086` names the same limit for the delete path.
 * What this converts is a routine, self-inflicted loss — a store aliased into shared space, a
 * document linked into a folder — into a refusal.
 *
 * @param target - An absolute path. Only its own name is inspected; links on the way to it are the
 *   confinement boundary's business ({@link resolveRealPathInRoot}), not this predicate's.
 */
export function targetIsSymlink(target: string): boolean {
  try {
    return lstatSync(target).isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * The refusal a write path returns for a symlinked target — one sentence, one place, so the
 * `StorageError` `memory add` raises and the `CoreResult` the transition verbs return cannot drift
 * apart on what the rule is (task-106).
 *
 * It names the path and says the target is a link, and it deliberately does **not** name where the
 * link points: {@link targetIsSymlink} refuses without resolving, and a message quoting a
 * destination would imply the guard had judged it. No child-process text goes anywhere near it
 * (`bug-071`/`bug-093`).
 *
 * @param action - The verb for the first clause, e.g. `'write'` → `cannot write '<path>'`, the
 *   message shape `requireConfinedTarget` and `requireCustomAsset` already use.
 * @param path - The path as the operation named it, root-relative or rendered — never re-spelled,
 *   so the operator reads back what they typed against.
 */
export function symlinkTargetRefusal(action: string, path: string): string {
  return (
    `cannot ${action} '${path}': the target is itself a symbolic link. A write follows a link where a delete acts ` +
    'on it, so the bytes would land wherever the link points — not at the path named here, and outside the project ' +
    'entirely when the link leaves it. Replace the link with a regular file, then retry.'
  );
}

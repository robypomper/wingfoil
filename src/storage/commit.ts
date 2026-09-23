/**
 * The reusable git-commit primitive (task-018-implement-git-backed-storage, P1.1, REQ-SYS-01).
 *
 * `writeDocument` (./document) writes bytes only; nothing else in `src/storage` turns a set of
 * writes into a commit, yet every mutating core operation must return a `CoreResult.commit`
 * `{sha, message}` (src/core/types). This is that missing producer: it stages **only** the scoped
 * paths it is handed — never `git add -A`/`git add .`, which would sweep in unrelated working-tree
 * changes (and, in a WingFoil worktree, the `node_modules` symlink) — and produces **exactly one**
 * commit, returning its full sha. Every mutating Wave-3 task (task-019 versioning, task-020 memory
 * add, task-025 dna set, task-029 `wingfoil init`) turns its writes into a single attributable
 * commit through this one helper, so the "one operation = one scoped commit" convention
 * (CLAUDE.md §5.1) has a single implementation rather than being re-derived per task.
 *
 * Mirrors the git-primitive style in `src/memory/git-log.ts`: `execFileSync('git', …)` (never a
 * shell), `-C <root>` to target the repository, and `env: process.env` passed **explicitly** — the
 * latter matters under Jest, whose worker env is not the ambient shell's, so relying on the default
 * env silently drops `GIT_*` overrides a test sets (the task-014 env-isolation gotcha).
 */
import { execFileSync } from 'child_process';

/** Options for {@link commitPaths} — carries the git-author/env override used by callers (e.g. task-029's wizard). */
export interface CommitOptions {
  /** Additional environment for the git invocations (merged over `process.env`). */
  readonly env?: NodeJS.ProcessEnv;
}

function runGit(root: string, args: readonly string[], options: CommitOptions): string {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf-8',
    env: options.env ? { ...process.env, ...options.env } : process.env,
  });
}

/**
 * {@link runGit} for a **probe** — an invocation whose failure is an expected answer rather than an
 * error, or whose stderr is noise the caller must not surface, so git's own diagnostic does not reach
 * the caller's stderr. Without `stdio[2]: 'ignore'`, `execFileSync` inherits fd 2 and
 * `git show HEAD:<untracked>` prints `fatal: path … exists on disk, but not in 'HEAD'` into the
 * user's terminal alongside the message the CLI actually meant to emit.
 *
 * The second case arrived with task-092: `git status --porcelain -- <path>` exits **0** but prints
 * `warning: could not open directory '<dir>/': No such file or directory` when an intermediate
 * directory of the pathspec is absent — the ordinary case for a write guard asking about a file that
 * has not been created yet. A non-zero exit still raises through `execFileSync` exactly as before.
 */
function probeGit(root: string, args: readonly string[], options: CommitOptions): string {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf-8',
    env: options.env ? { ...process.env, ...options.env } : process.env,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

/**
 * Stage exactly `paths` (root-relative or absolute; each passed verbatim after `--` so a path that
 * looks like a flag is never misread) and create a single commit with `message` that contains **only**
 * those paths, returning the new commit's 40-hex sha. Other changes already staged in the index are
 * neither committed nor unstaged (bug-027) — this also holds for the first commit of an empty
 * repository (`wingfoil init`).
 *
 * Determinism note (REQ-SYS-07): a git commit's sha necessarily incorporates the author/commit
 * timestamp, so two runs produce different shas — that is inherent to *creating* history and is not
 * a context-building read path (the determinism rule targets read/derivation paths, e.g.
 * `computeStateSnapshot`), so it is correct and intended here.
 *
 * @throws whatever `git` raises (via `execFileSync`) — e.g. nothing staged to commit, or `root` is
 *   not a git repository. Callers that must translate those into a `CoreResult` do so at their layer
 *   (see `src/core/init.ts`); this primitive stays a thin, throwing mechanism by design.
 */
export function commitPaths(
  root: string,
  paths: readonly string[],
  message: string,
  options: CommitOptions = {},
): string {
  runGit(root, ['add', '--', ...paths], options);
  // `--only -- <paths>` records exactly these paths, whatever else is staged: anything a caller or
  // another tool already staged stays staged and uncommitted (bug-027). A plain `git commit` would
  // commit the whole index under a subject that names only this operation.
  runGit(root, ['commit', '--only', '--quiet', '-m', message, '--', ...paths], options);
  return runGit(root, ['rev-parse', 'HEAD'], options).trim();
}

// --- Read primitives for asserting what a commit CONTAINS (task-088, bug-076) ------------------
//
// `commitPaths` above bounds a commit by *pathspec*; nothing bounded it by *content*, so a path that
// was already modified on disk rode into a commit whose subject declared only a state change. The
// three readers below are what lets a caller assert the diff a commit actually carries, instead of
// re-reading the file on disk and finding — truthfully, and uselessly — that it says what it should.

/**
 * git's canonical empty tree object, the same on every repository (`git hash-object -t tree
 * /dev/null`). Used as the parent of a **root** commit so "what changed between this commit and its
 * parent" is total rather than conditional.
 */
export const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

/**
 * The content of `path` at revision `rev`, or `null` when the path does not exist there (git exits
 * non-zero, which `execFileSync` raises).
 *
 * `rev` is any revision git accepts before a `:` — a sha, `HEAD`, or the index stage `:0`, which is
 * how a caller reads what the user has **staged** as opposed to what is in the working tree. The two
 * can disagree, and the difference is load-bearing: `git add` would silently replace a staged version
 * with the working-tree one.
 */
export function readPathAtRev(root: string, rev: string, path: string, options: CommitOptions = {}): string | null {
  try {
    return probeGit(root, ['show', `${rev}:${path}`], options);
  } catch {
    return null;
  }
}

/**
 * The two-character `git status --porcelain` code for `path` (index status, then working-tree
 * status), or the empty string when the path is clean — unmodified in both, and tracked.
 *
 * Deliberately git's own answer rather than a content comparison: git owns what "modified" means
 * here (index refresh, `core.autocrlf`, `.gitattributes` filters), and a caller that re-derived it
 * from bytes would disagree with `git status` on exactly the machines where it matters.
 */
export function pathPorcelainStatus(root: string, path: string, options: CommitOptions = {}): string {
  // `probeGit`, not `runGit`: git writes a `warning: could not open directory …` to stderr — while
  // still exiting 0 and answering correctly — whenever an intermediate directory of the pathspec is
  // absent, which is routine for a guard asking about a file that does not exist yet (task-092).
  const line = probeGit(root, ['status', '--porcelain', '--', path], options).split('\n')[0] ?? '';
  return line.length === 0 ? '' : line.slice(0, 2);
}

/** The commit's parent sha, or {@link EMPTY_TREE_SHA} when it is a root commit. */
export function commitParent(root: string, sha: string, options: CommitOptions = {}): string {
  try {
    return probeGit(root, ['rev-parse', '--verify', '--quiet', `${sha}^`], options).trim();
  } catch {
    return EMPTY_TREE_SHA;
  }
}

/** Root-relative paths whose content differs between revisions `from` and `to`, in git's own order. */
export function changedPathsBetween(root: string, from: string, to: string, options: CommitOptions = {}): string[] {
  return runGit(root, ['diff', '--name-only', from, to], options)
    .split('\n')
    .filter((path) => path.length > 0);
}

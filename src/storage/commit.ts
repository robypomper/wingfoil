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
 * Stage exactly `paths` (root-relative or absolute; each passed verbatim after `--` so a path that
 * looks like a flag is never misread) and create a single commit with `message`, returning the new
 * commit's 40-hex sha.
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
  runGit(root, ['commit', '--quiet', '-m', message], options);
  return runGit(root, ['rev-parse', 'HEAD'], options).trim();
}

/**
 * Test-only fixture helpers: build isolated, throwaway git repositories under the OS temp dir so
 * storage-layer tests can exercise real `git init`/`clone` behavior (REQ-SYS-01's fit criterion is
 * literally about `git clone`) without touching this repository itself. Not a `.test.ts` file, so
 * Jest's `testMatch` never picks it up as a suite on its own.
 */
import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';

/** Run `git` with a clean, throwaway identity/signing config — never touches global git config. */
export function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' });
}

/** Create a fresh temp directory initialized as a git repo, with a local (non-global) test identity. */
export function makeTempGitRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'wf-storage-'));
  git(dir, ['init', '--quiet', '--initial-branch=main']);
  git(dir, ['config', 'user.email', 'wf-test@example.invalid']);
  git(dir, ['config', 'user.name', 'WingFoil Test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  return dir;
}

/** Write a file (creating parent directories) relative to a fixture repo root. */
export function writeFixtureFile(root: string, relativePath: string, content: string): void {
  const absolute = join(root, relativePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, 'utf-8');
}

/** Stage and commit everything currently in the fixture repo's working tree. */
export function commitAll(root: string, message: string): void {
  git(root, ['add', '-A']);
  git(root, ['commit', '--quiet', '-m', message]);
}

/**
 * Stage and commit everything currently in the fixture repo's working tree, overriding the author/
 * committer identity for this one commit via `GIT_AUTHOR_*`/`GIT_COMMITTER_*` env vars — the repo's
 * own configured `user.name`/`user.email` (set by {@link makeTempGitRepo}) is left untouched.
 * task-015-complete-audit-trail uses this to build fixtures with a deliberately placeholder-looking
 * identity (e.g. a git-guessed `user@host.(none)` email, the shape git itself produces when it can't
 * determine a real domain) so the attribution-audit primitive has something genuine to flag.
 */
export function commitAllAs(root: string, message: string, author: { name: string; email: string }): void {
  git(root, ['add', '-A']);
  execFileSync('git', ['commit', '--quiet', '-m', message], {
    cwd: root,
    encoding: 'utf-8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: author.name,
      GIT_AUTHOR_EMAIL: author.email,
      GIT_COMMITTER_NAME: author.name,
      GIT_COMMITTER_EMAIL: author.email,
    },
  });
}

/** Clone a fixture repo (local, filesystem-only) into a second fresh temp directory. */
export function cloneTempRepo(source: string): string {
  const dest = join(mkdtempSync(join(tmpdir(), 'wf-storage-clone-')), 'clone');
  git(mkdtempSync(join(tmpdir(), 'wf-storage-cwd-')), ['clone', '--quiet', source, dest]);
  return dest;
}

/** Recursively remove a temp fixture directory. */
export function removeTempDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

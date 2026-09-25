/**
 * `src/storage/confinement.ts` — the ONE boundary decision REQ-SEC-06 states, and its
 * filesystem-resolving entry point (`task-102`, `bug-044`).
 *
 * `resolveConfinedMemoryPath` (`./memory-path.ts`, `task-017`) already owned this boundary for
 * Memory paths, but textually: `resolve` + `relative`, with no `realpath` anywhere. A path whose
 * every segment is inside the root while its filesystem target is not passes it unchanged. Rather
 * than add a second boundary check — "two places deciding confinement is how a guarantee becomes a
 * suggestion" — the predicate was extracted here and `resolveConfinedMemoryPath` now calls it, so
 * there is exactly one definition of "inside the root" and this suite is where it is pinned.
 */
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

import { escapesRoot, resolveRealPathInRoot } from '../../src/storage/confinement';

import { removeTempDir } from './helpers/git-fixture';

describe('escapesRoot — the single textual containment predicate', () => {
  const root = resolve(sep, 'projects', 'demo');

  it.each([
    ['a file directly inside', join(root, 'a.md')],
    ['a file nested inside', join(root, 'x', 'y', 'a.md')],
  ])('accepts %s', (_label, target) => {
    expect(escapesRoot(root, target)).toBe(false);
  });

  it.each([
    ['the root itself', root],
    ['the parent directory', resolve(root, '..')],
    ['a sibling of the root', resolve(root, '..', 'other', 'a.md')],
    ['an unrelated absolute path', resolve(sep, 'etc', 'passwd')],
  ])('refuses %s', (_label, target) => {
    expect(escapesRoot(root, target)).toBe(true);
  });
});

describe('resolveRealPathInRoot — containment decided on the filesystem, not on the string', () => {
  let root: string;
  let outside: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'wf-confine-root-'));
    outside = mkdtempSync(join(tmpdir(), 'wf-confine-outside-'));
  });

  afterEach(() => {
    removeTempDir(root);
    removeTempDir(outside);
  });

  it('accepts an ordinary path inside the root', () => {
    mkdirSync(join(root, 'nested'), { recursive: true });
    writeFileSync(join(root, 'nested', 'a.md'), 'x', 'utf-8');
    expect(resolveRealPathInRoot(root, 'nested/a.md').within).toBe(true);
  });

  it('accepts a path whose file does not exist yet, as long as its directory is inside', () => {
    mkdirSync(join(root, 'nested'), { recursive: true });
    const resolved = resolveRealPathInRoot(root, 'nested/not-created-yet.md');
    expect(resolved.within).toBe(true);
    expect(resolved.real).toBe(join(root, 'nested', 'not-created-yet.md'));
  });

  it('accepts a path none of whose directories exist yet', () => {
    expect(resolveRealPathInRoot(root, 'no/such/dir/a.md').within).toBe(true);
  });

  it('refuses a path reached through a symlinked DIRECTORY that leaves the root — bug-044', () => {
    writeFileSync(join(outside, 'a.md'), 'x', 'utf-8');
    symlinkSync(outside, join(root, 'aliased'));

    const resolved = resolveRealPathInRoot(root, 'aliased/a.md');

    expect(resolved.within).toBe(false);
    // The textual resolution is what a prefix check would have seen: entirely inside the root.
    expect(escapesRoot(resolve(root), resolved.absolute)).toBe(false);
    expect(resolved.real).toBe(join(outside, 'a.md'));
  });

  it('accepts a symlinked FILE whose target is outside — unlink removes the link, not the target', () => {
    writeFileSync(join(outside, 'target.md'), 'x', 'utf-8');
    symlinkSync(join(outside, 'target.md'), join(root, 'link.md'));
    expect(resolveRealPathInRoot(root, 'link.md').within).toBe(true);
  });

  it('refuses an absolute path outside the root', () => {
    expect(resolveRealPathInRoot(root, join(outside, 'a.md')).within).toBe(false);
  });

  it('refuses a traversal that climbs out of the root', () => {
    expect(resolveRealPathInRoot(root, '../a.md').within).toBe(false);
  });

  it('refuses the root itself', () => {
    expect(resolveRealPathInRoot(root, '.').within).toBe(false);
  });
});

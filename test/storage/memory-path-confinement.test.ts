/**
 * `resolveConfinedMemoryPath` decides REQ-SEC-06 **on the filesystem**, not on the string
 * (`task-105`, `bug-117-memory-add-writes-outside-the-project-root-through-a-symlinked-store`).
 *
 * `test/storage/memory-path.test.ts` pins the textual half — the `../` traversal smuggled through a
 * placeholder value that `task-017` was written for — against a purely notional root (`/repo`), and
 * that half is unchanged. This suite is the other half, and it needs real directories: a symlinked
 * directory on the way to a Memory document escapes the project root with no traversal anywhere in
 * the rendered string, so only a `realpath` answers it.
 *
 * The boundary itself is not re-derived here: `resolveRealPathInRoot` (`src/storage/confinement.ts`,
 * `task-102`) resolves and `escapesRoot` decides, and `test/storage/confinement.test.ts` pins those.
 * What this suite pins is that the Memory entry point **asks** them, and the shape of what it asks —
 * in particular the parent/leaf asymmetry it inherits (see the AC5 case below).
 *
 * It also pins the **textual** check the filesystem one was added beside, on the one class only it
 * can decide: a traversal the filesystem would launder back inside the root (the last case here).
 * Every other case in this file and in `memory-path.test.ts` is answered by either check alone, so
 * without that case nothing distinguishes keeping both from deleting one.
 *
 * Nothing here writes through a symlink: every target is resolved, never created.
 */
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { resolveRealPathInRoot } from '../../src/storage/confinement';
import { renderMemoryPath, resolveConfinedMemoryPath } from '../../src/storage/memory-path';
import { StorageError } from '../../src/storage/errors';
import { removeTempDir } from './helpers/git-fixture';

const PATTERN = 'docs/memory/{type}/{id}.md';

describe('resolveConfinedMemoryPath — confinement decided on the filesystem (REQ-SEC-06, bug-117)', () => {
  let root: string;
  let outside: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'wf-root-'));
    outside = mkdtempSync(join(tmpdir(), 'wf-outside-'));
  });

  afterEach(() => {
    removeTempDir(root);
    removeTempDir(outside);
  });

  it("refuses a target whose type directory is a symlink out of the project, naming both spellings", () => {
    mkdirSync(join(root, 'docs/memory'), { recursive: true });
    symlinkSync(outside, join(root, 'docs/memory/task'));

    let thrown: unknown;
    try {
      resolveConfinedMemoryPath(root, PATTERN, { type: 'task', id: 'task-001-escape-probe' });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(StorageError);
    expect((thrown as StorageError).code).toBe('E_PATH_ESCAPES_ROOT');
    // The canonical REQ-SEC-06 sentence is carried verbatim, and the two differing resolutions —
    // the path the caller rendered and the path it really lands on — are both named, because the
    // two differing IS the finding.
    expect((thrown as StorageError).message).toContain('Memory entries must reside within the project root');
    expect((thrown as StorageError).message).toContain('docs/memory/task/task-001-escape-probe.md');
    expect((thrown as StorageError).message).toContain(join(outside, 'task-001-escape-probe.md'));
  });

  /**
   * AC5 — the leaf stays unresolved, and that asymmetry is the contract `task-102` established
   * (`resolveRealPathInRoot` resolves the target's **parent** and keeps its own name). `bug-044`
   * verified the case it protects as safe: a symlinked **file** inside a real directory, where the
   * syscall acts on the link rather than on what it points at. Real-resolving the leaf here would
   * refuse that case and red two of `task-102`'s tests, so it is pinned on this path too.
   */
  it('accepts a target whose own name is a symlink, inside a real in-project directory', () => {
    mkdirSync(join(root, 'docs/memory/task'), { recursive: true });
    const target = join(outside, 'elsewhere.md');
    writeFileSync(target, '# elsewhere\n', 'utf-8');
    symlinkSync(target, join(root, 'docs/memory/task/task-001-linked.md'));

    expect(resolveConfinedMemoryPath(root, PATTERN, { type: 'task', id: 'task-001-linked' })).toBe(
      join(root, 'docs/memory/task/task-001-linked.md'),
    );
  });

  // AC8 (characterization): the ordinary path — nothing created yet — still resolves and is returned.
  it('returns the absolute path under the root when nothing on the way to it is a symlink', () => {
    expect(resolveConfinedMemoryPath(root, PATTERN, { type: 'task', id: 'task-001-ordinary' })).toBe(
      join(root, 'docs/memory/task/task-001-ordinary.md'),
    );
  });

  /**
   * AC8 — a project that itself lives under a symlinked path (a `/tmp` that is a link to
   * `/private/tmp`, a home directory reached through one) must not read as its own escape, and the
   * returned path must keep the root's spelling **as the caller gave it**: `commitPaths` runs
   * `git -C <root>` and callers take `relative(root, path)`, so a path re-spelled under the real
   * root would leave the repository's own vocabulary.
   */
  /**
   * The case the **textual** check alone decides, and therefore the one that makes keeping both
   * checks a testable claim rather than an assertion. A symlink that sits *outside* the root and
   * points back *into* it launders a traversal: the filesystem resolution of
   * `…/task/../../../../link/x.md` lands under the root and reports `within: true`, while the string
   * plainly climbs out of the project. `task-017`'s comparison is what refuses it, and a refusal is
   * the right answer — the rendered path is not a path this project declared, whatever a symlink
   * currently makes of it, and the link can be repointed at any moment by anyone who can write to
   * the directory above the root.
   */
  it('refuses a rendered traversal that the filesystem would launder back inside the root', () => {
    // <box>/project/docs/memory/task/  is the store; <box>/link -> <box>/project/docs.
    const box = mkdtempSync(join(tmpdir(), 'wf-box-'));
    try {
      const project = join(box, 'project');
      mkdirSync(join(project, 'docs/memory/task'), { recursive: true });
      symlinkSync(join(project, 'docs'), join(box, 'link'));

      const values = { type: 'task', id: '../../../../link/x' };
      const rendered = renderMemoryPath(PATTERN, values);

      // The filesystem's own answer: inside. Asserted, not assumed — it is what makes this case the
      // discriminating one, and if a future `resolveRealPathInRoot` stopped saying it, this test
      // would be pinning nothing and should fail here rather than pass for the wrong reason.
      expect(resolveRealPathInRoot(project, rendered).within).toBe(true);

      let thrown: unknown;
      try {
        resolveConfinedMemoryPath(project, PATTERN, values);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(StorageError);
      expect((thrown as StorageError).code).toBe('E_PATH_ESCAPES_ROOT');
      expect((thrown as StorageError).message).toContain(join(box, 'link', 'x.md'));
      // The textual branch is the one that fired: no symlink clause, which only the other writes.
      expect((thrown as StorageError).message).not.toContain('symlink leaving the project');
    } finally {
      removeTempDir(box);
    }
  });

  it('accepts a root reached through a symlink, and returns the path under the spelling it was given', () => {
    const linkParent = mkdtempSync(join(tmpdir(), 'wf-link-'));
    const linkedRoot = join(linkParent, 'project');
    // `rm -r` on a symlink unlinks the link, so removing `linkParent` never reaches `root`.
    symlinkSync(root, linkedRoot);

    expect(resolveConfinedMemoryPath(linkedRoot, PATTERN, { type: 'task', id: 'task-001-aliased' })).toBe(
      resolve(linkedRoot, 'docs/memory/task/task-001-aliased.md'),
    );

    removeTempDir(linkParent);
  });
});

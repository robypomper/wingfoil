/**
 * `targetIsSymlink` — the `lstat`-shaped question a write must ask about its own target
 * (`task-106`, `bug-120-a-symlinked-document-leaf-is-followed-by-the-write`).
 *
 * The confinement boundary (`escapesRoot`/`resolveRealPathInRoot`) answers *where* a path leads and
 * deliberately does not resolve the target's own name, because `unlinkSync` acts on a link
 * (`bug-044`'s benign case). `writeFileSync` follows one, so a write needs a second, different
 * question — and `existsSync`, which `requireAbsentTarget` asks, is **false** for a dangling link
 * while `lstatSync` succeeds on it. That single difference is how `bug-120` D1 wrote an element
 * outside the project root and committed a subject for it, so it is the first case pinned here.
 *
 * Nothing in this suite writes through a link: every path is inspected, never opened.
 */
import { mkdirSync, mkdtempSync, existsSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { targetIsSymlink } from '../../src/storage/confinement';
import { removeTempDir } from './helpers/git-fixture';

describe('targetIsSymlink — lstat, not exists (bug-120, task-106)', () => {
  let box: string;

  beforeEach(() => {
    box = mkdtempSync(join(tmpdir(), 'wf-lstat-'));
  });

  afterEach(() => {
    removeTempDir(box);
  });

  /** The case `requireAbsentTarget`'s `existsSync` reads as "nothing there" — `bug-120` D1. */
  it('reports a DANGLING symlink as a symlink, where existsSync reports nothing at all', () => {
    const link = join(box, 'dangling.md');
    symlinkSync(join(box, 'never-created.md'), link);

    expect(existsSync(link)).toBe(false);
    expect(targetIsSymlink(link)).toBe(true);
  });

  it('reports a live symlink to a file as a symlink', () => {
    const target = join(box, 'real.md');
    writeFileSync(target, '# real\n', 'utf-8');
    const link = join(box, 'link.md');
    symlinkSync(target, link);

    expect(targetIsSymlink(link)).toBe(true);
  });

  it('reports a symlinked DIRECTORY as a symlink when it is itself the target', () => {
    const directory = join(box, 'dir');
    mkdirSync(directory);
    const link = join(box, 'dir-link');
    symlinkSync(directory, link);

    expect(targetIsSymlink(link)).toBe(true);
  });

  /**
   * The ordinary answers. A path that does not exist is **not** a symlink: `memory add`'s whole
   * contract is to create one, so a guard that answered `true` here would refuse every add there
   * is. `lstatSync` throws `ENOENT` for it, which is the one failure this predicate absorbs.
   */
  it('reports a regular file, a real directory and a path that does not exist as not symlinks', () => {
    const file = join(box, 'plain.md');
    writeFileSync(file, '# plain\n', 'utf-8');
    const directory = join(box, 'plain-dir');
    mkdirSync(directory);

    expect(targetIsSymlink(file)).toBe(false);
    expect(targetIsSymlink(directory)).toBe(false);
    expect(targetIsSymlink(join(box, 'absent.md'))).toBe(false);
    expect(targetIsSymlink(join(box, 'absent-dir', 'absent.md'))).toBe(false);
  });

  /**
   * Only the leaf is asked about. A link on the *way* to the target is the confinement boundary's
   * question, not this one — `task-105` refuses the ones that leave the project, and an in-project
   * one is ordinary (a store directory aliased inside the repository still writes inside it).
   */
  it('reports a regular file reached THROUGH a symlinked directory as not a symlink', () => {
    const real = join(box, 'real-dir');
    mkdirSync(real);
    writeFileSync(join(real, 'doc.md'), '# doc\n', 'utf-8');
    symlinkSync(real, join(box, 'alias'));

    expect(targetIsSymlink(join(box, 'alias', 'doc.md'))).toBe(false);
  });
});

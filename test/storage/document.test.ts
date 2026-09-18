/**
 * task-003-git-backed-sot — plain document read/write (REQ-SYS-01: every mutation is a regular
 * git-tracked file write, "with no side-channel state" — no extra index/cache file appears
 * alongside the document itself).
 */
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

import { documentExists, readDocument, removeDocument, writeDocument } from '../../src/storage/document';
import { makeTempGitRepo, removeTempDir } from './helpers/git-fixture';

describe('writeDocument / readDocument / documentExists', () => {
  let repo: string;

  afterEach(() => removeTempDir(repo));

  it('round-trips content byte-for-byte, creating parent directories as needed', () => {
    repo = makeTempGitRepo();
    const target = join(repo, 'docs', '04_memory', 'v0.1', 'task-003-git-backed-sot.md');
    expect(documentExists(target)).toBe(false);

    const content = '---\nid: task-003-git-backed-sot\nstatus: in-progress\n---\n\n## Body\n';
    writeDocument(target, content);

    expect(documentExists(target)).toBe(true);
    expect(readDocument(target)).toBe(content);
  });

  it('writing a document creates no side-channel state — only the resolved path itself appears', () => {
    repo = makeTempGitRepo();
    const target = join(repo, 'docs', '04_memory', 'v0.1', 'task-100-example.md');
    writeDocument(target, 'content');

    // No `.wingfoil/state/` index, no sibling cache/lock file next to the document.
    expect(existsSync(join(repo, '.wingfoil', 'state'))).toBe(false);
    const siblingEntries = readdirSync(join(repo, 'docs', '04_memory', 'v0.1'));
    expect(siblingEntries).toEqual(['task-100-example.md']);
  });

  it('overwriting an existing document replaces its content exactly', () => {
    repo = makeTempGitRepo();
    const target = join(repo, 'docs', '04_memory', 'v0.1', 'task-003-git-backed-sot.md');
    writeDocument(target, 'first');
    writeDocument(target, 'second');
    expect(readDocument(target)).toBe('second');
  });
});

/**
 * task-052-directive-remove — `removeDocument`, `writeDocument`'s counterpart and the first
 * file-deleting primitive in the system (P3.3 `wingfoil directive remove`).
 */
describe('removeDocument', () => {
  let repo: string;

  afterEach(() => removeTempDir(repo));

  it('deletes exactly the one path and leaves its parent directory in place', () => {
    repo = makeTempGitRepo();
    const dir = join(repo, '.wingfoil', 'directives', 'custom');
    const target = join(dir, 'legacy-rule.md');
    writeDocument(target, 'rule');
    writeDocument(join(dir, 'other-rule.md'), 'other');

    removeDocument(target);

    expect(documentExists(target)).toBe(false);
    // The `custom/` directory itself is structure, not content: REQ-SEC-07 keys removability on the
    // `built-in/` vs `custom/` directory, so an emptied one must not be pruned.
    expect(existsSync(dir)).toBe(true);
    expect(readdirSync(dir)).toEqual(['other-rule.md']);
  });

  it('leaves an emptied directory behind rather than pruning it', () => {
    repo = makeTempGitRepo();
    const dir = join(repo, '.wingfoil', 'directives', 'custom');
    const target = join(dir, 'only-rule.md');
    writeDocument(target, 'rule');

    removeDocument(target);

    expect(existsSync(dir)).toBe(true);
    expect(readdirSync(dir)).toEqual([]);
  });

  it('throws ENOENT for a path that is not there — a missing target is a programmer error', () => {
    repo = makeTempGitRepo();
    expect(() => removeDocument(join(repo, 'nothing-here.md'))).toThrow(
      expect.objectContaining({ code: 'ENOENT' }),
    );
  });
});

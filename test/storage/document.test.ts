/**
 * task-003-git-backed-sot — plain document read/write (REQ-SYS-01: every mutation is a regular
 * git-tracked file write, "with no side-channel state" — no extra index/cache file appears
 * alongside the document itself).
 */
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

import { documentExists, readDocument, writeDocument } from '../../src/storage/document';
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

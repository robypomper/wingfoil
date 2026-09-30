/**
 * task-128 — `memory add` allocates a `{n}` id from the HIGHEST number already taken, across every
 * ref and every folder the type's `path` can resolve to (`dl-101` §2 (a), ratified; `bug-087`,
 * `bug-162`; `spec-001-memory-yaml-schema` "Counter algorithm", revised 2026-09-30).
 *
 * BDD: `docs/02_requirements/02_bdd/features/p1-memory/P1.3-memory-add.feature`, scenario
 * "The generated id skips a number already taken on another ref" (`dl-101` Action 3).
 *
 * Exercises the REAL, registered `CORE_MODULES` `memory.memoryAdd` operation in throwaway temp git
 * repositories. The remote-tracking ref is made with `git update-ref refs/remotes/origin/…`, which is
 * what a `git fetch` leaves behind; the allocator itself never touches the network.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { CORE_MODULES } from '../../src/core';
import type { CoreFn } from '../../src/core/registry';
import { exitCodeForResult } from '../../src/core/exit-code';
import { commitAll, git, makeTempGitRepo, removeTempDir, writeFixtureFile } from '../storage/helpers/git-fixture';

const MEMORY_YAML = `version: 1
types:
  decision:
    path: "docs/memory/decision/{id}.md"
    id_pattern: "decision-{n}-{slug}"
    template:
      file: "memory/templates/element.md"
      frontmatter:
        required: [id, type, title, status]
  decision-log:
    path: "docs/memory/design/dls/{id}.md"
    id_pattern: "dl-{n}-{slug}"
    template:
      file: "memory/templates/element.md"
      frontmatter:
        required: [id, type, title, status]
  task:
    path: "docs/memory/{release}/{id}.md"
    id_pattern: "task-{n}-{slug}"
    template:
      file: "memory/templates/element.md"
      frontmatter:
        required: [id, type, title, status]
`;

const TEMPLATE = `---
id: ""
type: element
title: ""
status: draft
---

<!-- body -->
`;

function memoryAddFn(): CoreFn<unknown, { id: string; path: string }> {
  const operation = CORE_MODULES.find((module) => module.name === 'memory')?.operations.memoryAdd;
  if (!operation) throw new Error('fixture bug: "memoryAdd" operation not registered on the memory module');
  return operation.fn as CoreFn<unknown, { id: string; path: string }>;
}

function seededRepo(): string {
  const repo = makeTempGitRepo();
  writeFixtureFile(repo, '.wingfoil/memory.yaml', MEMORY_YAML);
  writeFixtureFile(repo, '.wingfoil/memory/templates/element.md', TEMPLATE);
  commitAll(repo, 'seed memory.yaml + template');
  return repo;
}

/** Commit `files` on a new branch `name` cut from the current `HEAD`, then return to `main`. */
function commitOnBranch(repo: string, name: string, files: readonly string[]): void {
  git(repo, ['checkout', '--quiet', '-b', name]);
  for (const file of files) writeFixtureFile(repo, file, 'x\n');
  commitAll(repo, `on ${name}`);
  git(repo, ['checkout', '--quiet', 'main']);
}

/**
 * Leave `files` reachable ONLY from the remote-tracking ref `refs/remotes/origin/<name>`, as a fetch
 * would: committed on a scratch branch whose local ref is then deleted.
 */
function commitOnRemoteTrackingRef(repo: string, name: string, files: readonly string[]): void {
  const scratch = `scratch-${name}`;
  commitOnBranch(repo, scratch, files);
  const sha = execFileSync('git', ['-C', repo, 'rev-parse', scratch], { encoding: 'utf-8' }).trim();
  git(repo, ['update-ref', `refs/remotes/origin/${name}`, sha]);
  git(repo, ['branch', '--quiet', '-D', scratch]);
}

async function add(repo: string, type: string, title: string, set?: string[]) {
  return memoryAddFn()({ root: repo, options: { type, title, ...(set ? { set } : {}) } });
}

describe('memory add — id allocation from the highest number on every ref, across every folder (task-128, dl-101)', () => {
  const repos: string[] = [];
  const newRepo = (): string => {
    const repo = seededRepo();
    repos.push(repo);
    return repo;
  };
  afterEach(() => {
    while (repos.length > 0) removeTempDir(repos.pop() as string);
  });

  // AC 1 (bug-087): a gapped sequence must not reissue a number.
  it('with dl-001…dl-020 and dl-022 committed (gap at 021), creates dl-023, not dl-022', async () => {
    const repo = newRepo();
    for (let n = 1; n <= 22; n += 1) {
      if (n === 21) continue;
      writeFixtureFile(repo, `docs/memory/design/dls/dl-${String(n).padStart(3, '0')}-d${n}.md`, 'x\n');
    }
    commitAll(repo, 'dl-001..020, dl-022');

    const result = await add(repo, 'decision-log', 'Probe');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe('dl-023-probe');
    expect(result.value.path).toBe('docs/memory/design/dls/dl-023-probe.md');
  });

  // AC 2 (bug-162): the counter spans every folder the `{release}` token can resolve to.
  it('with task-108 under v0.2/ and nothing under v0.3/, --set release=v0.3 creates task-109 under v0.3/', async () => {
    const repo = newRepo();
    writeFixtureFile(repo, 'docs/memory/v0.2/task-108-last-of-v0.2.md', 'x\n');
    commitAll(repo, 'task-108 in v0.2');

    const result = await add(repo, 'task', 'Probe', ['release=v0.3']);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe('task-109-probe');
    expect(result.value.path).toBe('docs/memory/v0.3/task-109-probe.md');
    expect(existsSync(join(repo, 'docs/memory/v0.3/task-109-probe.md'))).toBe(true);
  });

  // AC 3 — BDD P1.3 "The generated id skips a number already taken on another ref".
  it('BDD P1.3: skips numbers taken only on another local branch or only on a remote-tracking ref', async () => {
    const repo = newRepo();
    writeFixtureFile(repo, 'docs/memory/decision/decision-001-a.md', 'x\n');
    writeFixtureFile(repo, 'docs/memory/decision/decision-003-c.md', 'x\n');
    commitAll(repo, 'decision-001, decision-003');
    commitOnBranch(repo, 'other', ['docs/memory/decision/decision-004-d.md']);
    commitOnRemoteTrackingRef(repo, 'feature', ['docs/memory/decision/decision-005-e.md']);

    const result = await add(repo, 'decision', 'Use Redis');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe('decision-006-use-redis');
    expect(exitCodeForResult(result)).toBe(0);
  });

  // AC 4 (REQ-SYS-07): the result does not depend on which ref is enumerated first.
  it('gives the same id whichever ref holds which number (ref names sorting in opposite orders)', async () => {
    const first = newRepo();
    commitOnBranch(first, 'aaa', ['docs/memory/decision/decision-007-g.md']);
    commitOnBranch(first, 'zzz', ['docs/memory/decision/decision-004-d.md']);

    const second = newRepo();
    commitOnBranch(second, 'zzz', ['docs/memory/decision/decision-007-g.md']);
    commitOnBranch(second, 'aaa', ['docs/memory/decision/decision-004-d.md']);

    const a = await add(first, 'decision', 'Probe');
    const b = await add(second, 'decision', 'Probe');

    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.value.id).toBe('decision-008-probe');
    expect(b.value.id).toBe(a.value.id);
  });
});

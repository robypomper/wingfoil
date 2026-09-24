/**
 * task-095-memory-add-resolves-its-type-at-head, `refactor` — `resolveAddType`
 * (`src/core/memory-add-type.ts`) exercised **directly**, on hand-made commits.
 *
 * The sibling suite `test/core/memory-add-type-baseline.test.ts` drives it through the real
 * registered `memory.memoryAdd` operation, which is where the behaviour that matters to a user lives.
 * What that route cannot reach are the branches `memory add` itself keeps unreachable — a registered
 * type declaring no `id_pattern`/`template`, a diagnostic read that fails — and the properties the
 * green step asserted in prose: that **the working-tree read is a diagnostic and never a decision**,
 * and that a genuine defect in the committed read **propagates** instead of being reported as an
 * unknown type. `task-090`/`task-091` set that precedent for the same reason: with the baseline in
 * place, an indirect test could only assert that a diagnostic stays silent.
 *
 * Determinism (REQ-SYS-07): fixed fixture texts, fixed identity, fixed step order.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { resolveAddType } from '../../src/core/memory-add-type';
import * as loaders from '../../src/core/loaders';
import * as storage from '../../src/storage';
import { exitCodeForResult } from '../../src/core/exit-code';
import { ValidationError } from '../../src/validation';
import { commitAll, makeTempGitRepo, removeTempDir, writeFixtureFile } from '../storage/helpers/git-fixture';

const MEMORY_YAML_PATH = '.wingfoil/memory.yaml';
const SCAFFOLD_PATH = '.wingfoil/memory/templates/adr.md';

const SCAFFOLD = `---
id: ""
type: adr
title: ""
status: draft
---
`;

/** A registry whose `adr` entry is complete — the control every case below deviates from. */
const COMPLETE = `version: 1
types:
  adr:
    path: "docs/memory/adr/{id}.md"
    id_pattern: "adr-{n}-{slug}"
    template:
      file: "memory/templates/adr.md"
      frontmatter:
        required: [id, type, title, status]
`;

/** The same type, registered but declaring neither `id_pattern` nor `template`. */
const INCOMPLETE = `version: 1
types:
  adr:
    path: "docs/memory/adr/{id}.md"
`;

/** Commit `registry` (+ optionally the scaffold), then leave `live` in the working tree only. */
function repoWith(registry: string, options: { scaffold?: boolean; live?: string } = {}): string {
  const repo = makeTempGitRepo();
  writeFixtureFile(repo, MEMORY_YAML_PATH, registry);
  if (options.scaffold !== false) writeFixtureFile(repo, SCAFFOLD_PATH, SCAFFOLD);
  commitAll(repo, 'seed');
  if (options.live !== undefined) writeFileSync(join(repo, MEMORY_YAML_PATH), options.live, 'utf-8');
  return repo;
}

describe('resolveAddType — the committed baseline decides, the working tree only explains', () => {
  let repo: string;

  afterEach(() => {
    jest.restoreAllMocks();
    removeTempDir(repo);
  });

  it('returns the committed `path`, `id_pattern`, `template` and scaffold bytes', () => {
    repo = repoWith(COMPLETE);

    const result = resolveAddType(repo, 'adr');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      type: 'adr',
      pathPattern: 'docs/memory/adr/{id}.md',
      idPattern: 'adr-{n}-{slug}',
      templatePath: SCAFFOLD_PATH,
      scaffold: SCAFFOLD,
    });
    expect(result.value.template.frontmatter.required).toEqual(['id', 'type', 'title', 'status']);
  });

  // Reachable only from here: `memory add` cannot register a type, so it cannot produce this state.
  it('refuses a registered type that declares no `id_pattern`/`template`, at exit 1', () => {
    repo = repoWith(INCOMPLETE);

    const result = resolveAddType(repo, 'adr');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(exitCodeForResult(result)).toBe(1);
    expect(result.error.message).toBe("memory type 'adr' has no id_pattern/template in memory.yaml");
  });

  it('adds the second sentence when the working tree supplies exactly what the committed entry lacks', () => {
    repo = repoWith(INCOMPLETE, { live: COMPLETE });

    const result = resolveAddType(repo, 'adr');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("the working tree's '.wingfoil/memory.yaml' gives it both");
    expect(result.error.message).toContain("commit '.wingfoil/memory.yaml' first");
  });

  // The scaffold refusal's other tail: nothing on disk either, so "commit it first" would be wrong.
  it('tells the user to ADD the scaffold when it is in no commit and not on disk', () => {
    repo = repoWith(COMPLETE, { scaffold: false });

    const result = resolveAddType(repo, 'adr');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain(`add '${SCAFFOLD_PATH}' and commit it`);
    expect(result.error.message).not.toContain('the working tree holds it');
  });

  // ---- the two properties the green step asserted in prose and nowhere else ----

  it('a failing working-tree read leaves the refusal exactly as HEAD words it', () => {
    repo = repoWith(INCOMPLETE);
    jest.spyOn(loaders, 'loadMemoryYaml').mockImplementation(() => {
      throw new Error('the working tree is unreadable');
    });

    const result = resolveAddType(repo, 'adr');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toBe("memory type 'adr' has no id_pattern/template in memory.yaml");
  });

  it('a failing on-disk scaffold probe leaves the refusal exactly as HEAD words it', () => {
    repo = repoWith(COMPLETE, { scaffold: false });
    jest.spyOn(storage, 'documentExists').mockImplementation(() => {
      throw new Error('cannot stat');
    });

    const result = resolveAddType(repo, 'adr');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain(`add '${SCAFFOLD_PATH}' and commit it`);
  });

  // A defect in the committed read must not be reported as "unknown type" or as an invalid registry.
  it('a non-ValidationError from the committed read propagates rather than becoming a refusal', () => {
    repo = repoWith(COMPLETE);
    jest.spyOn(loaders, 'loadMemoryYamlAtHead').mockImplementation(() => {
      throw new Error('git is broken');
    });

    expect(() => resolveAddType(repo, 'adr')).toThrow('git is broken');
  });

  it('a ValidationError from the committed read becomes the fail-closed refusal, with its issues', () => {
    repo = repoWith(COMPLETE);
    jest.spyOn(loaders, 'loadMemoryYamlAtHead').mockImplementation(() => {
      throw new ValidationError([
        { code: 'E_VALIDATION', path: 'types', file: `HEAD:${MEMORY_YAML_PATH}`, message: 'bad registry' },
      ]);
    });

    const result = resolveAddType(repo, 'adr');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
    expect(result.error.message).toContain('is not readable as a Memory configuration');
    expect(result.error.details?.issues).toHaveLength(1);
  });
});

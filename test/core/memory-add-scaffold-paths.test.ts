/**
 * task-123-template-paths-are-relative-to-the-config-root (`bug-156`) — every `template.file` a
 * `memory.yaml` declares resolves, through the same resolver `memory add` uses, to a scaffold
 * committed at `HEAD`.
 *
 * `spec-001-memory-yaml-schema` declares `template.file` as a path "relative to config root", and
 * {@link resolveAddType} joins it to `.wingfoil/`. A value that repeats the `.wingfoil/` prefix
 * therefore names `.wingfoil/.wingfoil/memory/templates/<type>.md`, which no commit holds, and
 * `memory add` refuses that type. Two configurations are pinned here:
 *
 * - **AC 2 — this repository's own, committed configuration** (red-first). It is read at `HEAD` by
 *   `resolveAddType` itself, never off disk, so the test asserts exactly what `memory add` would see
 *   when run at the repository root; it reads no history, so a history rewrite cannot break it.
 * - **AC 3 — the configuration `wingfoil init` scaffolds**, for every methodology template
 *   (characterization: `init` already writes `memory/templates/<type>.md`).
 *
 * Every type the committed `memory.yaml` registers is checked — the list is read, not pinned, so a
 * type added later (e.g. `dl-088`'s) is covered without editing this file.
 *
 * Determinism (REQ-SYS-07): types iterated in sorted order; fixed fixture identity.
 */
import { join } from 'node:path';

import { initWingfoilProject } from '../../src/core/init';
import { loadMemoryYamlAtHead } from '../../src/core/loaders';
import { resolveAddType } from '../../src/core/memory-add-type';
import { TEMPLATE_NAMES } from '../../src/storage/templates';
import { makeTempGitRepo, removeTempDir } from '../storage/helpers/git-fixture';

/** This repository's root: its `.wingfoil/` is the configuration WingFoil develops itself with. */
const REPO_ROOT = join(__dirname, '..', '..');

/** The types the committed `memory.yaml` at `root` registers, sorted. */
function committedTypes(root: string): string[] {
  const registry = loadMemoryYamlAtHead(root);
  if (registry === null) throw new Error(`fixture bug: no memory.yaml committed at HEAD in ${root}`);
  return Object.keys(registry.types).sort();
}

/**
 * For every committed type, what `resolveAddType` answers: the resolved scaffold path, or the
 * refusal message. A failure is reported per type, so one run names every broken entry at once.
 */
function resolveEveryType(root: string): Record<string, string> {
  const outcome: Record<string, string> = {};
  for (const type of committedTypes(root)) {
    const result = resolveAddType(root, type);
    outcome[type] = result.ok ? result.value.templatePath : `REFUSED: ${result.error.message}`;
  }
  return outcome;
}

/** The answer a correct configuration gives: `.wingfoil/memory/templates/<type>.md` for each type. */
function expectedScaffolds(root: string): Record<string, string> {
  return Object.fromEntries(committedTypes(root).map((type) => [type, `.wingfoil/memory/templates/${type}.md`]));
}

describe('memory add resolves every scaffold a memory.yaml names at HEAD (task-123, bug-156)', () => {
  it('AC 2: this repository\'s committed memory.yaml — every type\'s scaffold is committed at HEAD', () => {
    expect(committedTypes(REPO_ROOT).length).toBeGreaterThan(0);
    expect(resolveEveryType(REPO_ROOT)).toEqual(expectedScaffolds(REPO_ROOT));
  });

  describe.each(TEMPLATE_NAMES.map((name) => [name]))('AC 3: the memory.yaml `wingfoil init` scaffolds (%s)', (name) => {
    let repo: string;

    beforeEach(() => {
      repo = makeTempGitRepo();
      const init = initWingfoilProject(repo, name);
      if (!init.ok) throw new Error(`fixture bug: init --template ${name} failed: ${init.error.message}`);
    });

    afterEach(() => removeTempDir(repo));

    it('resolves every type\'s scaffold the same way', () => {
      expect(committedTypes(repo).length).toBeGreaterThan(0);
      expect(resolveEveryType(repo)).toEqual(expectedScaffolds(repo));
    });
  });
});

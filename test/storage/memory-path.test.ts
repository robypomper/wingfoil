/**
 * task-003-git-backed-sot — Memory document path resolution (spec-001-memory-yaml-schema,
 * `MemoryTypeEntry.path`: "MAY contain named placeholders besides {id} ... resolved by the
 * Workflow pillar from the active element chain before the ID engine runs"). This module renders a
 * type's `path` pattern against caller-supplied values — including `{id}`, which the ID-generation
 * engine (src/validation/id.ts, task-002) already produced — with no hardcoded paths anywhere.
 *
 * `path` values below are copied verbatim from docs/self/.wingfoil/memory.yaml, per the project's
 * established convention (see test/validation/id.test.ts, test/core/module-layout.test.ts).
 */
import { join } from 'path';

import { StorageError } from '../../src/storage/errors';
import { renderMemoryPath, resolveConfinedMemoryPath, resolveMemoryPath } from '../../src/storage/memory-path';

describe('renderMemoryPath — per-type memory.yaml path patterns', () => {
  it('resolves a release-line path (no {release}/{release-line} nesting)', () => {
    expect(renderMemoryPath('docs/04_memory/planning/{id}.md', { id: 'rl-v1' })).toBe(
      'docs/04_memory/planning/rl-v1.md',
    );
  });

  it('resolves a release path (nested under its release-line)', () => {
    expect(
      renderMemoryPath('docs/04_memory/planning/{release-line}/{id}.md', {
        'release-line': 'rl-v1',
        id: 'minor-v0.1',
      }),
    ).toBe('docs/04_memory/planning/rl-v1/minor-v0.1.md');
  });

  it('resolves a task path (nested under its release)', () => {
    expect(
      renderMemoryPath('docs/04_memory/{release}/{id}.md', {
        release: 'v0.1',
        id: 'task-003-git-backed-sot',
      }),
    ).toBe('docs/04_memory/v0.1/task-003-git-backed-sot.md');
  });

  it('resolves a tech-spec path (flat, single {id})', () => {
    expect(
      renderMemoryPath('docs/04_memory/design/specs/{id}.md', { id: 'spec-011-storage-layout' }),
    ).toBe('docs/04_memory/design/specs/spec-011-storage-layout.md');
  });

  it('throws E_MISSING_PATH_VALUE when a placeholder has no supplied value', () => {
    let thrown: unknown;
    try {
      renderMemoryPath('docs/04_memory/{release}/{id}.md', { id: 'task-003-git-backed-sot' });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(StorageError);
    expect((thrown as StorageError).code).toBe('E_MISSING_PATH_VALUE');
    expect((thrown as StorageError).message).toContain('release');
  });

  it('reports every missing placeholder at once, not just the first', () => {
    let thrown: unknown;
    try {
      renderMemoryPath('docs/04_memory/{release}/{id}.md', {});
    } catch (e) {
      thrown = e;
    }
    expect((thrown as StorageError).message).toContain('release');
    expect((thrown as StorageError).message).toContain('id');
  });
});

describe('resolveMemoryPath — joins a rendered path onto a project root', () => {
  it('produces an absolute path under root', () => {
    const root = '/repo';
    const result = resolveMemoryPath(root, 'docs/04_memory/{release}/{id}.md', {
      release: 'v0.1',
      id: 'task-003-git-backed-sot',
    });
    expect(result).toBe(join('/repo', 'docs/04_memory/v0.1/task-003-git-backed-sot.md'));
  });
});

describe('resolveConfinedMemoryPath — storage confinement to the project root (REQ-SEC-06)', () => {
  const ROOT = '/repo';
  const CONFINEMENT_MESSAGE = 'Memory entries must reside within the project root';

  it('a legitimate id resolves to an absolute path under the project root', () => {
    expect(
      resolveConfinedMemoryPath(ROOT, 'docs/04_memory/{release}/{id}.md', {
        release: 'v0.1',
        id: 'task-017-storage-confinement',
      }),
    ).toBe(join('/repo', 'docs/04_memory/v0.1/task-017-storage-confinement.md'));
  });

  it('a crafted id with ../ traversal is refused with E_PATH_ESCAPES_ROOT before returning any path', () => {
    let thrown: unknown;
    try {
      resolveConfinedMemoryPath(ROOT, 'docs/04_memory/{release}/{id}.md', {
        release: 'v0.1',
        id: '../../../../etc/passwd',
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(StorageError);
    expect((thrown as StorageError).code).toBe('E_PATH_ESCAPES_ROOT');
    // StorageError prefixes its code (`E_PATH_ESCAPES_ROOT: <msg>`), like every storage error; the
    // exact REQ-SEC-06 string is carried verbatim and surfaced to the user by the (deferred) core
    // mutation's StorageError -> CoreError mapping.
    expect((thrown as StorageError).message).toContain(CONFINEMENT_MESSAGE);
  });

  it('traversal smuggled through any other placeholder value is refused the same way', () => {
    expect(() =>
      resolveConfinedMemoryPath(ROOT, 'docs/04_memory/{release}/{id}.md', {
        release: '../../../../../tmp',
        id: 'evil',
      }),
    ).toThrow(CONFINEMENT_MESSAGE);
  });

  it('an absolute-looking value cannot escape — path.join keeps it under the root', () => {
    expect(
      resolveConfinedMemoryPath(ROOT, 'docs/04_memory/{release}/{id}.md', {
        release: 'v0.1',
        id: '/etc/passwd',
      }),
    ).toBe(join('/repo', 'docs/04_memory/v0.1/etc/passwd.md'));
  });

  it('a harmless internal .. that still normalizes inside the root is allowed', () => {
    expect(
      resolveConfinedMemoryPath(ROOT, 'docs/04_memory/{release}/{id}.md', {
        release: 'v0.1/sub/..',
        id: 'task-017',
      }),
    ).toBe(join('/repo', 'docs/04_memory/v0.1/task-017.md'));
  });
});

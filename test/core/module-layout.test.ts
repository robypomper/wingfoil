import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

import { loadDnaYaml } from '../../src/core/loaders';

/**
 * dna.yaml `modules:` list must be a truthful map of the real `src/` directory tree
 * (task-031-post-v01-dna-config-sync AC, spec-002-dna-yaml-schema): no module listed that doesn't
 * exist on disk, no implemented module missing from the list. Both sides are derived dynamically —
 * `modules[].path` from the live, hand-authored `docs/self/.wingfoil/dna.yaml` via the real
 * `loadDnaYaml` loader (no re-implementation), and the real tree via `readdirSync('src')` — so this
 * test self-enforces the reconciliation going forward instead of relying on a manually-mirrored list
 * that can silently drift again (which is exactly how the list previously fell out of sync).
 */
describe('src/ module layout (dna.yaml modules:)', () => {
  const repoRoot = join(__dirname, '..', '..');
  const liveRoot = join(repoRoot, 'docs', 'self');

  const dna = loadDnaYaml(liveRoot);
  const declaredPaths = dna.modules
    .map((m) => m.path)
    .filter((p): p is string => typeof p === 'string' && p.startsWith('src/'))
    .sort();

  // REQ-SYS-07: no unordered iteration in a context-building path — sort explicitly, `readdirSync`
  // order is not guaranteed stable.
  const actualDirs = readdirSync(join(repoRoot, 'src'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `src/${entry.name}`)
    .sort();

  it.each(declaredPaths)('declared module path %s exists as a real directory', (relativePath) => {
    const absolutePath = join(repoRoot, relativePath);
    expect(existsSync(absolutePath)).toBe(true);
    expect(statSync(absolutePath).isDirectory()).toBe(true);
  });

  it('lists every real src/ subdirectory as a module (no implemented module missing)', () => {
    expect(declaredPaths).toEqual(actualDirs);
  });
});

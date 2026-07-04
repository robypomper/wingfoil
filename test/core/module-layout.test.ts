import { existsSync, statSync } from 'fs';
import { join } from 'path';

// dna.yaml `modules:` list — path values copied literally from
// docs/self/.wingfoil/dna.yaml (the authoritative anatomy for this project), not re-derived from
// module `name`s. Note the `mcp-server` module's path is `src/mcp`, not `src/mcp-server`.
const MODULE_PATHS = [
  'src/core',
  'src/storage',
  'src/memory',
  'src/dna',
  'src/directives',
  'src/workflow',
  'src/cli',
  'src/mcp',
];

describe('src/ module layout (dna.yaml modules:)', () => {
  it.each(MODULE_PATHS)('has a %s directory', (relativePath) => {
    const absolutePath = join(__dirname, '..', '..', relativePath);
    expect(existsSync(absolutePath)).toBe(true);
    expect(statSync(absolutePath).isDirectory()).toBe(true);
  });
});

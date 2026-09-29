/**
 * task-117-remove-the-unused-anthropic-sdk (`bug-138`) — every runtime dependency is imported by `src/`.
 *
 * `package.json`'s `dependencies` are what a consumer of the published package installs (`spec-015`
 * §1: the tarball is `dist` plus the `dependencies` closure). `@anthropic-ai/sdk` sat there for two
 * releases with no import anywhere in `src/`, because nothing compared the manifest with the code.
 * This file is that comparison: each runtime dependency must be the target of at least one
 * `import … from`, `import()`, `require()` or bare `import` in some `src/**\/*.ts` file.
 *
 * `KNOWN_UNIMPORTED` is the explicit, exact exception set. It holds `chalk`, found unimported by this
 * guard at `task-117`'s design (reported at its review; out of that task's scope). The set must equal
 * what is actually unimported, so the test fails both when a new unused dependency appears and when
 * `chalk` is imported or removed without its exception being dropped.
 *
 * Deterministic: the file walk is sorted, and both inputs are committed files; no npm, no network.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..');

/** Runtime dependencies declared but imported nowhere in `src/`, on purpose and on record. */
const KNOWN_UNIMPORTED: readonly string[] = ['chalk'];

/** Every `.ts` file under `dir`, sorted. */
function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsFiles(full));
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

/** The package a bare module specifier belongs to (`@scope/name/sub` → `@scope/name`), or null. */
function packageOf(specifier: string): string | null {
  if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('node:')) return null;
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/** Every package some `src/` file imports. */
function importedPackages(): Set<string> {
  const specifier = /(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm;
  const found = new Set<string>();
  for (const file of tsFiles(join(REPO_ROOT, 'src'))) {
    for (const match of readFileSync(file, 'utf8').matchAll(specifier)) {
      const pkg = packageOf(match[1]);
      if (pkg !== null) found.add(pkg);
    }
  }
  return found;
}

const manifest = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
};
const runtimeDependencies = Object.keys(manifest.dependencies ?? {}).sort();

describe('runtime dependencies are imported by src/ (task-117, bug-138)', () => {
  const imported = importedPackages();

  it('the scanner sees the imports it must see', () => {
    // A scanner that found nothing would make every dependency look unused; pin that it works.
    expect(imported.has('commander')).toBe(true);
    expect(imported.has('@modelcontextprotocol/sdk')).toBe(true);
  });

  it('packageOf maps specifiers to package names and ignores relative and builtin ones', () => {
    expect(packageOf('@modelcontextprotocol/sdk/server/mcp.js')).toBe('@modelcontextprotocol/sdk');
    expect(packageOf('js-yaml')).toBe('js-yaml');
    expect(packageOf('zod/v4')).toBe('zod');
    expect(packageOf('./index.js')).toBeNull();
    expect(packageOf('node:fs')).toBeNull();
  });

  it('@anthropic-ai/sdk is not a runtime dependency', () => {
    expect(runtimeDependencies).not.toContain('@anthropic-ai/sdk');
  });

  it('every runtime dependency outside KNOWN_UNIMPORTED is imported somewhere in src/', () => {
    const unused = runtimeDependencies.filter((dep) => !imported.has(dep));
    expect(unused).toEqual([...KNOWN_UNIMPORTED].sort());
  });
});

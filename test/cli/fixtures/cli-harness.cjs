#!/usr/bin/env node
/**
 * Out-of-process spawn harness for `test/cli/program.integration.test.ts` (see that file's header
 * comment for the full rationale). `src/cli/program.ts`'s `buildProgram` cannot be imported from a
 * Jest test file: it does a dynamic `import('commander')`, and `commander` v15 is ESM-only, which
 * `ts-jest`'s CommonJS test runtime cannot load (this predates this test — see `program.ts`'s own
 * module doc). It works fine under a real, compiled Node process, so this harness is the bridge:
 * it requires the COMPILED `dist/cli/program.js` (built via `npx tsc -p tsconfig.build.json`,
 * CommonJS output — confirmed by inspecting `dist/cli/program.js`) and drives it exactly the way a
 * real `bin/wingfoil` entrypoint would, so it can be spawned as a subprocess and its real exit code
 * / stdout / stderr observed from the test.
 *
 * Usage: node cli-harness.cjs <distDir> <fixtureRoot> <cli-args...>
 *   distDir     - absolute path to the compiled `dist/` directory
 *   fixtureRoot - absolute path handed to the CLI as its `resolveRoot()` result (a directory
 *                 containing a `.wingfoil/` config, e.g. test/cli/fixtures/wingfoil-root)
 *   cli-args... - argv the CLI receives after `wingfoil` itself (e.g. `dna show --format json`)
 */
'use strict';

const path = require('path');

function main() {
  const [, , distDir, fixtureRoot, ...cliArgs] = process.argv;
  if (!distDir || !fixtureRoot) {
    process.stderr.write('usage: node cli-harness.cjs <distDir> <fixtureRoot> <cli-args...>\n');
    process.exit(2);
    return;
  }

  const { buildProgram } = require(path.join(distDir, 'cli', 'program.js'));
  const { CORE_MODULES } = require(path.join(distDir, 'core', 'index.js'));

  return buildProgram(CORE_MODULES, {
    resolveRoot: () => fixtureRoot,
    // Mirrors the real `src/cli.ts` production wiring: main's single bare `positional`
    // (task-026-implement-dna-show's seam), task-025's full `positionals` list (`dna set <key> <value>`),
    // task-028's additive `flags` spread (e.g. `paths`'s `--list`), plus task-020's value-bearing
    // `options` record (e.g. `memory add --type/--title/--tags`, `memory search --tag/--status/--type`
    // — task-021) — this harness must stay in lockstep with `cli.ts`'s own buildParams. Previously
    // missing `options: ctx.options` here meant NO CLI integration test could ever exercise a
    // value-option end-to-end (task-021 found this while writing the `memory search --tag` e2e test).
    buildParams: (ctx) => ({ root: ctx.root, positional: ctx.positional, positionals: ctx.positionals, options: ctx.options, ...(ctx.flags ?? {}) }),
  }).then((program) => program.parseAsync(['node', 'wingfoil', ...cliArgs]));
}

Promise.resolve()
  .then(main)
  .catch((error) => {
    process.stderr.write(`cli-harness: unexpected error: ${error && error.stack ? error.stack : error}\n`);
    process.exit(1);
  });

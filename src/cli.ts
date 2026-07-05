#!/usr/bin/env node
/**
 * The `wingfoil` CLI executable — task-007-npm-distribution (REQ-SYS-09). This is the `bin`
 * entrypoint `package.json`'s `"bin"` field maps to (compiled to `dist/cli.js`); `npm install -g
 * wingfoil` places a shim on `PATH` that runs this file directly (npm chmods it executable at link
 * time — the `#!/usr/bin/env node` shebang above is what makes the shim itself runnable).
 *
 * It wires the real `commander` program built by `./cli/program.ts` (`buildProgram`, task-006) onto
 * a real process invocation, exactly like `test/cli/fixtures/cli-harness.cjs` drives it against a
 * fixture root in tests — the difference here is `resolveRoot` resolves the *real* project root via
 * git-root detection (`./storage/git-root.ts`, spec-011-storage-layout) instead of a fixed fixture
 * path, and the real `process.argv` is parsed instead of a synthetic one.
 *
 * `resolveRoot` is only invoked lazily, once per dispatched command (see `./cli/registrar.ts`'s
 * `run`) — `--help`/`--version` are handled by `commander` itself before any command handler runs, so
 * `wingfoil --help` exits `0` (spec-005-cli-command-contract §1) even outside a git repository; only
 * an actual `<noun> <verb>` invocation needs a resolvable git root.
 */
import { buildProgram } from './cli/program';
import { CORE_MODULES } from './core';
import { resolveProjectRoot } from './storage/git-root';

buildProgram(CORE_MODULES, {
  resolveRoot: () => resolveProjectRoot(process.cwd()),
  buildParams: (ctx) => ({ root: ctx.root }),
})
  .then((program) => program.parseAsync(process.argv))
  .catch((error: unknown) => {
    // Last-resort handler for anything that escapes the per-command spec-005 exit path. Emit only the
    // message as a single `error:` line — never `error.stack`, which would leak a stack trace and
    // absolute internal paths from a published CLI (bug-002-cli-error-stack-dump). The normal
    // no-git-root path is already handled cleanly inside the registrar; this guards the unexpected.
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`error: ${message}\n`);
    process.exit(1);
  });

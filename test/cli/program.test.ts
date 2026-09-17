/**
 * `src/cli/program.ts` — the real `commander` wiring, exercised **in-process**
 * (task-065-fix-commander-esm-jest-harness, `bug-007-commander-esm-jest-untestable`).
 *
 * Until this suite existed, `program.ts` could not be loaded by a jest test at all: `commander` v15
 * is ESM-only and `buildProgram` reaches it through `await import('commander')`, which TypeScript
 * *preserves* under `module: Node16` — correct for production node, but jest's CommonJS runtime has
 * no dynamic-import callback, so the call died with `TypeError: A dynamic import callback was
 * invoked without --experimental-vm-modules`. The file was therefore excluded from every automated
 * test AND from the coverage report (it never appeared, not even at 0 %, because jest discovers
 * untested files by crawling `roots`, which is `test/` only — so an `src/` file no test requires is
 * invisible). `bug-007` calls that the *white-box* gap.
 *
 * The harness fix lives entirely in `jest.config.js` + `tsconfig.test.json` (no `src/` change, no new
 * dependency — see the task's Execution Notes for the routes rejected under
 * `dl-010-minimal-dependencies`): ts-jest compiles the sources with `module: CommonJS`, which
 * downlevels that `import()` to `require('commander')`, and `transformIgnorePatterns` lets ts-jest
 * transform `commander`'s own ESM on the way in. **So the commander driven below is the real
 * commander v15 — its real `Command`, real option parsing, real `unknownCommand` behaviour — but
 * transpiled to CommonJS for the test runtime.** The published CLI loads it as ESM; that ESM path
 * stays covered black-box by `./program.integration.test.ts`, which spawns the compiled `dist/`.
 * This suite owns the complementary white-box half: that `buildProgram` wires the right commands,
 * options and arguments onto Commander and forwards each invocation to `registrar.ts`'s `run`.
 *
 * Deliberately *not* black-box: exit codes, messages and output shape for the production
 * `CORE_MODULES` are `program.integration.test.ts`'s job. Here the module registry is synthetic (as
 * in `./registrar.test.ts`), so the assertions are about wiring rather than about any one domain
 * operation. `./init-command.ts` and `./mcp-command.ts` are mocked for the same reason: their own
 * behaviour has dedicated suites (`./init-command.test.ts`, `./mcp-command.test.ts`), and running the
 * real ones here would write to a repo / open a real stdio MCP transport.
 *
 * Nothing here spawns a process and nothing reads the wall clock, so
 * `test/core/latency-budget-placement.test.ts` (bug-011) is satisfied by construction.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { buildProgram } from '../../src/cli/program';
import type { CoreModule, ParamsContext } from '../../src/core/registry';
import { coreOk } from '../../src/core/types';

jest.mock('../../src/cli/init-command', () => ({
  runInit: jest.fn(async () => undefined),
  createReadlinePrompt: jest.fn(() => async () => ''),
}));
jest.mock('../../src/cli/mcp-command', () => ({
  runMcp: jest.fn(async () => undefined),
}));

import { runInit, createReadlinePrompt } from '../../src/cli/init-command';
import { runMcp } from '../../src/cli/mcp-command';

const PKG_VERSION = (
  JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8')) as { version: string }
).version;

/**
 * A synthetic registry covering all three command shapes `program.ts` has to wire: a plain
 * `<noun> <verb>` read op, a `<noun> <verb>` op with value-bearing `--{name} <value>` options
 * (task-020), and a flat, self-named op with a boolean `--{flag}` (task-028).
 */
const FIXTURE_MODULES: CoreModule[] = [
  {
    name: 'dna',
    operations: {
      dnaShow: { name: 'dnaShow', mutates: false, fn: async () => coreOk({ hello: 'world' }) },
      dnaSet: { name: 'dnaSet', mutates: true, fn: async () => coreOk({ committed: true }) },
    },
  },
  {
    name: 'memory',
    operations: {
      memoryAdd: {
        name: 'memoryAdd',
        mutates: true,
        options: [{ name: 'type', required: true }, { name: 'title' }],
        fn: async () => coreOk({ id: 'task-001' }),
      },
    },
  },
  {
    name: 'paths',
    operations: {
      paths: { name: 'paths', mutates: false, flags: ['list'], fn: async () => coreOk({ category: 'sources' }) },
    },
  },
];

/** Every `ParamsContext` `buildParams` saw during the last `parseAsync`, in call order. */
let seenContexts: ParamsContext[];
let exitSpy: jest.SpyInstance;
let stdoutSpy: jest.SpyInstance;
let stderrSpy: jest.SpyInstance;

/** Build the program over {@link FIXTURE_MODULES}, recording every `ParamsContext` into `seenContexts`. */
async function buildFixtureProgram() {
  const program = await buildProgram(FIXTURE_MODULES, {
    resolveRoot: () => '/fixture-root',
    buildParams: (ctx) => {
      seenContexts.push(ctx);
      return { root: ctx.root };
    },
  });
  // Commander's own terminal paths (`--version`, `--help`, unknown command) call `process.exit`;
  // `exitOverride` turns them into throws so they can be asserted without ending the jest worker.
  program.exitOverride();
  return program;
}

/** The text written to stdout (or stderr) across all calls of that spy, concatenated. */
function written(spy: jest.SpyInstance): string {
  return spy.mock.calls.map((call) => String(call[0])).join('');
}

beforeEach(() => {
  seenContexts = [];
  jest.clearAllMocks();
  exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  exitSpy.mockRestore();
  stdoutSpy.mockRestore();
  stderrSpy.mockRestore();
});

describe('buildProgram — the program itself (bug-007: this module is now loadable in-process)', () => {
  it('builds a real commander `Command` named `wingfoil`', async () => {
    const program = await buildFixtureProgram();
    expect(program.name()).toBe('wingfoil');
    // The real commander class, not a stand-in: its prototype carries Commander's own API.
    expect(typeof program.parseAsync).toBe('function');
    expect(typeof program.opts).toBe('function');
  });

  it('registers the four global flags from spec-008 §2 plus `-V, --version` (bug-001)', async () => {
    const program = await buildFixtureProgram();
    expect(program.options.map((option) => option.flags)).toEqual([
      '-V, --version',
      '--format <format>',
      '--verbose',
      '--no-color',
      '--no-interactive',
    ]);
  });

  it('`--format` defaults to `console`; the negatable flags resolve to enabled once an invocation is parsed', async () => {
    const program = await buildFixtureProgram();
    // Only `--format` carries a commander *default value*, so it is the only key present before a
    // parse; `--no-color` / `--no-interactive` resolve to `true` when argv is actually read.
    expect(program.opts()).toEqual({ format: 'console' });
    await program.parseAsync(['node', 'wingfoil', 'dna', 'show']);
    expect(program.opts()).toEqual({ format: 'console', color: true, interactive: true });
  });

  it('`--version` prints the package.json version and terminates with commander exit code 0', async () => {
    const program = await buildFixtureProgram();
    await expect(program.parseAsync(['node', 'wingfoil', '--version'])).rejects.toMatchObject({
      code: 'commander.version',
      exitCode: 0,
    });
    expect(written(stdoutSpy).trim()).toBe(PKG_VERSION);
  });
});

describe('buildProgram — command tree derivation (spec-006 §4, spec-008 §1)', () => {
  it('registers `init`, `mcp` and one command per derived noun, in `enumerateOperations` order', async () => {
    const program = await buildFixtureProgram();
    expect(program.commands.map((command) => command.name())).toEqual(['init', 'mcp', 'dna', 'memory', 'paths']);
  });

  it('nests each verb under its noun, and registers a self-named operation as a FLAT command (task-028)', async () => {
    const program = await buildFixtureProgram();
    const nameOf = (noun: string) => program.commands.find((command) => command.name() === noun);
    expect(nameOf('dna')?.commands.map((command) => command.name())).toEqual(['set', 'show']);
    expect(nameOf('memory')?.commands.map((command) => command.name())).toEqual(['add']);
    // `paths` is self-named (`deriveVerb` -> ''), so it carries no subcommand at all.
    expect(nameOf('paths')?.commands).toEqual([]);
  });

  it('gives every derived command the shared variadic `[positionals...]` argument (task-025/026)', async () => {
    const program = await buildFixtureProgram();
    const dnaShow = program.commands.find((c) => c.name() === 'dna')?.commands.find((c) => c.name() === 'show');
    expect(dnaShow?.registeredArguments.map((argument) => argument.name())).toEqual(['positionals']);
    expect(dnaShow?.registeredArguments[0]?.variadic).toBe(true);
    expect(dnaShow?.registeredArguments[0]?.required).toBe(false);
  });

  it('registers one `--{flag}` per declared boolean flag and one `--{name} <value>` per declared option', async () => {
    const program = await buildFixtureProgram();
    const paths = program.commands.find((command) => command.name() === 'paths');
    expect(paths?.options.map((option) => option.flags)).toEqual(['--list']);
    const memoryAdd = program.commands.find((c) => c.name() === 'memory')?.commands.find((c) => c.name() === 'add');
    expect(memoryAdd?.options.map((option) => option.flags)).toEqual(['--type <value>', '--title <value>']);
  });

  it("an unknown noun terminates through commander's own `unknownCommand` (exit code 1, not spec-008's aspirational 2)", async () => {
    const program = await buildFixtureProgram();
    await expect(program.parseAsync(['node', 'wingfoil', 'bogus', 'verb'])).rejects.toMatchObject({
      code: 'commander.unknownCommand',
      exitCode: 1,
    });
  });
});

describe('buildProgram — action forwarding into `registrar.run` (the wiring bug-007 left unverified)', () => {
  it('forwards the ambient `--format` and the full positional list of a `<noun> <verb>` command', async () => {
    const program = await buildFixtureProgram();
    await program.parseAsync(['node', 'wingfoil', 'dna', 'set', 'tech_stack.language', 'python', '--format', 'json']);

    expect(seenContexts).toHaveLength(1);
    expect(seenContexts[0]).toMatchObject({
      moduleName: 'dna',
      operationName: 'dnaSet',
      root: '/fixture-root',
      positional: 'tech_stack.language',
      positionals: ['tech_stack.language', 'python'],
    });
    expect(written(stdoutSpy)).toBe(JSON.stringify({ committed: true }) + '\n');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('honors a global flag placed BEFORE the noun/verb exactly like one placed after it', async () => {
    const program = await buildFixtureProgram();
    await program.parseAsync(['node', 'wingfoil', '--format', 'json', 'dna', 'show']);
    expect(written(stdoutSpy)).toBe(JSON.stringify({ hello: 'world' }) + '\n');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('collapses a declared boolean flag into `ctx.flags` for a flat command (task-028)', async () => {
    const program = await buildFixtureProgram();
    await program.parseAsync(['node', 'wingfoil', 'paths', 'sources', '--list']);
    expect(seenContexts[0]).toMatchObject({
      moduleName: 'paths',
      operationName: 'paths',
      positional: 'sources',
      flags: { list: true },
    });
  });

  it('reports a declared flag that was NOT passed as `false`, never as absent (task-028)', async () => {
    const program = await buildFixtureProgram();
    await program.parseAsync(['node', 'wingfoil', 'paths', 'sources']);
    expect(seenContexts[0]?.flags).toEqual({ list: false });
  });

  it('collapses declared value options into `ctx.options`, omitting the ones not passed (task-020)', async () => {
    const program = await buildFixtureProgram();
    await program.parseAsync(['node', 'wingfoil', 'memory', 'add', '--type', 'task']);
    expect(seenContexts[0]?.options).toEqual({ type: 'task' });
    expect(seenContexts[0]?.flags).toBeUndefined();
  });

  it('leaves `ctx.options`/`ctx.flags` undefined for a command declaring neither', async () => {
    const program = await buildFixtureProgram();
    await program.parseAsync(['node', 'wingfoil', 'dna', 'show']);
    expect(seenContexts[0]?.options).toBeUndefined();
    expect(seenContexts[0]?.flags).toBeUndefined();
  });

  it('an invalid `--format` value is rejected by the registrar before core runs: exit 2, nothing on stdout', async () => {
    const program = await buildFixtureProgram();
    await program.parseAsync(['node', 'wingfoil', 'dna', 'show', '--format', 'xml']);
    expect(seenContexts).toEqual([]);
    expect(written(stdoutSpy)).toBe('');
    expect(written(stderrSpy)).toBe('error: invalid --format value "xml", expected one of: console, json, yaml\n');
    expect(exitSpy).toHaveBeenCalledWith(2);
  });
});

describe('buildProgram — the special bootstrap commands `init` and `mcp`', () => {
  it('registers `init` with its `--template <name>` option and a description', async () => {
    const program = await buildFixtureProgram();
    const init = program.commands.find((command) => command.name() === 'init');
    expect(init?.options.map((option) => option.flags)).toEqual(['--template <name>']);
    expect(init?.description()).toBe('initialize WingFoil in the current git repository');
  });

  it('`init --template <name>` drives `runInit` with the resolved root and the ambient global options', async () => {
    const program = await buildFixtureProgram();
    await program.parseAsync(['node', 'wingfoil', 'init', '--template', 'scrum', '--format', 'json']);

    expect(createReadlinePrompt).toHaveBeenCalledTimes(1);
    expect(runInit).toHaveBeenCalledTimes(1);
    expect(jest.mocked(runInit).mock.calls[0]?.[0]).toEqual({ template: 'scrum', interactive: true, format: 'json' });
    expect(jest.mocked(runInit).mock.calls[0]?.[1]).toMatchObject({ root: '/fixture-root' });
  });

  it('`init` outside a WingFoil project emits the resolve-root failure and exits 1 without running the wizard', async () => {
    const program = await buildProgram(FIXTURE_MODULES, {
      resolveRoot: () => {
        throw new Error('E_NO_GIT_ROOT: not inside a git repository');
      },
      buildParams: (ctx) => ({ root: ctx.root }),
    });
    program.exitOverride();
    await program.parseAsync(['node', 'wingfoil', 'init']);

    expect(runInit).not.toHaveBeenCalled();
    expect(written(stderrSpy)).toBe('error: E_NO_GIT_ROOT: not inside a git repository\n');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('`init` stringifies a non-Error thrown by `resolveRoot` rather than printing `undefined`', async () => {
    const program = await buildProgram(FIXTURE_MODULES, {
      resolveRoot: () => {
        // Deliberately not an `Error`: this is the `String(error)` branch of the init action's handler.
        throw 'not an Error instance';
      },
      buildParams: (ctx) => ({ root: ctx.root }),
    });
    program.exitOverride();
    await program.parseAsync(['node', 'wingfoil', 'init']);

    expect(written(stderrSpy)).toBe('error: not an Error instance\n');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('`mcp` drives `runMcp` with the package version and the validated ambient format', async () => {
    const program = await buildFixtureProgram();
    await program.parseAsync(['node', 'wingfoil', 'mcp', '--format', 'yaml']);
    expect(runMcp).toHaveBeenCalledTimes(1);
    expect(jest.mocked(runMcp).mock.calls[0]?.[0]).toMatchObject({ version: PKG_VERSION, format: 'yaml' });
  });

  it('`mcp` with an unusable `--format` falls back to `console` rather than forwarding garbage', async () => {
    const program = await buildFixtureProgram();
    await program.parseAsync(['node', 'wingfoil', 'mcp', '--format', 'xml']);
    expect(jest.mocked(runMcp).mock.calls[0]?.[0]).toMatchObject({ format: 'console' });
  });
});

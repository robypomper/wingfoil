/**
 * Integration smoke test for `src/cli/program.ts` — the real `commander` wiring — following up on
 * task-006-dual-interface-shared-core. When this suite was written, no automated test could import
 * `program.ts` directly: `commander` v15 is ESM-only, and this project's `ts-jest` test runtime is
 * CommonJS, so a static `require()`/`import` of anything that transitively pulls in `commander`
 * crashed at Jest-test runtime even though the exact same code works under real Node (which supports
 * `import(ESM)` from a CJS module, i.e. the `await import('commander')` inside `buildProgram`).
 * `test/cli/registrar.test.ts` already covers 100% of the AC-relevant dispatch behavior
 * (Commander-independent); what was NOT covered by any automated test was `program.ts`'s own thin
 * mechanical wiring — registering global flags, deriving one `Command` per `{noun, verb}`, forwarding
 * to `command.run` — the exact thing task-006's reviewer verified by hand instead of by test.
 *
 * task-065-fix-commander-esm-jest-harness (`bug-007`) has since lifted that barrier for the
 * *white-box* half: `./program.test.ts` drives `buildProgram` in-process against a synthetic
 * registry, because jest now compiles the test runtime as CommonJS and transforms `commander`'s ESM
 * on the way in (`jest.config.js` / `tsconfig.test.json`). This suite is unchanged and remains the
 * only place the **real ESM `commander`** inside the **real compiled `dist/`** is exercised, against
 * the production `CORE_MODULES` — complementary to that suite, not redundant with it.
 *
 * The fix here is compile-then-spawn, not import-then-call: the compiled `dist/` (CommonJS output —
 * confirmed by inspecting `dist/cli/program.js`) is built once by jest's `globalSetup`
 * (`test/global-setup.cjs`) before any worker starts, then every test case spawns
 * `test/cli/fixtures/cli-harness.cjs` as a separate `node` process (via `execFileSync`), which
 * `require()`s the COMPILED `dist/cli/program.js` and `dist/core/index.js` and drives `buildProgram`
 * exactly like a real `bin/wingfoil` entrypoint would. That sidesteps the Jest/ESM limitation
 * entirely (the harness never touches `ts-jest`) and gives `program.ts`'s Commander wiring a
 * permanent, real regression guard.
 *
 * Build ownership (bug-003-cli-integration-dist-race): the build lives in `globalSetup`, NOT in this
 * file's `beforeAll`. Previously this suite and `npm-distribution.test.ts` each `rmSync`+rebuilt the
 * same `dist/` in their own `beforeAll`, which raced across parallel jest workers; centralizing the
 * build (once, pre-worker) removed both the race and the redundant second build. This `beforeAll`
 * now only asserts the shared `dist/` is present.
 *
 * The fixture `.wingfoil` config lives at `test/cli/fixtures/wingfoil-root/` — a small, static,
 * committed config (not the evolving `docs/self/.wingfoil/` one), so this test's assertions never
 * drift out from under it as the real project config changes.
 *
 * Every exit code / message asserted below was confirmed by running the harness by hand against the
 * compiled `dist/` before writing the assertion (see this task's Execution Notes) — not guessed from
 * `docs/self/docs/04_memory/design/specs/spec-008-cli-grammar.md`. Notably, spec-008 §1 describes an
 * *aspirational* `E_UNKNOWN_COMMAND` -> exit `2` for an unknown command/verb; `program.ts` does not
 * implement that yet (it is a thin Commander wrapper with no custom `unknownCommand` handling), so an
 * unknown command actually exits `1` today — Commander's own built-in default
 * (`Command.unknownCommand()` -> `this.error(message, { code: 'commander.unknownCommand' })`, which
 * defaults `exitCode` to `1` absent an explicit override). This test asserts the real, current
 * behavior; if a future task implements spec-008's full grammar (closest-match suggestion, exit `2`),
 * update this test alongside that change.
 */
import { execFileSync } from 'child_process';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import { load as yamlLoad } from 'js-yaml';

import { initWingfoilProject } from '../../src/core';
import { makeTempGitRepo, removeTempDir, writeFixtureFile, commitAll } from '../storage/helpers/git-fixture';

const REPO_ROOT = join(__dirname, '..', '..');
const DIST_DIR = join(REPO_ROOT, 'dist');
const HARNESS = join(__dirname, 'fixtures', 'cli-harness.cjs');
const FIXTURE_ROOT = join(__dirname, 'fixtures', 'wingfoil-root');
const PKG_VERSION = (JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as { version: string }).version;

interface CliResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

interface ExecFileSyncError {
  readonly status: number | null;
  readonly stdout: Buffer | string;
  readonly stderr: Buffer | string;
}

function isExecFileSyncError(error: unknown): error is ExecFileSyncError {
  return typeof error === 'object' && error !== null && 'status' in error && 'stdout' in error && 'stderr' in error;
}

/** Spawn the real, compiled CLI wiring against a given project root and capture exit code/stdout/stderr. */
function runCliInRoot(root: string, ...args: readonly string[]): CliResult {
  try {
    const stdout = execFileSync('node', [HARNESS, DIST_DIR, root, ...args], { encoding: 'utf-8' });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    if (!isExecFileSyncError(error)) throw error;
    return {
      status: error.status ?? 1,
      stdout: error.stdout.toString(),
      stderr: error.stderr.toString(),
    };
  }
}

/** Spawn the real, compiled CLI wiring against the static read-only fixture root. */
function runCli(...args: readonly string[]): CliResult {
  return runCliInRoot(FIXTURE_ROOT, ...args);
}

describe('program.ts — real commander wiring (compiled + spawned, out-of-process)', () => {
  beforeAll(() => {
    // `dist/` is built once by jest's globalSetup (test/global-setup.cjs) before any worker starts —
    // see bug-003-cli-integration-dist-race for why the per-suite rebuild was removed. Just assert it exists.
    expect(existsSync(join(DIST_DIR, 'cli', 'program.js'))).toBe(true);
  });

  it('`--version` prints the package.json version to stdout and exits 0 (bug-001)', () => {
    const result = runCli('--version');
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(PKG_VERSION);
    expect(result.stderr).toBe('');
  });

  it('`dna show --format json` exits 0 and prints the fixture DnaYaml as compact JSON on stdout', () => {
    const result = runCli('dna', 'show', '--format', 'json');
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      version: 1.1,
      modules: [{ name: 'core', path: 'src/core' }],
    });
    expect(result.stderr).toBe('');
  });

  it('`dna show --format yaml` exits 0 and prints the same value as YAML on stdout', () => {
    const result = runCli('dna', 'show', '--format', 'yaml');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('version: 1.1');
    expect(result.stdout).toContain('name: core');
  });

  it('REQ-INT-05 fit criterion: `--format json` and `--format yaml` parse to the SAME structure, stderr empty (task-013)', () => {
    // Stand-in for the AC's `wingfoil paths` / `wingfoil workflow status` cases; the `paths` case
    // itself is now covered directly below (task-028) — `dna show` still exercises the same shared
    // --format envelope every command inherits, `workflow status` remains its own owning task's job.
    const asJson = runCli('dna', 'show', '--format', 'json');
    const asYaml = runCli('dna', 'show', '--format', 'yaml');

    expect(asJson.status).toBe(0);
    expect(asYaml.status).toBe(0);
    // Both parse with a *standard* parser into a single top-level value...
    const fromJson = JSON.parse(asJson.stdout) as unknown;
    const fromYaml = yamlLoad(asYaml.stdout);
    // ...and that value is identical across the two machine-readable formats.
    expect(fromYaml).toEqual(fromJson);
    // Envelope rule: the structured payload is the only thing on stdout — no diagnostics on stderr.
    expect(asJson.stderr).toBe('');
    expect(asYaml.stderr).toBe('');
  });

  it('a global flag placed BEFORE the noun/verb (`--format json dna show`) is honored the same way', () => {
    const result = runCli('--format', 'json', 'dna', 'show');
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ version: 1.1 });
  });

  it('a global flag placed AFTER the noun/verb (`dna show --format json`) is honored the same way', () => {
    const result = runCli('dna', 'show', '--format', 'json');
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ version: 1.1 });
  });

  it('`directives list --format json` exits 0 and lists the one fixture directive', () => {
    const result = runCli('directives', 'list', '--format', 'json');
    expect(result.status).toBe(0);
    // dl-042 (task-055): the payload is `{ entries, warnings }`, no longer a bare array.
    const { entries: value, warnings } = JSON.parse(result.stdout) as {
      entries: Array<{ frontmatter: { id: string }; assignment: string }>;
      warnings: string[];
    };
    expect(warnings).toEqual([]);
    expect(value).toHaveLength(1);
    expect(value[0]?.frontmatter.id).toBe('sample');
    // P3.4 Scenario 1's "(or `unassigned`)": the fixture root carries a directive but no
    // `roles.yaml`, so nothing binds `sample` — and that is a successful listing, not an error
    // (task-053-directives-list).
    expect(value[0]?.assignment).toBe('unassigned');
  });

  it('`workflow list --format json` exits 0 and includes the one fixture `main` workflow', () => {
    const result = runCli('workflow', 'list', '--format', 'json');
    expect(result.status).toBe(0);
    const value = JSON.parse(result.stdout) as { workflows: Array<{ name: string; kind: string }> };
    expect(value.workflows).toEqual([expect.objectContaining({ name: 'main', kind: 'main' })]);
  });

  it('`dna show team --format json` prints only the "team" subtree (P2.2, task-026)', () => {
    const result = runCli('dna', 'show', 'team', '--format', 'json');
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      members: [{ name: 'Test User', roles: ['developer'] }],
      roles: [{ name: 'developer' }],
    });
    expect(result.stderr).toBe('');
  });

  it('`dna show tech_stack --format json` resolves the BDD-compat alias to the "stacks" subtree (P2.2, spec-002, task-026)', () => {
    const full = runCli('dna', 'show', '--format', 'json');
    const aliased = runCli('dna', 'show', 'tech_stack', '--format', 'json');
    expect(aliased.status).toBe(0);
    expect(JSON.parse(aliased.stdout)).toEqual((JSON.parse(full.stdout) as { stacks: unknown }).stacks);
  });

  it('`dna show nonexistent_section` exits 1 with the exact P2.2 error message, never exit 2 (read-only command, task-026)', () => {
    const result = runCli('dna', 'show', 'nonexistent_section');
    expect(result.status).toBe(1);
    expect(result.stderr).toBe("error: no DNA key named 'nonexistent_section'\n");
    expect(result.stdout).toBe('');
  });

  // task-028-implement-paths-category (P2.5, BDD `p2-dna/P2.5-paths.feature`). `paths` is registered
  // as a FLAT command (spec-008-cli-grammar §1: `wingfoil <noun> [args] [flags]`, no verb segment) —
  // these assertions exercise the real `program.ts` flat-command wiring, not just `registrar.ts`'s
  // Commander-independent model (already covered by `test/cli/registrar.test.ts`). The fixture DNA
  // (`test/cli/fixtures/wingfoil-root/.wingfoil/dna.yaml`) maps only `paths.sources: [src/]` — no
  // `governance` — matching the BDD "undefined category" scenario exactly.
  describe('`paths [category]` — flat command (task-028, P2.5)', () => {
    it('`paths sources --list` outputs the mapped entries and exits 0 (BDD "List paths for a category")', () => {
      const result = runCli('paths', 'sources', '--list');
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('src/');
    });

    it('`paths sources --format json` exits 0 and prints spec-005 §4\'s exact worked-example shape', () => {
      const result = runCli('paths', 'sources', '--format', 'json');
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({ category: 'sources', paths: ['src/'] });
      expect(result.stderr).toBe('');
    });

    it('`paths sources --format yaml` exits 0 and prints the same structure as YAML', () => {
      const result = runCli('paths', 'sources', '--format', 'yaml');
      expect(result.status).toBe(0);
      expect(yamlLoad(result.stdout)).toEqual({ category: 'sources', paths: ['src/'] });
      expect(result.stderr).toBe('');
    });

    it('REQ-INT-05 fit criterion (task-013\'s deferred check, delivered here): `--format json`/`--format yaml` parse to the SAME structure for `paths`, stderr empty', () => {
      const asJson = runCli('paths', 'sources', '--format', 'json');
      const asYaml = runCli('paths', 'sources', '--format', 'yaml');

      expect(asJson.status).toBe(0);
      expect(asYaml.status).toBe(0);
      expect(yamlLoad(asYaml.stdout)).toEqual(JSON.parse(asJson.stdout));
      expect(asJson.stderr).toBe('');
      expect(asYaml.stderr).toBe('');
    });

    it('`paths sources` (console, default format) also contains the mapped entry, --list not required for it to appear', () => {
      const result = runCli('paths', 'sources');
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('src/');
    });

    it('`paths governance` (unmapped category) exits 1 with the exact BDD error message (P2.5 "Error - querying an undefined category")', () => {
      const result = runCli('paths', 'governance');
      expect(result.status).toBe(1);
      expect(result.stderr).toBe("error: no paths mapped for category 'governance'\n");
      expect(result.stdout).toBe('');
    });

    it('`paths governance --format json` reports the same error, structured, on stderr', () => {
      const result = runCli('paths', 'governance', '--format', 'json');
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stderr)).toEqual({ error: "no paths mapped for category 'governance'" });
      expect(result.stdout).toBe('');
    });

    it('`paths` with no `category` returns the whole `paths` node and exits 0 — symmetric with `dna show` (no section = full DNA), per task-026\'s shared optional `[positional]` seam', () => {
      // Reconciled onto task-026's generic OPTIONAL `[positional]` (`X_cli-cmds.md`'s `[category]`
      // synopsis is bracketed = optional); an omitted category is not an error, it drills up to the
      // full `paths` map — exit 0, never exit 2 (read-only command, spec-005 §1).
      const result = runCli('paths', '--format', 'json');
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({ sources: ['src/'] });
      expect(result.stderr).toBe('');
    });
  });

  // task-025-implement-dna-set (P2.1, BDD `p2-dna/P2.1-dna-set.feature`) — the FIRST mutating command,
  // driven end-to-end through real `commander` (variadic positionals + UsageError -> exit 2). Writes
  // land in a THROWAWAY temp git repo (with its own identity), never the static fixture root above.
  describe('`dna set <key> <value>` — first mutating command (task-025, P2.1)', () => {
    const DNA_FIXTURE = `version: 1.1
modules:
  - name: core
    path: src/core
stacks:
  technologies:
    - name: TypeScript
      category: language
team:
  members:
    - name: Test User
      roles: [ developer ]
  roles:
    - name: developer
paths:
  sources: [ src/ ]
`;
    let repo: string;

    beforeEach(() => {
      repo = makeTempGitRepo();
      writeFixtureFile(repo, '.wingfoil/dna.yaml', DNA_FIXTURE);
      commitAll(repo, 'seed dna.yaml');
    });

    afterEach(() => removeTempDir(repo));

    it('sets a field, writes it under stacks (tech_stack alias), commits, and exits 0 (AC(a))', () => {
      const result = runCliInRoot(repo, 'dna', 'set', 'tech_stack.language', 'python');
      expect(result.status).toBe(0);
      const dna = yamlLoad(readFileSync(join(repo, '.wingfoil', 'dna.yaml'), 'utf-8')) as {
        stacks: { language?: string };
      };
      expect(dna.stacks.language).toBe('python');
      const subject = execFileSync('git', ['-C', repo, 'log', '-1', '--format=%s'], { encoding: 'utf-8' }).trim();
      expect(subject).toBe('wf(dna): set tech_stack.language');
    });

    it('an invalid dotted key path exits 2 with the exact BDD message, leaving the file unchanged (AC(c))', () => {
      const before = readFileSync(join(repo, '.wingfoil', 'dna.yaml'), 'utf-8');
      const result = runCliInRoot(repo, 'dna', 'set', '..language', 'python');
      expect(result.status).toBe(2);
      expect(result.stderr).toBe("error: invalid key path: '..language'\n");
      expect(result.stdout).toBe('');
      expect(readFileSync(join(repo, '.wingfoil', 'dna.yaml'), 'utf-8')).toBe(before);
    });
  });

  // task-021-implement-memory-search (P1.5, BDD `p1-memory/P1.5-memory-search.feature` +
  // `p1-memory/P1.12-keyword-search.feature`) — the first Memory-document READ command driven
  // end-to-end through real `commander` (bare positional keyword + `--tag` value option). Reads a
  // THROWAWAY temp git repo seeded with two Memory documents, never the static fixture root above.
  describe('`memory search [keyword]` — first Memory-document read command (task-021, P1.5)', () => {
    const MEMORY_YAML = `version: 1
types:
  task:
    path: "docs/04_memory/{release}/{id}.md"
`;
    let repo: string;

    beforeEach(() => {
      repo = makeTempGitRepo();
      writeFixtureFile(repo, '.wingfoil/memory.yaml', MEMORY_YAML);
      writeFixtureFile(
        repo,
        'docs/04_memory/v0.1/task-001-api-design.md',
        ['---', 'id: task-001-api-design', 'type: task', 'title: "API design"', 'status: draft', 'tags: [ architecture ]', '---', '', 'REST surface.', ''].join(
          '\n',
        ),
      );
      writeFixtureFile(
        repo,
        'docs/04_memory/v0.1/task-002-unrelated.md',
        ['---', 'id: task-002-unrelated', 'type: task', 'title: "Unrelated"', 'status: draft', 'tags: [ infra ]', '---', '', 'Nothing relevant.', ''].join(
          '\n',
        ),
      );
      commitAll(repo, 'seed memory.yaml + two documents');
    });

    afterEach(() => removeTempDir(repo));

    // BDD "Find a decision by keyword" has two clauses. This case owns the first — "the results
    // include the document titled 'API design'" — through the real, compiled CLI wiring: exit code,
    // output shape, content.
    //
    // The second clause, "And the query returns in under 1 second", is deliberately NOT asserted
    // here (bug-011-cli-latency-assertion-measures-spawn-contention / task-067). `runCliInRoot`
    // spawns `node dist/cli.js`, so a wall-clock reading taken around it samples Node process startup
    // plus CPU contention from jest's sibling workers rather than the query — which is why it failed
    // intermittently on an unmodified `main`. The threshold is unchanged and the clause is still
    // enforced; only the measurement point moved, to `test/core/query-latency.test.ts`, which runs
    // this exact scenario (a document titled "API design" tagged "architecture", query "api")
    // against the REGISTERED `memory.memorySearch` op — the same call this command makes — at
    // REQ-PERF-02's own measurement conditions: p95 over 25 runs on the 1,000-Memory-document
    // reference repository. `test/core/latency-budget-placement.test.ts` keeps it from drifting back
    // across the process boundary.
    it('`memory search api` finds the "API design" document, exit 0 (BDD "Find a decision by keyword")', () => {
      const result = runCliInRoot(repo, 'memory', 'search', 'api', '--format', 'json');
      expect(result.status).toBe(0);
      const parsed = JSON.parse(result.stdout) as { matches: { id?: string }[] };
      expect(parsed.matches.map((m) => m.id)).toContain('task-001-api-design');
    });

    it('`memory search --tag architecture` (no keyword) returns only the tagged document (BDD "Filter results by metadata tag")', () => {
      const result = runCliInRoot(repo, 'memory', 'search', '--tag', 'architecture', '--format', 'json');
      expect(result.status).toBe(0);
      const parsed = JSON.parse(result.stdout) as { matches: { id?: string; tags: string[] }[] };
      expect(parsed.matches.map((m) => m.id)).toEqual(['task-001-api-design']);
      parsed.matches.forEach((m) => expect(m.tags).toContain('architecture'));
    });

    it('`memory search nonexistentkeyword` exits 0 with the exact "no documents matched the query" message (BDD "Error - query with no matches")', () => {
      const result = runCliInRoot(repo, 'memory', 'search', 'nonexistentkeyword', '--format', 'json');
      expect(result.status).toBe(0);
      const parsed = JSON.parse(result.stdout) as { matches: unknown[]; message?: string };
      expect(parsed.matches).toEqual([]);
      expect(parsed.message).toBe('no documents matched the query');
    });

    it('`memory search ""` (explicit empty query) exits 2 with the exact "empty search query" message (P1.12 "Error - empty query string")', () => {
      const result = runCliInRoot(repo, 'memory', 'search', '');
      expect(result.status).toBe(2);
      expect(result.stderr).toBe('error: empty search query\n');
      expect(result.stdout).toBe('');
    });
  });

  // task-049-memory-history (P1.10, BDD `p1-memory/P1.10-memory-history.feature`) — the audit-trail
  // read command, driven end-to-end through real `commander` with the bare `<id>` positional
  // (spec-008 §7). Seeds a THROWAWAY temp git repo whose git history IS the fixture: the trail is
  // reconstructed from `git log`, not from anything written into the document (ADR-007).
  //
  // The feature's third clause, "And the query returns in under 1 second", is deliberately NOT
  // asserted here (`bug-011-cli-latency-assertion-measures-spawn-contention` / task-067):
  // `runCliInRoot` spawns `node dist/cli.js`, so a wall-clock reading taken around it would sample
  // Node process startup plus CPU contention from jest's sibling workers rather than the query. The
  // clause is enforced in `test/core/query-latency.test.ts`, in-process, against the registered
  // `memory.memoryHistory` op at REQ-PERF-02's own measurement conditions; this suite owns the exit
  // codes, messages and output shape.
  describe('`memory history <id>` — the audit-trail read command (task-049, P1.10)', () => {
    const MEMORY_YAML = `version: 1
types:
  decision-log:
    path: "docs/04_memory/design/dls/{id}.md"
`;
    const DOC = 'docs/04_memory/design/dls/decision-12.md';
    let repo: string;

    function writeDecision(status: string): void {
      writeFixtureFile(
        repo,
        DOC,
        ['---', 'id: decision-12', 'type: decision-log', 'title: "A decision"', `status: ${status}`, '---', '', 'Body.', ''].join('\n'),
      );
    }

    beforeEach(() => {
      repo = makeTempGitRepo();
      writeFixtureFile(repo, '.wingfoil/memory.yaml', MEMORY_YAML);
      writeDecision('draft');
      commitAll(repo, 'wf(decision-log): add decision-12');
      writeDecision('in-discussion');
      commitAll(repo, 'wf(decision-log): submit decision-12');
      writeDecision('ready');
      commitAll(
        repo,
        'wf(decision-log): approve decision-12 [in-discussion → ready]\n\nApprover: Roberto Pompermaier <robypomper@gmail.com> (approver)\nReason: ratified at the design review',
      );
    });

    afterEach(() => removeTempDir(repo));

    it('`memory history decision-12` lists 3 entries in chronological order, each with author/timestamp/state-change/reason, exit 0', () => {
      const result = runCliInRoot(repo, 'memory', 'history', 'decision-12', '--format', 'json');
      expect(result.status).toBe(0);
      const parsed = JSON.parse(result.stdout) as {
        id: string;
        entries: { author: string; timestamp: string; from: string | null; to: string | null; reason: string | null }[];
      };
      expect(parsed.id).toBe('decision-12');
      expect(parsed.entries).toHaveLength(3);
      expect(parsed.entries.map((entry) => entry.to)).toEqual(['draft', 'in-discussion', 'ready']);
      expect(parsed.entries.map((entry) => entry.from)).toEqual([null, 'draft', 'in-discussion']);
      parsed.entries.forEach((entry) => {
        expect(entry.author).toBe('WingFoil Test <wf-test@example.invalid>');
        expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/);
      });
      // The `Approver:`/`Reason:` body P1.7 mandates, read back through the real CLI — and left null
      // on the two subject-only commits rather than invented.
      expect(parsed.entries.map((entry) => entry.reason)).toEqual([null, null, 'ratified at the design review']);
      expect(result.stderr).toBe('');
    });

    it('`memory history decision-999` exits 1 with the exact "document not found: decision-999" message on stderr', () => {
      const result = runCliInRoot(repo, 'memory', 'history', 'decision-999');
      expect(result.status).toBe(1);
      expect(result.stderr).toBe('error: document not found: decision-999\n');
      expect(result.stdout).toBe('');
    });

    it('`memory history` with no <id> exits 2 with the missing-required-argument message (spec-008 §5)', () => {
      const result = runCliInRoot(repo, 'memory', 'history');
      expect(result.status).toBe(2);
      expect(result.stderr).toBe('error: missing required argument: memory history <id>\n');
      expect(result.stdout).toBe('');
    });
  });

  // task-045-memory-submit (P1.6, BDD `p1-memory/P1.6-memory-submit.feature`) — the three scenarios
  // driven through the real `commander` wiring, so the exit codes and the `error: <reason>` lines the
  // feature pins are asserted as a user sees them, not only on the `CoreResult`.
  describe('`memory submit <id>` — the first Memory transition verb (task-045, P1.6)', () => {
    const MEMORY_YAML = `version: 1
types:
  task:
    path: "docs/memory/task/{id}.md"
    states:
      sequence: [draft, pending, backlog, in-progress, in-review, approved, done]
      gates:
        pending: { reject: draft }
        in-review: { reject: in-progress }
      waiting: [backlog, approved]
`;
    let repo: string;
    const doc = (id: string, status: string): string =>
      ['---', `id: ${id}`, 'type: task', 'title: "A task"', `status: ${status}`, '---', '', 'Body.', ''].join('\n');

    beforeEach(() => {
      repo = makeTempGitRepo();
      writeFixtureFile(repo, '.wingfoil/memory.yaml', MEMORY_YAML);
      writeFixtureFile(repo, 'docs/memory/task/task-101.md', doc('task-101', 'draft'));
      writeFixtureFile(repo, 'docs/memory/task/task-200.md', doc('task-200', 'approved'));
      commitAll(repo, 'seed');
    });

    afterEach(() => removeTempDir(repo));

    it('sc.1 `memory submit task-101` sets `status: pending`, records one git commit, exit 0', () => {
      const result = runCliInRoot(repo, 'memory', 'submit', 'task-101');
      expect(result.status).toBe(0);
      expect(readFileSync(join(repo, 'docs/memory/task/task-101.md'), 'utf-8')).toContain('status: pending');
      expect(execFileSync('git', ['-C', repo, 'log', '-1', '--format=%s'], { encoding: 'utf-8' }).trim()).toBe('wf(task): submit task-101');
    });

    it('sc.2 `memory submit task-200` (approved) exits 1 with "illegal transition approved -> pending for type \'task\'", state unchanged', () => {
      const result = runCliInRoot(repo, 'memory', 'submit', 'task-200');
      expect(result.status).toBe(1);
      expect(result.stderr).toBe("error: illegal transition approved -> pending for type 'task'\n");
      expect(readFileSync(join(repo, 'docs/memory/task/task-200.md'), 'utf-8')).toContain('status: approved');
    });

    it('sc.3 `memory submit task-999` exits 1 with "document not found: task-999"', () => {
      const result = runCliInRoot(repo, 'memory', 'submit', 'task-999');
      expect(result.status).toBe(1);
      expect(result.stderr).toBe('error: document not found: task-999\n');
    });
  });

  // task-047-memory-reject (P1.8, BDD `p1-memory/P1.8-memory-reject.feature`) — the first
  // approver-gated verb, so this is also the first place the real CLI is asserted to produce the
  // `[from → to]` subject bracket + `Approver:`/`Reason:` body (dl-054, CLAUDE.md §5.1) and to
  // enforce REQ-SEC-03/REQ-SEC-04 through `commander`'s own `--reason <value>` option.
  describe('`memory reject <id> --reason <text>` — the first approver-gated verb (task-047, P1.8)', () => {
    const MEMORY_YAML = `version: 1
types:
  task:
    path: "docs/memory/task/{id}.md"
    states:
      sequence: [draft, pending, backlog, in-progress, in-review, approved, done]
      gates:
        pending: { reject: draft }
        in-review: { reject: in-progress }
      waiting: [backlog, approved]
`;
    // `makeTempGitRepo`'s local git identity, holding the `approver` role (REQ-SEC-03).
    const DNA_YAML = `version: 1.1
modules:
  - name: core
    path: src/core
stacks:
  technologies:
    - name: TypeScript
      category: language
team:
  members:
    - name: WingFoil Test
      email: wf-test@example.invalid
      roles: [ approver ]
  roles:
    - name: approver
paths:
  sources: [ src/ ]
`;
    let repo: string;
    const doc = (id: string, status: string): string =>
      ['---', `id: ${id}`, 'type: task', 'title: "A task"', `status: ${status}`, '---', '', 'Body.', ''].join('\n');

    beforeEach(() => {
      repo = makeTempGitRepo();
      writeFixtureFile(repo, '.wingfoil/memory.yaml', MEMORY_YAML);
      writeFixtureFile(repo, '.wingfoil/dna.yaml', DNA_YAML);
      writeFixtureFile(repo, 'docs/memory/task/task-101.md', doc('task-101', 'pending'));
      writeFixtureFile(repo, 'docs/memory/task/task-200.md', doc('task-200', 'draft'));
      commitAll(repo, 'seed');
    });

    afterEach(() => removeTempDir(repo));

    it("sc.1 `memory reject task-101 --reason 'tests missing'` sets `status: draft` + `rejection_reason`, records the reason in the commit, exit 0", () => {
      const result = runCliInRoot(repo, 'memory', 'reject', 'task-101', '--reason', 'tests missing');
      expect(result.status).toBe(0);
      const content = readFileSync(join(repo, 'docs/memory/task/task-101.md'), 'utf-8');
      expect(content).toContain('status: draft');
      expect(content).toContain('rejection_reason: "tests missing"');
      expect(execFileSync('git', ['-C', repo, 'log', '-1', '--format=%B'], { encoding: 'utf-8' }).trim()).toBe(
        'wf(task): reject task-101 [pending → draft]\n\nApprover: WingFoil Test <wf-test@example.invalid> (approver)\nReason: tests missing',
      );
    });

    it('sc.2 `memory reject task-200` on a document in no gate state exits 1, state unchanged', () => {
      const result = runCliInRoot(repo, 'memory', 'reject', 'task-200', '--reason', 'x');
      expect(result.status).toBe(1);
      // dl-032's contract message; `<to>` is dl-053's rule, owned by task-046 (see Execution Notes).
      expect(result.stderr).toMatch(/^error: illegal transition draft -> \S+ for type 'task'\n$/);
      expect(readFileSync(join(repo, 'docs/memory/task/task-200.md'), 'utf-8')).toContain('status: draft');
    });

    it('sc.3 `memory reject task-101` without `--reason` exits 2 (REQ-SEC-04), state unchanged', () => {
      const result = runCliInRoot(repo, 'memory', 'reject', 'task-101');
      expect(result.status).toBe(2);
      expect(result.stderr).toBe('error: missing required argument: --reason\n');
      expect(readFileSync(join(repo, 'docs/memory/task/task-101.md'), 'utf-8')).toContain('status: pending');
    });

    it('REQ-SEC-03: a git identity holding no `approver` role exits 1, state unchanged', () => {
      execFileSync('git', ['-C', repo, 'config', 'user.email', 'ray@example.invalid'], { encoding: 'utf-8' });
      const result = runCliInRoot(repo, 'memory', 'reject', 'task-101', '--reason', 'x');
      expect(result.status).toBe(1);
      expect(result.stderr).toBe("error: user not authorized to approve type 'task'\n");
      expect(readFileSync(join(repo, 'docs/memory/task/task-101.md'), 'utf-8')).toContain('status: pending');
    });
  });

  // task-048-memory-deprecate (P1.9, BDD `p1-memory/P1.9-memory-deprecate.feature`) — driven through
  // real `commander`, so this is where `--reason` is asserted OPTIONAL at the CLI surface
  // (`dl-027-req-sec-04-deprecate-reason-scope`, option (a)) and where the commit is asserted to carry
  // the `[from → to]` bracket but NO `Approver:` line.
  describe('`memory deprecate <id> [--reason <text>]` — the wildcard retire verb (task-048, P1.9)', () => {
    const MEMORY_YAML = `version: 1
defaults:
  states:
    sequence: [draft, pending, approved]
    gates:
      pending: { reject: draft }
types:
  decision:
    path: "docs/memory/decisions/{id}.md"
`;
    let repo: string;
    const doc = (id: string, status: string): string =>
      ['---', `id: ${id}`, 'type: decision', 'title: "A decision"', `status: ${status}`, '---', '', 'Body.', ''].join('\n');

    beforeEach(() => {
      repo = makeTempGitRepo();
      writeFixtureFile(repo, '.wingfoil/memory.yaml', MEMORY_YAML);
      writeFixtureFile(repo, 'docs/memory/decisions/decision-12.md', doc('decision-12', 'approved'));
      writeFixtureFile(repo, 'docs/memory/decisions/decision-88.md', doc('decision-88', 'deprecated'));
      commitAll(repo, 'seed');
    });

    afterEach(() => removeTempDir(repo));

    it("sc.1 `memory deprecate decision-12 --reason 'superseded by decision-20'` sets `status: deprecated`, keeps the file, exit 0", () => {
      const result = runCliInRoot(repo, 'memory', 'deprecate', 'decision-12', '--reason', 'superseded by decision-20');
      expect(result.status).toBe(0);
      expect(readFileSync(join(repo, 'docs/memory/decisions/decision-12.md'), 'utf-8')).toContain('status: deprecated');
      expect(execFileSync('git', ['-C', repo, 'log', '-1', '--format=%B'], { encoding: 'utf-8' }).trim()).toBe(
        'wf(decision): deprecate decision-12 [approved → deprecated]\n\nReason: superseded by decision-20',
      );
    });

    it('dl-027: `memory deprecate decision-12` with NO `--reason` exits 0 (the flag is optional on this verb)', () => {
      const result = runCliInRoot(repo, 'memory', 'deprecate', 'decision-12');
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(readFileSync(join(repo, 'docs/memory/decisions/decision-12.md'), 'utf-8')).toContain('status: deprecated');
      expect(execFileSync('git', ['-C', repo, 'log', '-1', '--format=%B'], { encoding: 'utf-8' }).trim()).toBe(
        'wf(decision): deprecate decision-12 [approved → deprecated]',
      );
    });

    it('sc.3 `memory deprecate decision-88` (already deprecated) exits 1, state unchanged', () => {
      const result = runCliInRoot(repo, 'memory', 'deprecate', 'decision-88', '--reason', 'x');
      expect(result.status).toBe(1);
      expect(result.stderr).toBe('error: document already deprecated: decision-88\n');
      expect(readFileSync(join(repo, 'docs/memory/decisions/decision-88.md'), 'utf-8')).toBe(doc('decision-88', 'deprecated'));
    });
  });

  // task-050-directive-create (P3.1, BDD `p3-directives/P3.1-directive-create.feature`) — the first
  // Directives-pillar mutating command, driven end-to-end through real `commander` (a required
  // `--name` value option). The project root is a THROWAWAY temp git repo initialized by the real
  // `wingfoil init` scaffold, so the created directive is checked against the ten it ships with.
  describe('`directive create --name <name>` — first Directives-pillar mutating command (task-050, P3.1)', () => {
    let repo: string;

    beforeEach(() => {
      repo = makeTempGitRepo();
      const init = initWingfoilProject(repo, 'Scrum');
      if (!init.ok) throw new Error(`fixture bug: wingfoil init failed — ${init.error.message}`);
    });

    afterEach(() => removeTempDir(repo));

    it('creates the file under .wingfoil/directives/custom/, commits it, and exits 0 (BDD "Create a new custom directive")', () => {
      const result = runCliInRoot(repo, 'directive', 'create', '--name', 'no-direct-db-access');
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');

      const created = join(repo, '.wingfoil', 'directives', 'custom', 'no-direct-db-access.md');
      expect(existsSync(created)).toBe(true);
      expect(readFileSync(created, 'utf-8')).toContain('id: no-direct-db-access');

      const subject = execFileSync('git', ['-C', repo, 'log', '-1', '--format=%s'], { encoding: 'utf-8' }).trim();
      expect(subject).toBe('wf(directive): create no-direct-db-access');
      const changed = execFileSync('git', ['-C', repo, 'show', '--name-only', '--format=', 'HEAD'], {
        encoding: 'utf-8',
      }).trim();
      expect(changed).toBe('.wingfoil/directives/custom/no-direct-db-access.md');
    });

    it('a duplicate name exits 1 with the exact BDD message and overwrites nothing (BDD "Error - ... already exists")', () => {
      expect(runCliInRoot(repo, 'directive', 'create', '--name', 'no-direct-db-access').status).toBe(0);
      const created = join(repo, '.wingfoil', 'directives', 'custom', 'no-direct-db-access.md');
      const before = readFileSync(created, 'utf-8');

      const result = runCliInRoot(repo, 'directive', 'create', '--name', 'no-direct-db-access');
      expect(result.status).toBe(1);
      expect(result.stderr).toBe('error: directive already exists: no-direct-db-access\n');
      expect(result.stdout).toBe('');
      expect(readFileSync(created, 'utf-8')).toBe(before);
    });

    it("an invalid name exits 2 with the exact BDD message and creates no file (BDD \"Error - invalid directive name\")", () => {
      const before = readdirSync(join(repo, '.wingfoil', 'directives', 'custom')).sort();
      const result = runCliInRoot(repo, 'directive', 'create', '--name', 'bad name!');
      expect(result.status).toBe(2);
      expect(result.stderr).toBe('error: invalid directive name (use kebab-case)\n');
      expect(result.stdout).toBe('');
      expect(readdirSync(join(repo, '.wingfoil', 'directives', 'custom')).sort()).toEqual(before);
    });

    it('the created directive is visible to `directives list` (the read side of the same pillar)', () => {
      expect(runCliInRoot(repo, 'directive', 'create', '--name', 'no-direct-db-access').status).toBe(0);
      const result = runCliInRoot(repo, 'directives', 'list', '--format', 'json');
      expect(result.status).toBe(0);
      const listed = (JSON.parse(result.stdout) as { entries: { path: string; frontmatter: { id: string } }[] }).entries;
      expect(listed.map((entry) => entry.frontmatter.id)).toContain('no-direct-db-access');
    });
  });

  // task-051-directive-assign (P3.2, BDD `p3-directives/P3.2-directive-assign.feature`) — two required
  // value options driven end-to-end through real `commander`, against a THROWAWAY repo carrying the
  // real `wingfoil init` scaffold with `testing` unbound from `developer` (the Sc.1 precondition).
  describe('`directive assign --directive <id> --role <role>` (task-051, P3.2)', () => {
    let repo: string;

    beforeEach(() => {
      repo = makeTempGitRepo();
      const init = initWingfoilProject(repo, 'Scrum');
      if (!init.ok) throw new Error(`fixture bug: wingfoil init failed — ${init.error.message}`);
      const rolesPath = join(repo, '.wingfoil', 'roles.yaml');
      const scaffold = readFileSync(rolesPath, 'utf-8');
      writeFixtureFile(repo, '.wingfoil/roles.yaml', scaffold.replace('    - code-quality\n    - testing\n', '    - code-quality\n'));
      commitAll(repo, 'fixture: unbind testing from developer');
    });

    afterEach(() => removeTempDir(repo));

    it('assigns, commits only roles.yaml, and `directives list --role developer` now lists testing (BDD Sc.1)', () => {
      const result = runCliInRoot(repo, 'directive', 'assign', '--directive', 'testing', '--role', 'developer');
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');

      const subject = execFileSync('git', ['-C', repo, 'log', '-1', '--format=%s'], { encoding: 'utf-8' }).trim();
      expect(subject).toBe('wf(directive): assign testing to developer');
      const changed = execFileSync('git', ['-C', repo, 'show', '--name-only', '--format=', 'HEAD'], {
        encoding: 'utf-8',
      }).trim();
      expect(changed).toBe('.wingfoil/roles.yaml');

      const listed = runCliInRoot(repo, 'directives', 'list', '--role', 'developer', '--format', 'json');
      expect(listed.status).toBe(0);
      // dl-042 (task-055): the listing payload is `{ entries, warnings }`.
      const { entries } = JSON.parse(listed.stdout) as { entries: Array<{ frontmatter: { id: string } }> };
      const ids = entries.map((e) => e.frontmatter.id);
      expect(ids).toContain('testing');
    });

    it("an undefined role exits 1 with the exact BDD message (BDD Sc.2)", () => {
      const result = runCliInRoot(repo, 'directive', 'assign', '--directive', 'testing', '--role', 'wizard');
      expect(result.status).toBe(1);
      expect(result.stderr).toBe("error: unknown role 'wizard' (not defined in dna.yaml)\n");
      expect(result.stdout).toBe('');
    });

    it('a non-existent directive exits 1 with the exact BDD message (BDD Sc.3)', () => {
      const result = runCliInRoot(repo, 'directive', 'assign', '--directive', 'ghost', '--role', 'developer');
      expect(result.status).toBe(1);
      expect(result.stderr).toBe('error: unknown directive: ghost\n');
      expect(result.stdout).toBe('');
    });

    it('re-assigning is idempotent: exit 0 and no new commit', () => {
      expect(runCliInRoot(repo, 'directive', 'assign', '--directive', 'testing', '--role', 'developer').status).toBe(0);
      const head = (): string => execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf-8' }).trim();
      const before = head();
      expect(runCliInRoot(repo, 'directive', 'assign', '--directive', 'testing', '--role', 'developer').status).toBe(0);
      expect(head()).toBe(before);
    });
  });

  // task-053-directives-list (P3.4, BDD `p3-directives/P3.4-directives-list.feature`) — the `--role`
  // value option, driven end-to-end through real `commander` against a THROWAWAY temp repo (the
  // static fixture root deliberately has no `roles.yaml`, which is the "unassigned" case asserted
  // above). Commander rejects an unregistered option, so this also proves `--role` is really
  // declared on the derived command rather than only honoured by the core function.
  describe('`directives list --role <role>` (task-053, P3.4 Scenario 2)', () => {
    const DIRECTIVE = (id: string): string =>
      ['---', `id: ${id}`, `name: "${id}"`, 'type: directive', 'kind: custom', `title: "${id}"`, '---', '', `# ${id}`, ''].join('\n');
    let repo: string;

    beforeEach(() => {
      repo = makeTempGitRepo();
      for (const id of ['testing', 'code-review', 'security-secrets']) {
        writeFixtureFile(repo, `.wingfoil/directives/custom/${id}.md`, DIRECTIVE(id));
      }
      writeFixtureFile(
        repo,
        '.wingfoil/roles.yaml',
        'version: 1.0\nassignments:\n  developer:\n    - testing\n  reviewer:\n    - code-review\nglobal:\n  - security-secrets\n',
      );
      commitAll(repo, 'seed directives + roles.yaml');
    });

    afterEach(() => removeTempDir(repo));

    it('lists only the developer-assigned directives (incl. globals), exit 0', () => {
      const result = runCliInRoot(repo, 'directives', 'list', '--role', 'developer', '--format', 'json');
      expect(result.status).toBe(0);
      const value = (JSON.parse(result.stdout) as { entries: Array<{ frontmatter: { id: string }; assignment: string }> }).entries;
      expect(value.map((entry) => entry.frontmatter.id).sort()).toEqual(['security-secrets', 'testing']);
      expect(value.find((entry) => entry.frontmatter.id === 'testing')?.assignment).toBe('developer');
      expect(result.stderr).toBe('');
    });

    it('without --role, lists every directive with its assignment (or "unassigned")', () => {
      const result = runCliInRoot(repo, 'directives', 'list', '--format', 'json');
      expect(result.status).toBe(0);
      const value = (JSON.parse(result.stdout) as { entries: Array<{ frontmatter: { id: string }; assignment: string }> }).entries;
      expect(value.map((entry) => `${entry.frontmatter.id}=${entry.assignment}`)).toEqual([
        'code-review=reviewer',
        'security-secrets=global (all roles)',
        'testing=developer',
      ]);
    });

    // task-055 (dl-042 D, dl-029): an unbound role is no longer silent on the real CLI — the warning
    // rides the payload, the command still exits 0 and lists the globals.
    it('--role for an unbound role carries the dl-029 warning in the payload, exit 0', () => {
      const result = runCliInRoot(repo, 'directives', 'list', '--role', 'ghost', '--format', 'json');
      expect(result.status).toBe(0);
      const value = JSON.parse(result.stdout) as { entries: Array<{ frontmatter: { id: string } }>; warnings: string[] };
      expect(value.entries.map((entry) => entry.frontmatter.id)).toEqual(['security-secrets']);
      expect(value.warnings).toEqual(["no directives assigned to role 'ghost'"]);
    });
  });

  it('an invalid --format value exits 2 with the usage-error message on stderr, never touching stdout', () => {
    const result = runCli('dna', 'show', '--format', 'xml');
    expect(result.status).toBe(2);
    expect(result.stderr).toBe('error: invalid --format value "xml", expected one of: console, json, yaml\n');
    expect(result.stdout).toBe('');
  });

  it('an unknown noun exits 1 with commander\'s own "unknown command" message on stderr (see header comment: spec-008\'s exit-2 grammar is not implemented by program.ts yet)', () => {
    const result = runCli('bogus', 'verb');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unknown command 'bogus'");
  });

  it('an unknown verb under a known noun also exits 1 the same way', () => {
    const result = runCli('dna', 'bogus');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unknown command 'bogus'");
  });
});

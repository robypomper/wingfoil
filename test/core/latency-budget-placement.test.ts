/**
 * Structural guard for `bug-011-cli-latency-assertion-measures-spawn-contention`
 * (task-067-fix-cli-latency-assertion): **a latency budget is measured in-process, never across a
 * process boundary.**
 *
 * The defect this pins down was not a wrong threshold — it was a wrong *measurand*.
 * `test/cli/program.integration.test.ts` implemented P1.5's "And the query returns in under 1 second"
 * (`docs/02_requirements/02_bdd/features/p1-memory/P1.5-memory-search.feature`) by wrapping
 * `Date.now()` around a **spawned** `node dist/cli.js`. Under jest's default parallelism (11 workers
 * on a 12-core machine) that sample is dominated by Node process startup plus CPU contention from
 * sibling workers, so it failed intermittently on an unmodified `main` — every one of the ten v0.2
 * review agents hit it and had to re-derive that it was a pre-existing flake, several recording a
 * stale suite count in their task's Execution Notes as a result.
 *
 * REQ-PERF-02 (`docs/02_requirements/03_sard/02_performance-nfr.md`) owns both the threshold and the
 * measurement conditions for that budget — `< 1,000 ms (p95)` over `>= 20` runs on the
 * 1,000-Memory-document reference repository — and `test/core/query-latency.test.ts` implements it
 * against the registered `memory.memorySearch` `CoreFn`, which is the exact call both
 * `wingfoil memory search` and the MCP `wingfoil://memory/search` Resource make. That is where the
 * budget lives; this file keeps it from drifting back out to a subprocess.
 *
 * The rule enforced below is deliberately narrow and mechanical, so it stays true as the suite grows:
 * **no test-suite file may both start a child process and read the wall clock.** A file doing only one
 * of the two is untouched — the timing suites (`test/core/query-latency.test.ts`,
 * `test/mcp/resource-latency.test.ts`, `test/mcp/server.test.ts`) measure in-process calls and never
 * spawn, while the spawn-based suites (`test/cli/*.integration.test.ts`, `npm-distribution.test.ts`)
 * shell out to `test/cli/fixtures/cli-harness.cjs` and assert exit codes, output shape and content
 * with no clock in sight. It is the *combination* in one file that reproduces bug-011.
 *
 * Grounding: the `testing` directive ("Tests are deterministic and isolated; no reliance on external
 * services or wall-clock/random") and the `determinism` directive (REQ-SYS-07) — a non-deterministic
 * gate on a project whose north star is determinism costs more than the assertion is worth.
 *
 * The check is textual, so a marker named in a *comment* counts too. That is intentional rather than
 * merely tolerated: it stops the removed pattern from being reintroduced by copy-paste out of a
 * "here is what we used to do" note. A file explaining why it no longer times a spawn should say so
 * in prose ("a wall-clock reading taken around it"), not by quoting the API.
 *
 * Lives in `test/core/` with the project's other cross-cutting structural guards
 * (`module-layout.test.ts`, `pillar-isolation.test.ts`, `parity.test.ts`) rather than in the directory
 * it polices — which also keeps it out of its own scanned set, since the pattern lists below would
 * otherwise match this file's own source.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

const TEST_ROOT = join(__dirname, '..');

/** This file's own path, relative to `test/` — excluded from the scan (see the module doc). */
const SELF = relative(TEST_ROOT, __filename).split(sep).join('/');

/** Source markers for starting a child process. `child_process` catches the `node:`-prefixed form too. */
const SPAWN_MARKERS = ['child_process', 'execFileSync', 'execSync', 'spawnSync'] as const;

/** Source markers for reading the wall clock. */
const WALL_CLOCK_MARKERS = ['Date.now(', 'performance.now(', 'process.hrtime'] as const;

/** Every jest-executed source file under `test/`, as `test/`-relative POSIX paths, sorted
 * (REQ-SYS-07 — `readdirSync` order is not guaranteed stable, so sort explicitly). */
function listTestSourceFiles(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const absolute = join(dir, entry);
    const relativePath = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(absolute).isDirectory()) {
      out.push(...listTestSourceFiles(absolute, relativePath));
    } else if (entry.endsWith('.ts') || entry.endsWith('.cjs')) {
      out.push(relativePath);
    }
  }
  return out;
}

const SCANNED_FILES = listTestSourceFiles(TEST_ROOT).filter((path) => path !== SELF);

describe('bug-011 — latency budgets are measured in-process, never across a process spawn', () => {
  it('scans a non-trivial, real set of test sources including the spawn-based CLI suites', () => {
    // Guards the guard: a broken path or filter would make every case below vacuously pass.
    expect(SCANNED_FILES.length).toBeGreaterThan(40);
    expect(SCANNED_FILES).toContain('cli/program.integration.test.ts');
    expect(SCANNED_FILES).toContain('core/query-latency.test.ts');
    expect(SCANNED_FILES).not.toContain(SELF);
  });

  it.each(SCANNED_FILES)(
    'test/%s does not wrap a wall-clock measurement around a spawned process',
    (relativePath) => {
      const source = readFileSync(join(TEST_ROOT, relativePath), 'utf-8');
      const spawnMarkers = SPAWN_MARKERS.filter((marker) => source.includes(marker));
      const clockMarkers = WALL_CLOCK_MARKERS.filter((marker) => source.includes(marker));

      // Only a file that does BOTH reproduces bug-011; report the clock markers found in such a file
      // so the failure names the exact API to move into an in-process benchmark.
      const clockMarkersInSpawningFile = spawnMarkers.length > 0 ? clockMarkers : [];
      expect(clockMarkersInSpawningFile).toEqual([]);
    },
  );
});

/**
 * task-060-publish-pipeline — the `dl-023` fresh-init + CLI smoke (`scripts/e2e-smoke.cjs`), which
 * `spec-015` §3 stage 3 runs against the `wingfoil` installed from the staging registry.
 *
 * Here it runs for real against the compiled `dist/cli.js` (built once by jest's `globalSetup`), so the
 * smoke the staging step depends on is itself exercised offline on every test run — only the command it
 * drives differs (`node dist/cli.js` here, the `wingfoil` bin on PATH at staging).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SMOKE_TEMPLATES, runSmoke, smokeSteps } from '../../scripts/e2e-smoke.cjs';

const REPO_ROOT = join(__dirname, '..', '..');
const DIST_CLI = join(REPO_ROOT, 'dist', 'cli.js');
const { version } = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as { version: string };

describe('dl-023 smoke (task-060) — scripts/e2e-smoke.cjs', () => {
  it('covers every supported init template', () => {
    expect(SMOKE_TEMPLATES).toEqual(['Scrum', 'Kanban']);
  });

  it('drives the dl-023 CLI surface, after init, per template — the exact ordered list (task-107 AC4)', () => {
    // Exact, not arrayContaining: bug-029 went unnoticed because omitting a step left this test green.
    expect(smokeSteps('Scrum').map((s) => s.args.join(' '))).toEqual([
      'init --template Scrum',
      'dna show --format json',
      'dna set project.name --value WingFoil smoke',
      'memory add --type task --title Smoke task --format json',
      'memory submit {task.id} --format json',
      'paths config --list --format json',
      'directives list --format json',
      'workflow list --format json',
    ]);
  });

  it('submits the task memory add created, and asserts the draft -> pending edge (task-107 AC1/AC2)', () => {
    const steps = smokeSteps('Kanban');
    const add = steps.find((s) => s.args[0] === 'memory' && s.args[1] === 'add');
    const submit = steps.find((s) => s.args[0] === 'memory' && s.args[1] === 'submit');
    expect(add).toMatchObject({ json: true, capture: 'task' });
    expect(submit).toMatchObject({ json: true, expect: { from: 'draft', to: 'pending' } });
  });

  it('passes against the compiled CLI: --help, --version, and a clean init + CLI run per template', () => {
    const report = runSmoke({ command: process.execPath, commandArgs: [DIST_CLI], expectedVersion: version });
    const failed = report.checks.filter((c) => !c.ok);
    expect(failed).toEqual([]);
    expect(report.ok).toBe(true);
    const labels = report.checks.map((c) => c.label);
    expect(labels).toContain('wingfoil --help');
    expect(labels).toContain(`wingfoil --version = ${version}`);
    for (const template of SMOKE_TEMPLATES) {
      expect(labels).toContain(`[${template}] wingfoil init --template ${template}`);
      // The placeholder is resolved from memory add's JSON: ids restart per type in a fresh project.
      expect(labels).toContain(`[${template}] wingfoil memory submit task-001-smoke-task --format json`);
      // task-107 AC3: the clean-tree check is the last one of each template's run.
      const own = labels.filter((l) => l.startsWith(`[${template}] `));
      expect(own[own.length - 1]).toBe(`[${template}] working tree clean after every mutation`);
    }
  });

  it('fails when the command exits non-zero, and stops before the per-template runs', () => {
    const report = runSmoke({ command: process.execPath, commandArgs: ['-e', 'process.exit(3)', '--'] });
    expect(report.ok).toBe(false);
    expect(report.checks).toHaveLength(1);
    expect(report.checks[0]).toMatchObject({ label: 'wingfoil --help', ok: false });
    expect(report.checks[0]?.detail).toContain('exit 3');
  });

  it('fails when the installed version is not the one staged', () => {
    const report = runSmoke({ command: process.execPath, commandArgs: [DIST_CLI], expectedVersion: '9.9.9' });
    expect(report.ok).toBe(false);
    expect(report.checks.find((c) => c.label === 'wingfoil --version = 9.9.9')?.ok).toBe(false);
  });

  describe('a step that depends on an earlier one (task-107 AC2/AC7) — against a stub wingfoil', () => {
    // A stub CLI: --help prints usage, `memory add` prints an id, `memory submit` obeys SMOKE_STUB,
    // every other command prints `{}`. It writes nothing, so the clean-tree check always passes.
    const STUB = [
      'const [a, b] = process.argv.slice(1);',
      'const mode = process.env.SMOKE_STUB;',
      "if (a === '--help') { console.log('Usage: wingfoil'); process.exit(0); }",
      "if (a === 'memory' && b === 'add') {",
      "  console.log(JSON.stringify(mode === 'no-id' ? { path: 'p' } : { id: 'task-001-stub', path: 'p' }));",
      '  process.exit(0);',
      '}',
      "if (a === 'memory' && b === 'submit') {",
      "  if (mode === 'fail') { console.error('error: boom'); process.exit(1); }",
      "  console.log(JSON.stringify({ id: process.argv[3], from: 'draft', to: mode === 'wrong-edge' ? 'approved' : 'pending' }));",
      '  process.exit(0);',
      '}',
      "console.log('{}');",
    ].join('\n');
    const stub = (mode: string) =>
      runSmoke({ command: process.execPath, commandArgs: ['-e', STUB, '--'], env: { ...process.env, SMOKE_STUB: mode } });

    it('passes when submit reports draft -> pending, with the captured id in its argv', () => {
      const report = stub('ok');
      expect(report.checks.filter((c) => !c.ok)).toEqual([]);
      expect(report.checks.map((c) => c.label)).toContain('[Scrum] wingfoil memory submit task-001-stub --format json');
    });

    it('reports a failing submit as the failing check, and stops there', () => {
      const report = stub('fail');
      expect(report.ok).toBe(false);
      const last = report.checks[report.checks.length - 1];
      expect(last).toMatchObject({ label: '[Scrum] wingfoil memory submit task-001-stub --format json', ok: false });
      expect(last?.detail).toContain('exit 1');
    });

    it('fails a submit that exits 0 on the wrong edge, naming what came back', () => {
      const report = stub('wrong-edge');
      expect(report.ok).toBe(false);
      const last = report.checks[report.checks.length - 1];
      expect(last?.label).toBe('[Scrum] wingfoil memory submit task-001-stub --format json');
      expect(last?.detail).toContain('to=approved');
    });

    it('fails, without spawning, when the placeholder cannot be resolved from the earlier output', () => {
      const report = stub('no-id');
      expect(report.ok).toBe(false);
      const last = report.checks[report.checks.length - 1];
      expect(last?.label).toBe('[Scrum] wingfoil memory submit {task.id} --format json');
      expect(last?.detail).toContain('{task.id}');
    });
  });
});

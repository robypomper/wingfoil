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

  it('drives the dl-023 CLI surface that ships today, after init, per template', () => {
    const commands = smokeSteps('Scrum').map((s) => s.args.slice(0, 2).join(' '));
    expect(commands[0]).toBe('init --template');
    expect(commands).toEqual(
      expect.arrayContaining(['dna show', 'dna set', 'memory add', 'paths config', 'directives list', 'workflow list']),
    );
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
      expect(labels).toContain(`[${template}] working tree clean after every mutation`);
    }
  });

  it('fails when the command exits non-zero, and stops before the per-template runs', () => {
    const report = runSmoke({ command: process.execPath, commandArgs: ['-e', 'process.exit(3)'] });
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
});

/**
 * task-136 review, finding 4 — the reason `workflow list` prints for a spec-003 error names the first
 * error's code and file (and path), as the pre-task `ValidationError` reason did. Runs the compiled
 * `dist/cli.js` (built once by jest's globalSetup, bug-003) in a fixture repository.
 */
import { spawnSync } from 'child_process';
import { join } from 'path';

import { makeTempGitRepo, removeTempDir, writeFixtureFile } from '../storage/helpers/git-fixture';

const CLI = join(__dirname, '..', '..', 'dist', 'cli.js');

describe('`wingfoil workflow list` — a spec-003 error names its code and file', () => {
  let repo: string;
  beforeEach(() => {
    repo = makeTempGitRepo();
    writeFixtureFile(repo, '.wingfoil/workflows.yaml', 'version: 1.0\ninclude:\n  - workflows/custom/main.yaml\n  - workflows/custom/bad.yaml\n');
    writeFixtureFile(repo, '.wingfoil/workflows/custom/main.yaml', 'name: main\nkind: main\nphases:\n  - name: go\n');
    // A phase with no `name`: a structural failure whose bare message names no file.
    writeFixtureFile(repo, '.wingfoil/workflows/custom/bad.yaml', 'name: bad\nkind: sub\nphases:\n  - description: nameless\n');
  });
  afterEach(() => removeTempDir(repo));

  it('console: exit 1, stderr carries the code, the path and the file', () => {
    const result = spawnSync(process.execPath, [CLI, 'workflow', 'list'], { cwd: repo, encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('E_VALIDATION');
    expect(result.stderr).toContain('phases[0].name');
    expect(result.stderr).toContain('workflows/custom/bad.yaml');
  });

  it('json: the `error` reason carries the same', () => {
    const result = spawnSync(process.execPath, [CLI, 'workflow', 'list', '--format', 'json'], { cwd: repo, encoding: 'utf8' });
    expect(result.status).toBe(1);
    const { error } = JSON.parse(result.stderr) as { error: string };
    expect(error).toMatch(/^E_VALIDATION phases\[0\]\.name \(workflows\/custom\/bad\.yaml\): /);
  });
});

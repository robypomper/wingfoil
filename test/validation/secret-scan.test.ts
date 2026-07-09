/**
 * task-043-secret-credential-hygiene (REQ-SEC-08) — secret/credential hygiene scan, built to
 * spec-007-secret-hygiene-patterns: the canonical pattern set (§2), exclusions (§3), and scan
 * procedure (§4). Every fixture "secret" below is an obviously-fake value (per the global
 * security-secrets directive) — none are real credentials.
 */
import {
  SECRET_PATTERNS,
  isBinaryContent,
  scanText,
  scanProjectSurface,
} from '../../src/validation/secret-scan';
import { git, makeTempGitRepo, removeTempDir, writeFixtureFile } from '../storage/helpers/git-fixture';

describe('SECRET_PATTERNS — canonical pattern set (spec-007 §2)', () => {
  it('declares exactly the 10 named rules from spec-007 §2, in declared order', () => {
    expect(SECRET_PATTERNS.map((p) => p.id)).toEqual([
      'private-key-pem',
      'generic-api-key-assignment',
      'aws-access-key-id',
      'aws-secret-access-key',
      'gcp-service-account-key',
      'github-token',
      'slack-token',
      'jwt-like',
      'generic-high-entropy-string',
      'dotenv-style-secret-line',
    ]);
  });

  it('classifies each pattern block/warn severity exactly as spec-007 §2', () => {
    const bySeverity = Object.fromEntries(SECRET_PATTERNS.map((p) => [p.id, p.severity]));
    expect(bySeverity['private-key-pem']).toBe('block');
    expect(bySeverity['generic-api-key-assignment']).toBe('block');
    expect(bySeverity['aws-access-key-id']).toBe('block');
    expect(bySeverity['aws-secret-access-key']).toBe('block');
    expect(bySeverity['gcp-service-account-key']).toBe('block');
    expect(bySeverity['github-token']).toBe('block');
    expect(bySeverity['slack-token']).toBe('block');
    expect(bySeverity['jwt-like']).toBe('warn');
    expect(bySeverity['generic-high-entropy-string']).toBe('warn');
    expect(bySeverity['dotenv-style-secret-line']).toBe('warn');
  });
});

describe('scanText — block-severity pattern shapes (spec-007 §2)', () => {
  it('flags a PEM private-key header', () => {
    const result = scanText('-----BEGIN RSA PRIVATE KEY-----\nMIIFAKEfake==\n', 'fixture.txt');
    expect(result.blocking.map((f) => f.patternId)).toContain('private-key-pem');
  });

  it('flags a generic api-key assignment', () => {
    const result = scanText('api_key: "sk_live_fake1234567890abcdef"\n', 'fixture.txt');
    expect(result.blocking.map((f) => f.patternId)).toContain('generic-api-key-assignment');
  });

  it('flags an AWS access key ID shape', () => {
    const result = scanText('aws_access_key_id = AKIAFAKEFAKEFAKEFAKE\n', 'fixture.txt');
    expect(result.blocking.map((f) => f.patternId)).toContain('aws-access-key-id');
  });

  it('flags an AWS secret access key assignment', () => {
    const result = scanText(
      'aws_secret_key: "fAkEsEcReT1234567890fAkEsEcReT1234567890"\n',
      'fixture.txt',
    );
    expect(result.blocking.map((f) => f.patternId)).toContain('aws-secret-access-key');
  });

  it('flags a GCP service-account JSON key fragment', () => {
    const result = scanText('  "type": "service_account",\n', 'fixture.json');
    expect(result.blocking.map((f) => f.patternId)).toContain('gcp-service-account-key');
  });

  it('flags a GitHub personal access token', () => {
    const result = scanText('ghp_fakeFAKEfakeFAKEfakeFAKEfakeFAKEfake\n', 'fixture.txt');
    expect(result.blocking.map((f) => f.patternId)).toContain('github-token');
  });

  it('flags a Slack bot token', () => {
    const result = scanText('xoxb-fake-1234567890-fakefakefakefake\n', 'fixture.txt');
    expect(result.blocking.map((f) => f.patternId)).toContain('slack-token');
  });
});

describe('scanText — warn-severity pattern shapes (spec-007 §2)', () => {
  it('warns (not blocks) on a JWT-shaped string', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYWtlIn0.fakefakefakefakefakefakefake';
    const result = scanText(`token = ${jwt}\n`, 'fixture.txt');
    expect(result.warnings.map((f) => f.patternId)).toContain('jwt-like');
    expect(result.blocking.map((f) => f.patternId)).not.toContain('jwt-like');
  });

  it('warns (not blocks) on a generic high-entropy string near a credential-shaped key', () => {
    const result = scanText('auth: fakeFAKEfakeFAKEfakeFAKEfakeFAKE1234\n', 'fixture.txt');
    expect(result.warnings.map((f) => f.patternId)).toContain('generic-high-entropy-string');
    expect(result.blocking.map((f) => f.patternId)).not.toContain('generic-high-entropy-string');
  });

  it('warns (not blocks) on a .env-style credential line', () => {
    const result = scanText('MY_TOKEN=fake1234567890abcdef\n', '.env.fixture');
    expect(result.warnings.map((f) => f.patternId)).toContain('dotenv-style-secret-line');
    expect(result.blocking.map((f) => f.patternId)).not.toContain('dotenv-style-secret-line');
  });
});

describe('scanText — deterministic ordering (REQ-SYS-07, spec-007 §4 step 3)', () => {
  it('orders same-line findings by pattern declaration order, not by match column', () => {
    // The api-key match sits at a LOWER column than the PEM-header match, yet private-key-pem is
    // declared first in SECRET_PATTERNS — the finding order must follow declaration order.
    const line = 'api_key: "sk_live_fake1234567890abcdef" -----BEGIN RSA PRIVATE KEY-----';
    const result = scanText(line, 'fixture.txt');
    expect(result.blocking.map((f) => f.patternId)).toEqual([
      'private-key-pem',
      'generic-api-key-assignment',
    ]);
  });
});

describe('scanText — exclusions (spec-007 §3)', () => {
  it('downgrades an all-X placeholder value to info, not blocking', () => {
    const result = scanText('api_key: "XXXXXXXXXXXXXXXXXXXX"\n', 'fixture.txt');
    expect(result.blocking).toHaveLength(0);
    const finding = result.info.find((f) => f.patternId === 'generic-api-key-assignment');
    expect(finding?.exemptReason).toBe('placeholder-value');
  });

  it('downgrades a literal REDACTED/PLACEHOLDER/EXAMPLE dotenv value to info, not warning', () => {
    for (const literal of ['REDACTED', 'PLACEHOLDER', 'EXAMPLE']) {
      const result = scanText(`API_TOKEN=${literal}\n`, '.env.fixture');
      expect(result.warnings).toHaveLength(0);
      const finding = result.info.find((f) => f.patternId === 'dotenv-style-secret-line');
      expect(finding?.exemptReason).toBe('placeholder-value');
    }
  });

  it('downgrades a finding inside a fence immediately preceded by <!-- example --> to info', () => {
    const content = [
      '<!-- example -->',
      '```',
      'api_key: "sk_live_fake1234567890abcdef"',
      '```',
    ].join('\n');
    const result = scanText(content, 'fixture.md');
    expect(result.blocking).toHaveLength(0);
    expect(result.info.some((f) => f.exemptReason === 'fenced-example')).toBe(true);
  });

  it('does NOT exempt a finding inside an unlabelled fence', () => {
    const content = ['```', 'api_key: "sk_live_fake1234567890abcdef"', '```'].join('\n');
    const result = scanText(content, 'fixture.md');
    expect(result.blocking.some((f) => f.patternId === 'generic-api-key-assignment')).toBe(true);
  });

  it('re-arms after a fence closes — a match after the fence is still blocking', () => {
    const content = [
      '<!-- example -->',
      '```',
      'ignored content',
      '```',
      'api_key: "sk_live_fake1234567890abcdef"',
    ].join('\n');
    const result = scanText(content, 'fixture.md');
    expect(result.blocking.some((f) => f.patternId === 'generic-api-key-assignment')).toBe(true);
  });

  it('downgrades every finding in a path-ignored file to info via pathIgnored', () => {
    const result = scanText('api_key: "sk_live_fake1234567890abcdef"\n', 'fixture.txt', {
      pathIgnored: true,
    });
    expect(result.blocking).toHaveLength(0);
    const finding = result.info.find((f) => f.patternId === 'generic-api-key-assignment');
    expect(finding?.exemptReason).toBe('ignore-path');
  });
});

describe('isBinaryContent — null-byte sniff on first 8KB (spec-007 §1)', () => {
  it('is false for plain text', () => {
    expect(isBinaryContent(Buffer.from('hello world\n', 'utf-8'))).toBe(false);
  });

  it('is true when a null byte appears within the first 8KB', () => {
    const buf = Buffer.concat([Buffer.from('hello'), Buffer.from([0x00]), Buffer.from('world')]);
    expect(isBinaryContent(buf)).toBe(true);
  });

  it('ignores a null byte beyond the first 8KB', () => {
    const head = Buffer.alloc(8192, 0x61); // 'a' repeated
    const buf = Buffer.concat([head, Buffer.from([0x00])]);
    expect(isBinaryContent(buf)).toBe(false);
  });
});

describe('scanProjectSurface — the REQ-SEC-08 Fit Criterion made checkable (spec-007 §1, §4 step 5)', () => {
  let repo: string;

  afterEach(() => removeTempDir(repo));

  it('scans tracked files under the configured surface roots and finds 0 blocking on clean content', () => {
    repo = makeTempGitRepo();
    writeFixtureFile(repo, '.wingfoil/dna.yaml', 'modules: [core]\n');
    writeFixtureFile(repo, 'docs/self/.wingfoil/roles.yaml', 'developer: [code-quality]\n');
    writeFixtureFile(repo, 'not-in-scope/outside.md', 'api_key: "sk_live_fake1234567890abcdef"\n');
    git(repo, ['add', '-A']);
    git(repo, ['commit', '--quiet', '-m', 'seed']);

    const result = scanProjectSurface(repo);
    expect(result.blocking).toHaveLength(0);
  });

  it('detects a real-shaped block finding committed under the scan surface', () => {
    repo = makeTempGitRepo();
    writeFixtureFile(
      repo,
      '.wingfoil/directives/custom/leaky.md',
      'api_key: "sk_live_fake1234567890abcdef"\n',
    );
    git(repo, ['add', '-A']);
    git(repo, ['commit', '--quiet', '-m', 'seed']);

    const result = scanProjectSurface(repo);
    expect(result.blocking.some((f) => f.file === '.wingfoil/directives/custom/leaky.md')).toBe(
      true,
    );
  });

  it('only scans tracked/staged files, not untracked working-tree noise', () => {
    repo = makeTempGitRepo();
    writeFixtureFile(repo, '.wingfoil/dna.yaml', 'modules: [core]\n');
    git(repo, ['add', '-A']);
    git(repo, ['commit', '--quiet', '-m', 'seed']);
    writeFixtureFile(repo, '.wingfoil/untracked-leak.md', 'api_key: "sk_live_fake1234567890abcdef"\n');

    const result = scanProjectSurface(repo);
    expect(result.blocking).toHaveLength(0);
  });

  it('honours a .wingfoil/security-ignore glob — an ignored path is downgraded to info', () => {
    repo = makeTempGitRepo();
    writeFixtureFile(repo, '.wingfoil/security-ignore', '.wingfoil/fixtures/**\n');
    writeFixtureFile(
      repo,
      '.wingfoil/fixtures/known-fake.md',
      'api_key: "sk_live_fake1234567890abcdef"\n',
    );
    git(repo, ['add', '-A']);
    git(repo, ['commit', '--quiet', '-m', 'seed']);

    const result = scanProjectSurface(repo);
    expect(result.blocking).toHaveLength(0);
    expect(result.info.some((f) => f.exemptReason === 'ignore-path')).toBe(true);
  });

  it('skips binary files under the scan surface without throwing', () => {
    repo = makeTempGitRepo();
    writeFixtureFile(repo, '.wingfoil/dna.yaml', 'modules: [core]\n');
    writeFixtureBinaryFile(repo, '.wingfoil/blob.bin', Buffer.from([0x00, 0x01, 0x02, 0xff]));
    git(repo, ['add', '-A']);
    git(repo, ['commit', '--quiet', '-m', 'seed']);

    expect(() => scanProjectSurface(repo)).not.toThrow();
  });
});

/** Write a binary fixture file (parent dirs created) — {@link writeFixtureFile} is utf-8-text-only. */
function writeFixtureBinaryFile(root: string, relativePath: string, content: Buffer): void {
  const { writeFileSync, mkdirSync } = require('fs') as typeof import('fs');
  const { join, dirname } = require('path') as typeof import('path');
  const absolute = join(root, relativePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
}

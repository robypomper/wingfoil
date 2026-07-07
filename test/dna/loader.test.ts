/**
 * P2.4 (US-0A-05) — Project DNA loader fit criteria, per
 * `docs/02_requirements/02_bdd/features/p2-dna/P2.4-project-dna-config.feature` and
 * `docs/self/docs/04_memory/design/specs/spec-002-dna-yaml-schema.md`. Exercises the REAL
 * `loadDnaYaml` + `DnaYaml` schema (task-004/task-027) end to end — no re-implementation of either.
 *
 * - "DNA file exists and is schema-valid after init" → AC(a) below, against the live
 *   `docs/self/.wingfoil/dna.yaml` fixture (the worked example spec-002 pins).
 * - "Agents read DNA as the authoritative project map" → AC(b), an arbitrary extra module
 *   round-trips through `.passthrough()`.
 * - "Error - malformed YAML in the DNA file" → AC(c), the one piece this task adds: `loadDnaYaml`
 *   maps a YAML syntax error to the exact fit-criterion message `invalid DNA: YAML parse error at
 *   line <n>` (not just the generic `E_YAML_PARSE_ERROR` every pillar loader already produces).
 */
import { join } from 'path';

import { loadDnaYaml } from '../../src/core/loaders';
import { ValidationError } from '../../src/validation';
import { makeTempGitRepo, removeTempDir, writeFixtureFile } from '../storage/helpers/git-fixture';

describe('loadDnaYaml — P2.4 fit criteria', () => {
  describe('AC(a): DNA file exists and is schema-valid after init', () => {
    // docs/self/.wingfoil/dna.yaml is the live, hand-authored worked example spec-002 pins.
    const liveRoot = join(__dirname, '..', '..', 'docs', 'self');

    it('validates and declares modules/stacks/team', () => {
      const dna = loadDnaYaml(liveRoot);
      expect(dna.modules.length).toBeGreaterThan(0);
      expect(dna.stacks).toBeDefined();
      expect(dna.team).toBeDefined();
      expect(dna.team.roles.length).toBeGreaterThan(0);
    });
  });

  describe('AC(b): agents read DNA as the authoritative project map', () => {
    let repo: string;

    beforeEach(() => {
      repo = makeTempGitRepo();
      writeFixtureFile(
        repo,
        '.wingfoil/dna.yaml',
        `
version: 1.1
modules:
  - name: core
    path: src/core
  - name: billing
    description: Arbitrary extra module not otherwise wired into the schema.
    path: src/billing
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
`,
      );
    });

    afterEach(() => {
      removeTempDir(repo);
    });

    it('returns the "billing" module in the parsed structure', () => {
      const dna = loadDnaYaml(repo);
      expect(dna.modules.map((m) => m.name)).toContain('billing');
    });
  });

  describe('AC(c): malformed YAML in the DNA file', () => {
    let repo: string;

    beforeEach(() => {
      repo = makeTempGitRepo();
    });

    afterEach(() => {
      removeTempDir(repo);
    });

    it('fails with "invalid DNA: YAML parse error at line <n>"', () => {
      // Bad indentation on line 3 — js-yaml reports this position in its parse exception.
      writeFixtureFile(repo, '.wingfoil/dna.yaml', 'modules:\n  - name: core\n  bad: [1, 2\n');

      expect(() => loadDnaYaml(repo)).toThrow(ValidationError);
      try {
        loadDnaYaml(repo);
        fail('expected loadDnaYaml to throw');
      } catch (err) {
        const validationError = err as ValidationError;
        expect(validationError.issues[0]?.message).toBe('invalid DNA: YAML parse error at line 3');
      }
    });

    it('reports the correct line number for a different malformed document', () => {
      // Unclosed flow sequence starting on line 1 — js-yaml reports the failure on line 2.
      writeFixtureFile(repo, '.wingfoil/dna.yaml', 'modules: [1, 2\n');

      try {
        loadDnaYaml(repo);
        fail('expected loadDnaYaml to throw');
      } catch (err) {
        const validationError = err as ValidationError;
        expect(validationError.issues[0]?.message).toBe('invalid DNA: YAML parse error at line 2');
      }
    });
  });
});

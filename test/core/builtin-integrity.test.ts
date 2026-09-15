/**
 * task-044-builtin-template-integrity (REQ-SEC-10) — `verifyBuiltinTemplates`, the pure check that
 * guards P3.8 built-in directive templates and P4.17 built-in workflow templates against corruption
 * before `wingfoil init` writes anything (BDD `p3-directives/P3.8-builtin-directive-templates.feature`
 * "Error - a built-in template fails its integrity check"; `p4-workflow/P4.17-builtin-workflow-templates.feature`
 * "Error - a built-in workflow template is structurally invalid").
 */
import { verifyBuiltinTemplates, type BuiltinTemplateSource } from '../../src/core/builtin-integrity';

const VALID_DIRECTIVE: BuiltinTemplateSource = {
  name: 'security',
  kind: 'directive',
  content: `---
id: "security"
name: security
type: directive
kind: built-in
title: Security
ref: [P3.8]
---

# Security

Validate all inputs; apply least privilege.
`,
};

const VALID_WORKFLOW: BuiltinTemplateSource = {
  name: 'task',
  kind: 'workflow',
  content: `name: task
kind: sub
description: "Built-in task sub-workflow"
phases:
  - name: plan
`,
};

describe('verifyBuiltinTemplates — passing sources (REQ-SEC-10)', () => {
  it('returns null (no failure) for an empty source list — the shipped default today', () => {
    expect(verifyBuiltinTemplates([])).toBeNull();
  });

  it('returns null when every directive + workflow source is schema-valid', () => {
    expect(verifyBuiltinTemplates([VALID_DIRECTIVE, VALID_WORKFLOW])).toBeNull();
  });
});

describe('verifyBuiltinTemplates — corrupted directive source (P3.8 BDD)', () => {
  it('fails a directive source with no frontmatter block at all (corrupted source)', () => {
    const corrupted: BuiltinTemplateSource = { name: 'security', kind: 'directive', content: '# no frontmatter here\n' };
    const failure = verifyBuiltinTemplates([corrupted]);
    expect(failure).toEqual({
      name: 'security',
      kind: 'directive',
      message: 'built-in directive template integrity check failed: security',
    });
  });

  it('fails a directive source missing a required frontmatter field (schema-invalid)', () => {
    const corrupted: BuiltinTemplateSource = {
      name: 'security',
      kind: 'directive',
      // `type: directive` is required by DirectiveFrontmatter — omitted here.
      content: `---
id: "security"
name: security
kind: built-in
title: Security
---

# Security
`,
    };
    const failure = verifyBuiltinTemplates([corrupted]);
    expect(failure?.message).toBe('built-in directive template integrity check failed: security');
  });

  it('fails a directive source whose frontmatter is not valid YAML at all (tampered bytes)', () => {
    const corrupted: BuiltinTemplateSource = {
      name: 'security',
      kind: 'directive',
      content: '---\nname: [unterminated\n---\nbody\n',
    };
    const failure = verifyBuiltinTemplates([corrupted]);
    expect(failure?.name).toBe('security');
    expect(failure?.kind).toBe('directive');
  });
});

describe('verifyBuiltinTemplates — structurally invalid workflow source (P4.17 BDD)', () => {
  it('fails a workflow source missing required `phases` (schema-invalid)', () => {
    const invalid: BuiltinTemplateSource = {
      name: 'task',
      kind: 'workflow',
      content: 'name: task\nkind: sub\ndescription: "Built-in task sub-workflow"\n',
    };
    const failure = verifyBuiltinTemplates([invalid]);
    expect(failure).toEqual({
      name: 'task',
      kind: 'workflow',
      message: 'built-in workflow template invalid: task',
    });
  });

  it('fails a workflow source with an out-of-enum `kind`', () => {
    const invalid: BuiltinTemplateSource = {
      name: 'task',
      kind: 'workflow',
      content: 'name: task\nkind: not-a-real-kind\nphases:\n  - name: plan\n',
    };
    const failure = verifyBuiltinTemplates([invalid]);
    expect(failure?.message).toBe('built-in workflow template invalid: task');
  });
});

describe('verifyBuiltinTemplates — deterministic first-failure order (REQ-SYS-07)', () => {
  it('reports the FIRST failing source in list order when several are corrupted', () => {
    const badDirective: BuiltinTemplateSource = { name: 'first-bad', kind: 'directive', content: 'no frontmatter\n' };
    const badWorkflow: BuiltinTemplateSource = { name: 'second-bad', kind: 'workflow', content: 'name: task\n' };
    const failure = verifyBuiltinTemplates([VALID_DIRECTIVE, badDirective, badWorkflow]);
    expect(failure?.name).toBe('first-bad');
  });

  it('two runs over the same input produce the identical failure (no wall-clock/randomness)', () => {
    const badWorkflow: BuiltinTemplateSource = { name: 'task', kind: 'workflow', content: 'name: task\n' };
    expect(verifyBuiltinTemplates([badWorkflow])).toEqual(verifyBuiltinTemplates([badWorkflow]));
  });
});

/**
 * Second pass (review-gate `red` fallback) — REQ-SEC-10 fail-closed default. `INTEGRITY_POLICY` is
 * keyed by {@link BuiltinTemplateKind}; indexing it with a `kind` OUTSIDE that union yields
 * `undefined` (or, worse, an inherited `Object.prototype` member) and the policy call then throws a
 * `TypeError`. `initWingfoilProject` invokes `verifyBuiltinTemplates` OUTSIDE its `try`/`catch`, so
 * such a throw escapes as an uncaught exception instead of the `VALIDATION` CoreResult / exit 1 the
 * fit criterion requires. Unreachable from TypeScript today, but `verifyBuiltinTemplates` is a public
 * barrel export (`src/core/index.ts`) and becomes reachable the moment sources are derived from disk
 * by extension, or a caller crosses a JS/JSON boundary. An unrecognized kind must FAIL, not throw.
 */
describe('verifyBuiltinTemplates — fail-closed on an unrecognized kind (REQ-SEC-10)', () => {
  /** Forge a source whose `kind` is outside the union (only reachable through a cast). */
  const alien = (kind: string): BuiltinTemplateSource =>
    ({ name: 'mystery', kind, content: 'anything\n' }) as unknown as BuiltinTemplateSource;

  it('does not throw when a source carries a kind outside BuiltinTemplateKind', () => {
    expect(() => verifyBuiltinTemplates([alien('plugin')])).not.toThrow();
  });

  it('reports the unrecognized-kind source as a failure naming the template', () => {
    const failure = verifyBuiltinTemplates([alien('plugin')]);
    expect(failure).not.toBeNull();
    expect(failure?.name).toBe('mystery');
    expect(failure?.message).toContain('mystery');
  });

  it('fails closed on inherited Object.prototype keys — no prototype member is mistaken for a policy', () => {
    for (const inherited of ['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf']) {
      expect(() => verifyBuiltinTemplates([alien(inherited)])).not.toThrow();
      expect(verifyBuiltinTemplates([alien(inherited)])).not.toBeNull();
    }
  });

  it('keeps deterministic first-failure order with an unrecognized kind in the middle', () => {
    const failure = verifyBuiltinTemplates([VALID_DIRECTIVE, alien('plugin'), VALID_WORKFLOW]);
    expect(failure?.name).toBe('mystery');
  });
});

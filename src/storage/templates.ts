/**
 * Methodology templates for `wingfoil init` (task-029-implement-wingfoil-init, P5.1.1,
 * spec-011-storage-layout). task-018 delivered only the minimal committed skeleton
 * (`scaffoldFiles()` in ./layout) and EXPLICITLY deferred the complete spec-011 layout — `roles.yaml`,
 * the `directives/{built-in,custom}` and `workflows/{built-in,custom}` splits, `memory/templates/`,
 * and real starter content — to this module. `templateScaffold(def)` returns that complete layout as
 * a `ScaffoldFile[]` the same `initStorage(root, files, message)` write+commit path consumes.
 *
 * A "template" (Scrum, Kanban — the names the P5.1.1 BDD uses as examples) is an AUTHORING starter:
 * it selects the project's methodologies (written into `dna.yaml` `stacks.methodologies`) and a
 * methodology-flavoured delivery sub-workflow; it is not a spec-mandated schema. All generated content
 * is a pure function of the `TemplateDefinition` — no wall-clock, no randomness, no environment read —
 * so `wingfoil init --template X` is byte-identical run to run (REQ-SYS-07), and the returned list is
 * sorted by path so callers may diff the set safely.
 */
import { WINGFOIL_DIR, type ScaffoldFile } from './layout';

/** A methodology starter template: the methodologies it seeds and the delivery sub-workflow it adds. */
export interface TemplateDefinition {
  /** Canonical display name, e.g. `Scrum` (matched case-insensitively by {@link resolveTemplate}). */
  readonly name: string;
  /** One-line human description surfaced in the wizard and generated headers. */
  readonly description: string;
  /** Methodologies written into `dna.yaml` `stacks.methodologies`. */
  readonly methodologies: readonly string[];
  /** Lower-case slug used for the delivery workflow filename (`<slug>-delivery.yaml`). */
  readonly slug: string;
  /** Human sentence describing the delivery cadence, embedded in the delivery workflow. */
  readonly cadence: string;
}

const SCRUM: TemplateDefinition = {
  name: 'Scrum',
  description: 'Sprint-based iterative delivery with fixed-length timeboxes.',
  methodologies: ['Scrum', 'Specification by Example (BDD)', 'TDD'],
  slug: 'scrum',
  cadence: 'Work is delivered in fixed-length sprints; each sprint plans, builds, reviews and retrospects a slice of the backlog.',
};

const KANBAN: TemplateDefinition = {
  name: 'Kanban',
  description: 'Continuous-flow delivery with work-in-progress limits.',
  methodologies: ['Kanban', 'Specification by Example (BDD)', 'TDD'],
  slug: 'kanban',
  cadence: 'Work flows continuously across the board under explicit WIP limits; there are no timeboxed iterations.',
};

/** The built-in methodology templates. Order fixed for deterministic listing (REQ-SYS-07). */
export const TEMPLATES: readonly TemplateDefinition[] = [SCRUM, KANBAN];

/** Canonical template names, in registry order (used by the wizard prompt and error messages). */
export const TEMPLATE_NAMES: readonly string[] = TEMPLATES.map((t) => t.name);

/** The template the wizard falls back to when the user selects nothing (first registered template). */
export const DEFAULT_TEMPLATE: string = SCRUM.name;

/** Resolve a (case-insensitive) template name to its canonical definition, or `null` if unknown. */
export function resolveTemplate(name: string): TemplateDefinition | null {
  const wanted = name.trim().toLowerCase();
  return TEMPLATES.find((t) => t.name.toLowerCase() === wanted) ?? null;
}

/** The single git subject `wingfoil init` commits (names the chosen template; deterministic). */
export function initProjectCommitMessage(def: TemplateDefinition): string {
  return `chore(wingfoil): initialize .wingfoil/ with the ${def.name} template (P5.1.1)`;
}

// --- Content generators -----------------------------------------------------------------------
// Every generator is a pure function of its inputs (REQ-SYS-07): fixed strings only, no Date/random.

const wf = (relative: string): string => `${WINGFOIL_DIR}/${relative}`;

/** The Memory element types spec-011 requires a template scaffold for, in fixed order. */
const MEMORY_TYPES = ['adr', 'bug', 'decision-log', 'release', 'release-line', 'task', 'tech-spec'] as const;

/**
 * The role-based directives every starter project gets. The six P3.8 categories carry `ref: [P3.8]`;
 * the four cross-cutting rules are AUTHORING starters the user tailors.
 */
const DIRECTIVES: ReadonlyArray<{ name: string; title: string; summary: string; p38: boolean }> = [
  { name: 'architecture', title: 'Architecture', summary: 'Keep the system decomposed into cohesive, loosely-coupled modules; document boundaries.', p38: true },
  { name: 'code-quality', title: 'Code quality', summary: 'Prefer clear, small, well-named units; no dead code; consistent formatting via the linter.', p38: true },
  { name: 'code-review', title: 'Code review', summary: 'Every change is reviewed for correctness, tests, and adherence to the directives before merge.', p38: true },
  { name: 'determinism', title: 'Determinism', summary: 'No wall-clock, randomness, or unordered iteration in context-building paths; prefer declared config.', p38: false },
  { name: 'doc-versioning', title: 'Documentation versioning', summary: 'Bump a document version only on the first edit after it was committed; update its date when bumping.', p38: false },
  { name: 'documentation', title: 'Documentation', summary: 'Keep user- and developer-facing docs in step with behaviour; document the why, not just the what.', p38: true },
  { name: 'security', title: 'Security', summary: 'Validate all inputs; apply least privilege; review dependencies for known vulnerabilities.', p38: true },
  { name: 'security-secrets', title: 'Secret hygiene', summary: 'Never commit credentials or secrets; the repository is the single source of truth and is shared.', p38: false },
  { name: 'testing', title: 'Testing', summary: 'Test-first: write a failing test before the implementation; keep meaningful coverage high.', p38: true },
  { name: 'traceability', title: 'Traceability', summary: 'Maintain the feature -> story -> acceptance -> requirement -> task chain across every change.', p38: false },
];

function dnaYaml(def: TemplateDefinition): string {
  const methodologies = def.methodologies.map((m) => `    - ${m}`).join('\n');
  return `# Project DNA (P2.4) — scaffolded by \`wingfoil init\` (${def.name} template).
# Structural map of the project: modules, stacks, team + roles, resource paths. Customize freely.
version: 1

project:
  name: ""                        # your project name
  description: ""
  methodology: ${def.name}        # ${def.description}

# Modules — the parts of the system (anatomy for navigation). Add your own.
modules: []

# Stacks — technologies + methodologies in use. The methodologies come from the ${def.name} template.
stacks:
  technologies: []
  methodologies:
${methodologies}

# Team & roles — AI agents execute as developer/reviewer/qa/architect and never hold approval authority.
team:
  roles:
    - developer
    - reviewer
    - qa
    - architect
    - product-owner
    - tech-lead
    - approver

# Resource paths — query categories used to navigate the project.
paths:
  sources: []
  tests: []
  docs: []
  config: [.wingfoil]
  governance: []
`;
}

function memoryYaml(): string {
  const types = MEMORY_TYPES.map(
    (type) => `  ${type}:
    path: docs/memory/${type}/{id}.md
    template:
      file: memory/templates/${type}.md
      frontmatter:
        required: [id, type, title, status]`,
  ).join('\n');
  return `# Memory element schema (P1.13) — scaffolded by \`wingfoil init\`.
# One entry per element type: its path pattern, its scaffold template, and (per type) its state
# machine. There is NO global state machine — customize each type's states for your process.
version: 1

types:
${types}
`;
}

function rolesYaml(): string {
  return `# Directive role assignments (P3.2/P3.7) — scaffolded by \`wingfoil init\`.
# Binds directives to roles by NAME, independent of the built-in/custom subfolder holding the file.
version: 1

assignments:
  developer:
    - code-quality
    - testing
    - determinism
  reviewer:
    - code-review
    - traceability
  qa:
    - testing
  architect:
    - architecture
    - determinism
    - traceability
  product-owner:
    - traceability
  tech-lead:
    - architecture
    - code-review

# Global directives apply to every role.
global:
  - doc-versioning
  - documentation
  - security-secrets
`;
}

/** Ordered list of custom workflow filenames the manifest composes (main workflows + delivery sub). */
function customWorkflowFiles(def: TemplateDefinition): string[] {
  return [
    'sw-life-cycle.yaml',
    'bug-ingest.yaml',
    'decision-log-ingest.yaml',
    'adr-ingest.yaml',
    `${def.slug}-delivery.yaml`,
  ];
}

function workflowsYaml(def: TemplateDefinition): string {
  const includes = customWorkflowFiles(def)
    .map((f) => `  - workflows/custom/${f}`)
    .join('\n');
  return `# Project Workflow main configuration (P4.1) — scaffolded by \`wingfoil init\`.
# This MAIN config file does not inline workflows; it include()s the custom (and, once populated,
# built-in) workflow files. Startable mains + the ${def.name} delivery sub-workflow are composed below.
version: 1

include:
${includes}
`;
}

function directiveMd(d: (typeof DIRECTIVES)[number]): string {
  const ref = d.p38 ? '\nref: [P3.8]' : '';
  return `---
name: ${d.name}
kind: custom${ref}
---

# ${d.title}

${d.summary}

<!-- Tailor this rule to your project's needs. Directives are auto-loaded per role (roles.yaml). -->
`;
}

function memoryTemplateMd(type: string): string {
  return `---
id: ""
type: ${type}
title: ""
status: draft
---

<!-- ${type} body. \`wingfoil memory add\` copies this scaffold verbatim; \`memory submit\` replaces
     these placeholder comments with real content and fills the required frontmatter fields. -->
`;
}

function mainWorkflowYaml(name: string, description: string, phasesYaml: string): string {
  return `# ${description}
name: ${name}
kind: main
description: "${description}"
${phasesYaml}`;
}

function deliveryWorkflowYaml(def: TemplateDefinition): string {
  return `# ${def.name} delivery loop (sub-workflow) — scaffolded by \`wingfoil init\`.
# ${def.cadence}
name: ${def.slug}-delivery
kind: sub
description: "${def.name} delivery loop"
phases:
  - name: plan
    description: "Select the next slice of work to deliver."
  - name: build
    description: "Implement the work test-first (TDD)."
  - name: review
    description: "Review against the directives; run unit + acceptance tests."
  - name: deliver
    description: "Integrate the completed work."
`;
}

/**
 * The COMPLETE spec-011 `.wingfoil/` layout for `def`, as a `ScaffoldFile[]` sorted by path
 * (deterministic — REQ-SYS-07). Consumed by `initStorage(root, files, message)`; every path is under
 * `.wingfoil/` so init never writes outside the WingFoil root.
 */
export function templateScaffold(def: TemplateDefinition): ScaffoldFile[] {
  const files: ScaffoldFile[] = [
    // Top-level pillar config (spec-011 "Top-level config files").
    { path: wf('dna.yaml'), content: dnaYaml(def) },
    { path: wf('memory.yaml'), content: memoryYaml() },
    { path: wf('roles.yaml'), content: rolesYaml() },
    { path: wf('workflows.yaml'), content: workflowsYaml(def) },
    // Directives built-in/custom split (spec-011).
    { path: wf('directives/built-in/.gitkeep'), content: '' },
    ...DIRECTIVES.map((d) => ({ path: wf(`directives/custom/${d.name}.md`), content: directiveMd(d) })),
    // Memory templates — one scaffold per element type (spec-011).
    ...MEMORY_TYPES.map((type) => ({ path: wf(`memory/templates/${type}.md`), content: memoryTemplateMd(type) })),
    // Workflows built-in/custom split (spec-011).
    { path: wf('workflows/built-in/.gitkeep'), content: '' },
    {
      path: wf('workflows/custom/sw-life-cycle.yaml'),
      content: mainWorkflowYaml(
        'sw-life-cycle',
        'The end-to-end software life cycle',
        `phases:
  - name: inception
  - name: specification
  - name: delivery
    include: workflows/custom/${def.slug}-delivery.yaml
  - name: sunset
`,
      ),
    },
    {
      path: wf('workflows/custom/bug-ingest.yaml'),
      content: mainWorkflowYaml('bug-ingest', 'Capture a bug on demand', 'phases:\n  - name: capture\n'),
    },
    {
      path: wf('workflows/custom/decision-log-ingest.yaml'),
      content: mainWorkflowYaml('decision-log-ingest', 'Capture a decision-log on demand', 'phases:\n  - name: capture\n'),
    },
    {
      path: wf('workflows/custom/adr-ingest.yaml'),
      content: mainWorkflowYaml('adr-ingest', 'Capture an ADR on demand', 'phases:\n  - name: capture\n'),
    },
    { path: wf(`workflows/custom/${def.slug}-delivery.yaml`), content: deliveryWorkflowYaml(def) },
  ];
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

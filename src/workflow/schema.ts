/**
 * `workflows.yaml` manifest (Layer 1) + Workflow DSL (Layer 2) schemas
 * (spec-003-workflows-yaml-schema, P4.1). This is one of the three independent per-pillar schemas
 * task-004-decoupled-pillars keeps decoupled (REQ-SYS-02): neither layer depends on `memory.yaml`'s
 * or `dna.yaml`'s schema. Cross-file concerns spec-003 itself calls out — resolving each `include`
 * path against the filesystem, and requiring at least one loaded workflow to be `kind: main` — need
 * the caller to have actually loaded the referenced files, so per spec-009-validation-strategy §1
 * ("Cross-file ... these require the caller to have already loaded ... so they run as a list of
 * caller-supplied SemanticCheck functions") those two checks live in the loader
 * (`src/core/loaders.ts`), not in this schema module.
 *
 * Every object node is `.passthrough()` per spec-009 §2.
 */
import { z } from 'zod';

import { idPatternIssues } from '../validation/id';

/**
 * Layer 1 — the main manifest (`.wingfoil/workflows.yaml`). `include` (singular) is the canonical
 * key per spec-003's required rename from the legacy plural `includes:`; a document that still uses
 * `includes:` fails Pass 1 here (missing required `include`) and `includes` itself is preserved only
 * as an unknown, passed-through key.
 */
export const WorkflowsYaml = z
  .object({
    version: z.number().positive().optional(),
    include: z.array(z.string()).min(1),
  })
  .passthrough();
export type WorkflowsYaml = z.infer<typeof WorkflowsYaml>;

/** Free-form assertion string, e.g. `tests.coverage(min: 80)`, `frontmatter.required: [title]`. */
const Check = z.string();

const WhereValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number(), z.boolean()])),
]);

/** A `memory.add(...)` action string (`dl-107` S3 (a)). */
const MEMORY_ADD_ACTION_RE = /^\s*memory\.add\s*\(/;

/** The `id_pattern:` argument of an action, double- or single-quoted. */
const ID_PATTERN_ARG_RE = /\bid_pattern\s*:\s*(?:"([^"]*)"|'([^']*)')/;

/**
 * A phase's `actions` list. Actions stay free-form strings (spec-003), with one checked argument: a
 * `memory.add(...)` action may override its type's `id_pattern` for that one add
 * (`spec-001-memory-yaml-schema` "Per-action override", `dl-107` S3 (a), task-110), and that override
 * is validated like any other pattern — `idPatternIssues` (`src/validation/id.ts`). A dotted token
 * such as `{release.version}` is refused until `dl-090` defines how it resolves. Every other argument,
 * and every other action, is left as it was.
 */
const Actions = z.array(z.string()).superRefine((actions, ctx) => {
  actions.forEach((action, index) => {
    if (!MEMORY_ADD_ACTION_RE.test(action)) return;
    const match = ID_PATTERN_ARG_RE.exec(action);
    if (match === null) return;
    const pattern = match[1] ?? match[2] ?? '';
    for (const issue of idPatternIssues(pattern)) {
      ctx.addIssue({ code: 'custom', path: [index], message: `memory.add id_pattern "${pattern}": ${issue}` });
    }
  });
});

/**
 * One `phases[]` entry of a Layer-2 workflow definition (spec-003) — a named step with its optional
 * `role`, `actions`, `include`, `iterate_over`/`where`, `produces`, `checks`, `approval`, and
 * `fallback`. `.passthrough()` per spec-009 §2.
 */
export const Phase = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    role: z.string().optional(),
    optional: z.boolean().default(false),
    actions: Actions.optional(),
    include: z.string().optional(),
    iterate_over: z.string().optional(),
    where: z.record(z.string(), WhereValue).optional(),
    produces: z.array(z.string()).optional(),
    checks: z
      .object({ pre: z.array(Check).optional(), post: z.array(Check).optional() })
      .passthrough()
      .optional(),
    approval: z.object({ by_role: z.string() }).passthrough().optional(),
    fallback: z.object({ step: z.string(), set_state: z.string().optional() }).passthrough().optional(),
  })
  .passthrough();
/** Parsed shape of the {@link Phase} schema. */
export type Phase = z.infer<typeof Phase>;

/** Layer 2 — one workflow-definition file (`.wingfoil/workflows/**\/*.yaml`). */
export const Workflow = z
  .object({
    name: z.string(),
    kind: z.enum(['main', 'sub']),
    description: z.string().optional(),
    version: z.number().positive().optional(),
    element: z.string().optional(),
    phases: z.array(Phase).min(1),
  })
  .passthrough();
export type Workflow = z.infer<typeof Workflow>;

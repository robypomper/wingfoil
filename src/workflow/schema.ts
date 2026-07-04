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

export const Phase = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    role: z.string().optional(),
    optional: z.boolean().default(false),
    actions: z.array(z.string()).optional(),
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

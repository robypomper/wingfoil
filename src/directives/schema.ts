/**
 * DirectiveFrontmatter schema (task-004-decoupled-pillars, REQ-SYS-02) — the fourth pillar named by
 * this task's Acceptance Criteria ("memory.yaml, dna.yaml, directives/*.yaml, and workflows.yaml
 * each validate against their own Zod schema independently").
 *
 * UNLIKE memory.yaml/dna.yaml/workflows.yaml, there is currently no dedicated, approved tech-spec
 * for the Directives pillar's own file shape: spec-010-memory-frontmatter-schema's scope is
 * explicitly `docs/self/docs/04_memory/**\/*.md frontmatter` (Memory documents), not
 * `.wingfoil/directives/**` (Directives files are `.md` with YAML frontmatter, not `.yaml` — the
 * AC's "directives/*.yaml" phrasing does not match the real file extension either). This schema is
 * therefore an [AUTHORING]-level minimal shape, grounded directly in the fields every one of the
 * ten real files under `docs/self/.wingfoil/directives/custom/*.md` actually carries (`id`, `name`,
 * `type: directive`, `kind`, `title`, `tags`, `ref`, and — on two files — `scope`), not a
 * transcription of an approved spec. See this task's Execution Notes for why this was not treated
 * as a hard STOP (design-gap) and the follow-up this leaves for the reviewer/approver (a candidate
 * `spec-013-directive-frontmatter-schema`).
 *
 * `name` is REQUIRED, not merely observed: REQ-SYS-02's own traceability cites
 * `p3-directives/P3.5-project-directives.feature`, whose "Error - a directive file missing required
 * header fields" scenario is explicit ("Given a custom directive file lacks its required 'name'
 * header ... Then loading reports the file as invalid") — the one piece of that BDD contract this
 * schema honors even without a tech-spec of its own.
 *
 * `.passthrough()` per spec-009-validation-strategy §2, matching every other pillar schema.
 */
import { z } from 'zod';

/**
 * The YAML frontmatter of a `.wingfoil/directives/**\/*.md` file — the minimal [AUTHORING] shape
 * grounded in the fields the real custom directive files carry (see the module doc for why there is
 * no dedicated tech-spec). `name` is required per REQ-SYS-08's BDD contract. `.passthrough()` per
 * spec-009 §2.
 */
export const DirectiveFrontmatter = z
  .object({
    id: z.string(),
    name: z.string(),
    type: z.literal('directive'),
    kind: z.string(),
    title: z.string(),
    tags: z.array(z.string()).optional(),
    ref: z.array(z.string()).optional(),
  })
  .passthrough();
/** Parsed shape of the {@link DirectiveFrontmatter} schema. */
export type DirectiveFrontmatter = z.infer<typeof DirectiveFrontmatter>;

/**
 * `.wingfoil/roles.yaml` schema (task-037-role-task-scoped-context, REQ-STATE-05's
 * `directive-loader`, P3.2/P3.7) — the role → directive binding config
 * `resolveRoleDirectives`/`assembleExecutionContext` (`src/core/context.ts`) resolve against. Same
 * [AUTHORING]-level rationale as {@link DirectiveFrontmatter}: no dedicated tech-spec covers this
 * pillar's own file shapes yet (spec-012-context-loader-relevance-filtering §5 describes the
 * `directive-loader`'s *behavior* — "look up the request role in `roles.yaml`" — but not roles.yaml's
 * own schema), so this is grounded directly in the fields the real, live
 * `docs/self/.wingfoil/roles.yaml` file carries: `version`, `assignments` (role name -> directive id
 * array), and `global` (directive ids applied to every role). `assignments` keys are role names
 * (validated against `dna.yaml`'s `team.roles` catalogue elsewhere, by REQ-SYS-08/task-034 — NOT here,
 * to keep this pillar's schema independent per REQ-SYS-02); `assignments` values and `global` entries
 * are directive **ids** (`DirectiveFrontmatter.id`), not `name`s. `.passthrough()` per spec-009 §2.
 */
export const RolesYaml = z
  .object({
    version: z.number().optional(),
    assignments: z.record(z.string(), z.array(z.string())),
    global: z.array(z.string()).default([]),
  })
  .passthrough();
/** Parsed shape of the {@link RolesYaml} schema. */
export type RolesYaml = z.infer<typeof RolesYaml>;

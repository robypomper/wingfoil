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
 * `.passthrough()` per spec-009-validation-strategy §2, matching every other pillar schema.
 */
import { z } from 'zod';

export const DirectiveFrontmatter = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    type: z.literal('directive'),
    kind: z.string(),
    title: z.string(),
    tags: z.array(z.string()).optional(),
    ref: z.array(z.string()).optional(),
  })
  .passthrough();
export type DirectiveFrontmatter = z.infer<typeof DirectiveFrontmatter>;

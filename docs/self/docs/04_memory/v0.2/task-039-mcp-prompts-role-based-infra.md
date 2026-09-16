---
id: "task-039-mcp-prompts-role-based-infra"
type: task
title: "Infrastructure: REQ-INT-02 — MCP Prompts role-based"
status: in-progress
release: "v0.2"
priority: "Blocker"
tags: ["v0.2", "integrations"]
ref: "REQ-INT-02"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

Implement the Integrations constraint **REQ-INT-02** (MCP Prompts endpoint returns role-scoped prompts).

## Acceptance Criteria

Satisfies the Fit Criterion for **REQ-INT-02** in `docs/02_requirements/03_sard/04_integrations.md`.

## Implementation Notes

Infrastructure under the P5.2.2 MCP Prompts feature and P3.6 auto-load.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

### `design` — architect

**Scope boundary (task-039 infra vs `task-058-mcp-prompts-role-based` feature).** The two tasks split
exactly the way `task-011-mcp-resources-read-only` (REQ-INT-01, infra) and
`task-030-implement-mcp-resources` (P5.2.1, feature) already split this same surface, and the split is
written down in an approved spec rather than invented here: `spec-014-mcp-server-entry-point` §3 says
"when Prompts ship (P5.2.2, v0.2), it [`createMcpServer`] adds their registrar". So:

- **This task** ships the Prompts *channel registrar* — `registerRolePrompts` in `src/mcp/prompt.ts`,
  exported from `src/mcp/index.ts` — and the `spec-004-mcp-surface-contract` §3 contract it honours,
  exercised end to end over the MCP SDK's in-memory transport + a real `Client` (the same way
  task-011's Resources channel was exercised before task-030 productionised it).
- **`task-058` (P5.2.2)** wires that registrar into `createMcpServer` (spec-014 §3) and owns the BDD
  scenarios of `p5-interaction/P5.2.2-mcp-prompts.feature`, including its third scenario's error string
  `no prompt for undefined role 'wizard'` — deliberately **not** implemented here: neither REQ-INT-02's
  Fit Criterion nor spec-004 §3 mentions an undefined-role refusal, so building it would be
  pre-building task-058's feature surface on an unratified contract.

`createMcpServer` is therefore left untouched by this task; `registerReadOnlyResources` is untouched too
(it is spec-004 §2's Resources bundle, not a Prompts bundle).

**T1 — acceptance-criterion classification.** The task's single AC is "satisfies the Fit Criterion for
REQ-INT-02", i.e. (1) *"starting a session under role R returns a prompt embedding 100% of R's currently
assigned directives"* and (2) *"a newly assigned directive appears on the next session start"*. Decomposed
against `spec-004` §3, and classified:

| # | Criterion | Source | Class |
|---|---|---|---|
| AC-1 | `prompts/list` advertises exactly one prompt per `dna.yaml` `team.roles` entry, named `{role}-session` | spec-004 §3.1 | **red-first** |
| AC-2 | `prompts/get("{role}-session")` embeds 100% of that role's resolved directives (own `assignments` ∪ `global`), each as a `## Directive: {id}` block carrying the directive's full body | spec-004 §3.2, REQ-INT-02 FC part 1 | **red-first** |
| AC-3 | A directive assigned after server construction appears in the **next** `prompts/get` — resolution is per-request, not baked in at boot | spec-004 §3.2, REQ-INT-02 FC part 2 | **red-first** |
| AC-4 | The Prompts channel is read-only: a `prompts/list` + `prompts/get` round trip mutates nothing on disk and registers no Tool | spec-004 §3.3, CLAUDE.md §8 | **red-first** |

No criterion is characterization: nothing under `src/mcp` registers an MCP Prompt today (`grep -rn
"registerPrompt\|prompts/" src/` returns no hit outside `node_modules`), so every one of the four fails
before the implementation exists.

**`agent.read_related` (dl-015).** `depends_on: []` — no-op, nothing to acknowledge.

**`agent.verify_specs`.** No spec scaffolded; this task's surface is already covered by two `approved`
tech-specs — `spec-004-mcp-surface-contract` §3 (Prompt naming §3.1, embedding §3.2, read-only §3.3) and
`spec-014-mcp-server-entry-point` §3 (which task owns the `createMcpServer` wiring). The design gate
therefore passes through without an approver gate. Three contract points needed a judgement call, all
resolved *inside* the approved specs rather than by inventing contract:

1. **`role: "system"` in spec-004 §3.2's example is not representable on the MCP wire.** The protocol's
   `PromptMessageSchema.role` is the two-value enum `"user" | "assistant"` (verified directly:
   `node -e` on `@modelcontextprotocol/sdk@1.29.0`'s `PromptMessageSchema.shape.role.options` prints
   `["user","assistant"]`), so *no* conformant server can emit `role: "system"`. The normative sentence of
   §3.2 — "returns a prompt whose message content **embeds 100% of that role's currently assigned
   directives**, each as a distinct, clearly delimited block" — is what this task implements, verbatim;
   the illustrative JSON's `role` field is emitted as `"user"`, the only value that can carry
   instructional content on this protocol. Flagged for the reviewer as a candidate **editorial**
   correction to spec-004 §3.2 (the example, not the contract).
2. **Directive ordering.** spec-004 §3.2 states resolution as a *set* union
   (`roles.yaml[R].directives` ∪ `global`) and its example happens to print role-directives before
   globals. The emitted order here is whatever `resolveRoleDirectives` (`src/core/context.ts`,
   task-037) produces — deduplicated by directive id and sorted id-ascending per
   `spec-012-context-loader-relevance-filtering` §5 / REQ-SYS-07 ("never rely on `roles.yaml` listing
   order or file-system enumeration order"). Reusing the canonical resolver rather than re-deriving a
   second, differently-ordered union is what keeps REQ-INT-02's "100%" and REQ-STATE-05's "100% of the
   role's directives and 0 of another role's" the *same* guarantee instead of two drifting ones.
3. **`## Directive: {x}` — which field is `{x}`?** spec-004 §3.2's example headings read
   `## Directive: code-quality` / `testing` / `security-secrets`. Those strings are the `id` frontmatter
   values of the real directive files (`docs/self/.wingfoil/directives/custom/code-quality.md` carries
   `id: code-quality`, `name: "Code Quality"`), and `roles.yaml` binds by id — so the heading uses
   `frontmatter.id`.

**Reuse decision (code-quality directive).** No scanning, parsing or binding logic is re-implemented:
`registerRolePrompts` composes `loadDnaYaml` (role catalogue), `loadRolesYaml` + `loadDirectives`
(`src/core/loaders.ts`) and `resolveRoleDirectives` (`src/core/context.ts`). The one thing none of those
provide is the directive **body** — `loadDirectives` returns `{path, frontmatter}` only — so the prompt
module reads the resolved file with `storage.readDocument` + `storage.splitFrontmatter`, the same
already-shipped primitives `src/mcp/memory-resource.ts` uses for the same "the frontmatter scan already
happened, now I need the raw text" reason.

### `red` — developer

`test/mcp/role-prompts.test.ts` — 9 cases across four `describe` blocks, one per AC above, all driven
over the SDK's in-memory transport + a real `Client` against a temp-git-repo fixture
(`test/storage/helpers/git-fixture.ts`) carrying `dna.yaml` (roles `developer`/`reviewer`/`qa`),
`roles.yaml` (`developer → code-quality, testing`; `reviewer → code-review`; `global →
security-secrets`) and five directive files with unique `BODY-*` marker bodies.

Observed first failure (`npx jest test/mcp/role-prompts.test.ts`), verbatim:

```
Tests:       9 failed, 9 total
● prompts/list — one {role}-session prompt per dna.yaml team.roles entry (spec-004 §3.1) › derives the prompt set from DNA — exactly one per role, named {role}-session

    TypeError: (0 , mcp_1.registerRolePrompts) is not a function
```

All four AC classes are red for the same structural reason — `src/mcp` exports no Prompts registrar
yet. No fabricated red and no dead code was added to force one.

---
id: "dl-039-spec-004-prompt-example-corrections"
type: decision-log
title: "spec-004 §3.2's Prompts example is unimplementable on MCP and its ordering language overreaches"
status: in-discussion
context: "dev-loop-review"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`task-039-mcp-prompts-role-based-infra` implemented the role-scoped Prompts channel against
`spec-004-mcp-surface-contract` §3 and hit two places where the spec's **illustration** cannot be
followed literally, while its **contract** can. Both were implemented against the contract and raised
rather than resolved in code, which is why they land here.

**1. `role: "system"` is not representable.** §3.2's example message carries `role: "system"`. The MCP
SDK's `PromptMessageSchema.role` is the two-value enum `["user", "assistant"]` — verified directly
against the installed `@modelcontextprotocol/sdk@1.29.0`, and independently by the review. No
conformant server can emit `"system"`. The implementation emits `"user"`, the only wire role that can
carry instructional content, and pins the constraint with a test.

**2. "Resolution order" promises more than the spec defines.** §3.2's line opens *"Directive
resolution **order** for a role R:"* and its example groups own-directives-then-globals. But the
operative sentence states resolution as a **set union** (`roles.yaml[R].directives` ∪ `global`), which
fixes membership, not sequence; the grouping in the example is annotated with explanatory comments,
i.e. illustrative. The implementation emits `resolveRoleDirectives`' id-ascending, deduplicated order
per `spec-012` §5 — deterministic, and reusing the one resolver rather than maintaining a second
union that could drift from it.

Nothing downstream depends on sequence: REQ-INT-02's Fit Criterion says "embedding 100% of", and all
three `P5.2.2-mcp-prompts.feature` scenarios assert inclusion, never order. So `task-058` is not boxed
in either way.

The review's assessment, worth carrying: the determinism argument alone does **not** force the chosen
order — "own-then-global, id-ascending within each group" is equally deterministic and equally
REQ-SYS-07-compliant. The choice rests on resolver reuse, and should be stated that way rather than
dressed as a determinism requirement.

## Decision

*Approver to choose; the two are separable but should be settled together, since both are edits to the
same paragraph of an `approved` spec.*

**On `role`:**
1. **Amend §3.2's example to `role: "user"`** (recommended). The spec illustrates something the
   protocol forbids; correcting the illustration costs nothing and removes a trap for the next
   implementer, who would otherwise write it, watch it fail schema validation, and re-derive this.
2. Leave it, and annotate the example as non-normative. Cheaper still, but leaves a literally wrong
   line in an approved spec.

**On ordering:**
1. **Replace "resolution order" with "resolution set", and state id-ascending per `spec-012` §5**
   (recommended). Makes the spec say what it means and what the code does.
2. **Mandate own-then-global grouping** and change the implementation to match. Coherent — the example
   does show grouping, and a reader might reasonably expect a role's own rules first — but it means
   `src/mcp/prompt.ts` stops reusing `resolveRoleDirectives`' output shape directly, which is the
   coupling that keeps REQ-INT-02's "100%" and REQ-STATE-05's disjointness as one guarantee.

## Rationale

- **Both are editorial in the strict sense**: no behaviour changes under the recommended pair, because
  the implementation already follows the contract. What changes is that a reader of `spec-004` alone
  stops being misled.
- **The `role` item is not a matter of taste.** An example that cannot be implemented is a defect in a
  specification, not a stylistic preference — and this one is cheap to verify, since the SDK's enum is
  two values.
- **The ordering item is the one with a real alternative.** If grouping is genuinely wanted, option 2
  is available and the cost is named above. What should not happen is the current state: a spec saying
  "order", an implementation choosing a different one, and the reason living only in a code comment.
- **Not urgent.** Nothing is broken, `task-058` passes either way, and no v0.2 task depends on the
  outcome. Stamped `v0.3` so `release-planning` derives the amendment rather than it being lost —
  which is the entire reason this DL exists rather than a note in `task-039`'s Execution Notes.

## Actions

- Owner **approver**: choose on each of the two questions.
- If the recommended pair: amend `spec-004` §3.2 (new spec version per the doc-versioning directive) —
  example `role` to `"user"`, "resolution order" to "resolution set" with the id-ascending rule stated.
- If ordering option 2: raise a task to change `src/mcp/prompt.ts`'s composition, and note the
  resolver-reuse cost in its Implementation Notes.
- Either way, record that the ordering choice rests on resolver reuse rather than on determinism.
- Related: `task-039` (which raised both), `task-058-mcp-prompts-role-based` (the feature task that
  inherits whatever is decided), `spec-012` §5 (the id-ascending rule).

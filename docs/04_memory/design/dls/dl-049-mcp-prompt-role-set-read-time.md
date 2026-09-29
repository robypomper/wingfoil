---
id: "dl-049-mcp-prompt-role-set-read-time"
type: decision-log
title: "When the MCP Prompt role set is read — spec-014 §2's no-construction-I/O vs spec-004 §3.1's \"derived from DNA at server start\" — and whether Prompts advertise `listChanged`"
status: in-discussion
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Two `approved` specs constrain when `wingfoil mcp` may read `dna.yaml` to build its Prompt list, and
they cannot both be met by the simplest implementation of either (both read on `main`, `8a6a091`):

- **`spec-014-mcp-server-entry-point` §2** (lines 63-65, 76-77): `createMcpServer` is "Pure and
  synchronous — no transport, no stdio, no process side effects", and "the server module itself
  performs no I/O at construction time beyond wiring handlers".
- **`spec-004-mcp-surface-contract` §3.1**: "`prompts/list` returns this fixed set derived from DNA at
  server start — it is not hand-maintained." (§3.2 separately requires directive **content** to be
  resolved per request, "not baked in at server boot", which REQ-INT-02's Fit Criterion backs: "a newly
  assigned directive appears on the next session start".)

`spec-014` is also stale in wording: §3's heading is "v0.1 channel scope — read-only Resources only",
and §2's code comment says `createMcpServer` "registers the v0.1 channel set" — while its own §3 closing
paragraph anticipates that Prompts (P5.2.2, v0.2) add their registrar.

**What `task-058` did.** Its first pass read the role catalogue at construction; the independent review
rejected it (`ff13321`) on `spec-014` §2. The second pass (`task/task-058-mcp-prompts-role-based`,
`3f27d98`, read with `git show`) moved the read into the handlers:

- `src/mcp/prompt.ts` `registerRolePrompts`: "**Nothing is read here — every read happens per
  request**"; `prompts/list` and `prompts/get` each call `loadRoleNames(options.resolveRoot())` →
  `loadDnaYaml(root)`.
- The module doc names the tension openly: `spec-004` §3.1's set "is served as the DNA role set **at
  request time**: a role added to `dna.yaml` while the server runs is listed on the next
  `prompts/list`. That tension between spec-014 §2 and spec-004 §3.1 is open for the approver."
- A test pins that behaviour: `test/mcp/mcp-prompts.feature.test.ts:227`, "a role added to dna.yaml
  after the server started is listed and served on the next request".
- `src/mcp/prompt.ts:187`: `server.server.registerCapabilities({ prompts: {} })` — **no `listChanged`**.
  The task's Execution Notes (line 162) justify this as "the list is fixed at start, so no change
  notification is" needed — a justification written for the first pass that the second pass no longer
  satisfies. For comparison, the SDK advertises `listChanged: true` for its own registrations
  (`node_modules/@modelcontextprotocol/sdk/dist/cjs/server/mcp.js:67` Tools, `:343` Resources), and `main`'s server reports
  `{"resources":{"listChanged":true}}` (the task's own AC-1 probe, line 63).

So the branch currently meets `spec-014` §2 literally and contradicts `spec-004` §3.1 literally — it
implements the behaviour of **option (a)** below, without the spec amendment (a) requires.

A consequence that interacts with `bug-035`: with no start-time read, `wingfoil mcp` in an uninitialised
git root starts and fails every Prompts request with a raw `ENOENT`.

## Decision

*Approver to choose.*

**Main question — when is the role set read?**

- **(a) At request time; amend `spec-004` §3.1** to "the DNA role set at request time". What
  `3f27d98` implements; consistent with §3.2's per-request directive resolution and REQ-INT-02's
  "next session start". Cost: `prompts/list` is no longer fixed for the life of the server, which
  raises the `listChanged` sub-question below.
- **(b) At server start; amend `spec-014` §2** to allow one start-time DNA read of the role set —
  either inside construction, or just before it in `runMcp`'s pre-flight
  (`src/cli/mcp-command.ts:39-53`) with the set passed into `createMcpServer` — and route its failure
  through that pre-flight's existing format-aware `error: <reason>` + exit 1 path. (The second variant
  keeps `createMcpServer` I/O-free for in-memory tests.) A missing or invalid `dna.yaml` then refuses
  the start, which also covers the Prompts half of `bug-035`. Cost: a role added while the server runs needs a restart; the `:227` test flips.
- **(c) Read once on the first request and cache.** Satisfies **both** specs literally: nothing is read
  at construction (`spec-014` §2), and the set is fixed for the server's life once observed
  (`spec-004` §3.1's "fixed set"). Cost: "fixed at first request" is not what either spec's author
  pictured; a DNA read failure on the first request is cached or retried (must be specified); and the
  `:227` test flips.

Recommendation: **(b)**, because it is the only option that also gives the missing-DNA case a clean,
spec-conformant refusal (`spec-014` §1 already requires the pre-flight to refuse a non-initialised
project — `bug-035`) and keeps §3.1's "fixed at server start" meaning what it says. **(a)** is the
cheaper path if hot-reloading roles is judged valuable; if (a), settle the sub-question as below.

**Sub-question — should Prompts advertise `listChanged`?**

- Under **(b)** or **(c)**: no — the list cannot change during a session; `prompts: {}` is correct.
- Under **(a)**: the list can change, so either advertise `listChanged: true` **and** emit
  `notifications/prompts/list_changed` when `dna.yaml`'s role set changes (needs a file watch or a
  per-request diff), or keep `prompts: {}` and state in `spec-004` §3.1 that clients must re-list to
  observe changes. Advertising `listChanged: true` without ever sending the notification would be a
  false capability claim.

**Editorial, any option:** retitle `spec-014` §3 and reword §2's "registers the v0.1 channel set" to
cover the Prompts channel.

## Rationale

- The two specs were written for different milestones (`spec-014` for the v0.1 Resources-only
  skeleton) and neither anticipated a DNA-derived Prompt list; the conflict is real, not an
  implementation slip, so it needs a ratified answer rather than a third pass of `task-058`.
- (b) moves the only start-time read to the one place already designed to fail cleanly, and keeps
  `createMcpServer` pure for in-memory tests.
- (c) is the literal reconciliation but introduces a timing semantics nobody asked for; it is listed
  because it is the minimal change that satisfies both texts.

## Actions

- Owner **approver**: choose (a), (b) or (c), and the `listChanged` answer that follows.
- Amend the losing spec with a dated Revision note (`dl-047`); apply the editorial `spec-014` §2/§3 fix
  regardless.
- Hand the outcome to `task-058` before its next review: under (b) or (c), the `:227` test and the
  per-request `loadRoleNames` calls change; under (a), the capability line at `prompt.ts:187` and its
  Execution Notes justification change.

Related: `bug-035` (missing `.wingfoil/`), `dl-048` (undefined-role refusal, same section),
`dl-039` (same section), `dl-026` (registering the server at this repo's root),
`task-058-mcp-prompts-role-based`, `spec-004` §3, `spec-014` §§1-3, REQ-INT-02.

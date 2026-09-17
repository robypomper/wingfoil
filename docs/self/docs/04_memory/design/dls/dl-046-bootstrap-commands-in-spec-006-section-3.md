---
id: "dl-046-bootstrap-commands-in-spec-006-section-3"
type: decision-log
title: "spec-006 §3's bootstrap rows name a `project` module no code has — decide how `init`, `audit` (and `mcp`) appear on the MCP surface"
status: in-discussion
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Implementing `dl-041` (`ebfb1e3`) added an explicit `module` column to `spec-006-core-domain-api` §3.
Filling it for the "Project bootstrap & audit" table exposed that its other columns cannot all be
true at once (`sed -n 176,181p docs/self/docs/04_memory/design/specs/spec-006-core-domain-api.md`):

| function | module | mutates | CLI | MCP |
|---|---|---|---|---|
| `projectInit` | — *(not a `CoreModule`: bootstrap command wired directly in `src/cli/program.ts`)* | true | `wingfoil init` | Tool `project.init` |
| `projectAudit` | `audit` *(planned — flat `wingfoil audit`, BDD P5.1.3)* | false | `wingfoil audit` | Resource `wingfoil://project/audit` |

Three inconsistencies, each checked on `main` (`8a6a091`):

1. **`project.init` is underivable.** §2 makes the MCP surface a mechanical function of
   `CORE_MODULES` (Tool name = `{module}.{verb}`, `src/mcp/registrar.ts:42-53`). `init` is not in
   `CORE_MODULES` — it is wired directly (`src/cli/program.ts:85`) — so no registrar can produce
   `project.init`, and no module named `project` exists or is planned.
2. **The two rows disagree on the module.** `projectAudit` is planned on module `audit`, which would
   derive Resource `wingfoil://audit` (flat, like `paths` → `wingfoil://paths`), not the
   `wingfoil://project/audit` the same row pins.
3. **`projectInit`/`projectAudit` break §3's own naming rule** — "function name (camelCase, matches
   `{module}{Verb}`)" — since neither has a `project` module; `pathsQuery` already breaks it the same
   way (registered as op `paths` on module `paths`, see the `dl-040` addendum).

And one requirement makes the first point more than editorial. **REQ-SYS-05**'s Fit Criterion
(`docs/02_requirements/03_sard/01_architecture.md:57-58`): "Every state-mutating operation available
in the CLI is reachable via an MCP tool and vice versa", traced to **P5.1.1 (`init`)**. `init` is
state-mutating and has no MCP Tool. No BDD scenario names `project.init` or `wingfoil://project/audit`
(`grep -rn 'project\.\|project/' docs/02_requirements/02_bdd/features` → no MCP hit), so the MCP names
exist only in the spec.

Also absent from the table: `wingfoil mcp`, the other bootstrap command (`bug-028`).

## Decision

*Approver to choose.*

**A — Is `init` on the MCP surface at all?**

- **(a) No — bootstrap commands are exempt.** Amend REQ-SYS-05's Fit Criterion to exclude commands
  that must run before a WingFoil project exists (`init`) or that host the MCP surface itself (`mcp`),
  and set §3's MCP cell for both to "— (bootstrap; not MCP-exposed)". Recommended: an agent connected
  through `wingfoil mcp` is by construction already inside an initialised project (see `bug-035` for
  the pre-flight that should guarantee it), so an MCP `init` Tool has no caller.
- **(b) Yes — make `init` a `CoreModule` operation** so the registrar derives the Tool. Satisfies
  REQ-SYS-05 literally, but the operation's interactive wizard (`P5.1.1` without `--template`) has no
  MCP analogue, and the derived name would be `init` (flat, self-named like `paths`), not
  `project.init`.

**B — What name does `audit` get when it ships?**

- **(a) Flat, self-named module `audit`** → CLI `wingfoil audit`, Resource `wingfoil://audit`; amend the
  row's MCP cell. Recommended: matches the `paths` precedent and the mechanical derivation, and needs no
  registrar change.
- **(b) Module `project`, op `audit`** → `wingfoil project audit` on the CLI, which contradicts BDD
  `P5.1.3`'s flat `wingfoil audit`. Not viable without a registrar special case.

**C — The `{module}{Verb}` naming rule.** Either relax §3's preamble to allow self-named flat
operations (`paths`, `audit`, and `init` under A(b)) — recommended, since `deriveVerb` already supports
it — or rename the `function` column entries to the registered op names.

## Rationale

- §3 now claims to pin the wire contract per row (`dl-041`); a row whose MCP cell no derivation can
  produce is a trap for the implementer of `P5.1.3` and of any parity check.
- A(a) keeps REQ-SYS-05 honest rather than silently unmet: today the parity test passes only because it
  enumerates `CORE_MODULES`, from which `init` is absent.
- The recommended set changes no shipped behaviour; it is a spec and requirement amendment.

## Actions

- Owner **approver**: choose A, B, C.
- Amend `spec-006` §3's bootstrap table (and add an `mcp` row, closing `bug-028`'s §3 half) with a
  dated Revision note (`dl-047`: tech-specs carry no `version:`).
- If A(a): amend REQ-SYS-05's Fit Criterion. If A(b): raise a task to move `init` into `CORE_MODULES`.
- Hand B's answer to whichever task implements `P5.1.3` (`minor-v0.4` scope).

Related: `dl-040` (Resource-URI column — different column, same table family), `dl-041` (the `module`
column), `bug-028`, `bug-035`, REQ-SYS-05, `spec-014` §1.

---
id: "dl-108-amending-an-approved-element"
type: decision-log
title: "No verb amends an approved or terminal Memory element, so every correction is a hand-written commit that `memory history` reports as `operation: null`"
status: in-discussion
context: "retrospective"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

The v0.2 retrospective (`retro-v0.2`) files this decision-log, target v0.3. Its disposition reads
"no verb amends an approved or terminal element". The finding came from using WingFoil outside this
repository. It was reproduced on `wingfoil@0.2.1`, and this repository's own history shows the same
gap at scale.

**The verbs only move state.**
- `memory submit` and `memory approve` walk the machine forward, and `memory reject` walks it back
  from a gate.
- `memory deprecate` retires an element.
- Once an element sits in a state with no outgoing verb edge, such as `approved` for a tech-spec or
  `accepted` for an ADR, none of them can record a change to its content.
- The one exit declared for those types, `superseded`, is a `waiting` state reached through a later
  element's `supersedes:` field. `grep -rn supersedes src` finds two comments and no code that
  reads the field.

**Reproduction on `wingfoil@0.2.1`.** This uses a throw-away project. The identity comes from the
environment only. The `GIT_CONFIG_*` variables are there because the authority check reads
`git config` (`bug-149`).

```sh
T=$(mktemp -d) && npm install --silent --prefix "$T" wingfoil@0.2.1 && W="$T/node_modules/.bin/wingfoil"
export GIT_AUTHOR_NAME=Scratch GIT_AUTHOR_EMAIL=scratch@example.invalid \
  GIT_COMMITTER_NAME=Scratch GIT_COMMITTER_EMAIL=scratch@example.invalid \
  GIT_CONFIG_COUNT=2 GIT_CONFIG_KEY_0=user.name GIT_CONFIG_VALUE_0=Scratch \
  GIT_CONFIG_KEY_1=user.email GIT_CONFIG_VALUE_1=scratch@example.invalid
cd "$(mktemp -d)" && git init -q -b main && git commit -q --allow-empty -m init
"$W" init --template Kanban
"$W" dna add team.members --value Scratch --entry-email scratch@example.invalid --entry-roles approver
"$W" memory add --type adr --title "Use SQLite"
"$W" memory submit adr-001-use-sqlite
"$W" memory approve adr-001-use-sqlite --reason "fits the footprint"
"$W" memory submit adr-001-use-sqlite; echo "exit $?"
"$W" memory approve adr-001-use-sqlite --reason "amend"; echo "exit $?"
"$W" memory reject adr-001-use-sqlite --reason "amend"; echo "exit $?"
printf 'Amendment: WAL journal mode.\n' >> docs/memory/adr/adr-001-use-sqlite.md
git commit -qam "wf(adr): amend adr-001-use-sqlite [approved → approved]" \
  -m "Approver: Scratch <scratch@example.invalid> (approver)
Reason: concurrent readers need WAL."
"$W" memory history adr-001-use-sqlite --format json
```

Observed results:
- The three verbs refuse with exit 1: `illegal transition approved -> pending`, `approved ->
  (none)` and `approved -> draft` respectively. The wording of these messages is the `bug-127`
  class.
- `memory history` returns four entries. The hand-written amendment is `"operation": null, "from":
  "approved", "to": "approved"`, even though its `Approver:` and `Reason:` are parsed.

**The same gap in this repository.** `spec-015-packaging-publishing` was approved at `1113b676`
(`wf(tech-spec): approve spec-015 [pending → approved]`). Nine commits have touched it since:
`git log --format=%s 1113b676..a20b346c --
docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md`.
- Seven are `docs(self):` amendments, such as `bca3f683` ("amend spec-015 §1 — bin.wingfoil drops the
  leading ./") and `8d8207c3`.
- One is a `refactor(cli):` commit that moved §1 with the Node floor.
- One is `wf(tech-spec): assign release v0.2 to spec-015`, a verb the grammar does not declare
  (`dl-079`).

None of the content changes is an operation that `memory history` could report. Each carries its
justification in free prose or a dated "Revision note", and none records an approver. The same
convention is already planned for `service` elements: "body edits with a version bump under
`docs(self)`, pending `dl-079`" (`retrospective-rel-v0.2-plan` §6.7).

## Decision

An amendment to an element that no verb can move is a recorded operation, with its own verb and its
own history entry. The open points follow, each with a recommendation.

**A1 — The mechanism.**
- **(a) A `memory amend <id> --reason` verb.** It commits a content change on an element in any
  state, leaves `status` untouched, and writes `wf(<type>): amend <id> [<state> → <state>]` with a
  `Reason:` block (`dl-067`). `memory history` reports `operation: "amend"`.
- **(b) A reopen edge.** A new transition takes an approved element back to `draft` or `pending`,
  and the ordinary submit/approve cycle runs again. The element loses its approved status while it
  is revised.
- **(c) Supersede only.** Any change to approved content requires a new element whose `supersedes:`
  retires the old one, which needs the engine trigger that does not exist yet.

**A2 — Who may amend, if A1 (a).**
- **(i)** Only a role with approval authority on that type, and the commit carries `Approver:`.
- **(ii)** Anyone, recorded, with the element flagged for re-approval (e.g. a `needs_review: true`
  field) until an approver confirms it.

**A3 — What an amendment may change.** Editorial and corrective changes are amendments: wording,
citations, facts that later evidence corrected, and dated revision notes. A change to the decision
itself is not. For an `adr` it is a new element under (c). For a `tech-spec`, whose revisions are
routine (as spec-015's history shows), the approver rules per type in `memory.yaml`.

*Recommendation: A1 (a), with A2 (i) and A3 as stated.* Together these make the practice this
repository already follows into an operation the tool records, with the same evidence an approval
carries.

## Rationale

- **The practice exists, only unrecorded.** spec-015 alone was amended seven times by hand after
  approval. A verb would record what is already being done. It does not introduce a new habit.
- **(b) punishes a small correction.** Reopening an approved spec to fix a citation would take it out
  of `approved` while every task that depends on it is in flight.
- **(c) is right for decisions and wrong for corrections.** It also depends on an engine trigger that
  no v0.2 code implements.
- **The verb belongs in the grammar decision.** `dl-079` weighs the undeclared verbs already in use.
  `amend` is one more, and it should be ratified together with them rather than practised first.

## Actions

On ratification, with A1–A3 chosen in the approve commit's `Reason:`:
1. Amend `spec-008-cli-grammar` (the verb and its subject grammar) and `spec-010-memory-frontmatter-schema`
   § "Field-write ownership" (what `amend` owns: the body and non-status fields).
2. Amend `spec-001-memory-yaml-schema` if A3 needs a per-type amendability declaration.
3. Record the verb in `dl-079`'s grammar decision.

v0.3 `release-planning` (`build-backlog`) derives the tasks. None are created here.

## Relations

- **Filed by:** `retro-v0.2` (external-use finding "no verb amends an approved or terminal element",
  reproduced on `wingfoil@0.2.1`).
- **Related:** `dl-079` (verbs outside the grammar), `dl-067` (the `Reason:` block), `dl-047` (no
  `version:` field on tech-specs, relevant to doc-versioning of amendments), `dl-088` (edits to an
  `active` service), `bug-127` (illegal-transition wording), `bug-149` (authority identity),
  `dl-125` (approving documents that are not Memory elements).
- **Traceability:** P1.7, P1.10, P1.13; REQ-SEC-02, REQ-STATE-01.

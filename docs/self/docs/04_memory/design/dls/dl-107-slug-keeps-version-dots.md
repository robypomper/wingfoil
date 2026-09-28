---
id: "dl-107-slug-keeps-version-dots"
type: decision-log
title: "`memory add` cannot produce a version-shaped id: the slug drops dots, and an `id_pattern` token other than `{n}` and `{slug}` has no source, so this repository's own `release`, `release-line` and `plan` patterns cannot be filled"
status: in-discussion
context: "retrospective"
release: "v0.2.2"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

The v0.2 retrospective (`retro-v0.2`) files this decision-log, target v0.3. Its disposition reads
"the slug drops dots; no `{version}` token". The finding came from using WingFoil outside this
repository. It was reproduced on `wingfoil@0.2.1` on a fresh project, and the reproduction shows it
also reaches this repository's own configuration.

**The slug is stricter than the id it feeds.** `slugifyTitle` (`src/memory/add.ts`) lowercases the
title and replaces "every run of characters outside `[a-z0-9]`" with `-`. Its own doc comment names
the id character class as `[a-z0-9-.]` (`spec-009-validation-strategy` §1), and says that
`generateId`'s slug check `[a-z0-9.]+(?:-[a-z0-9.]+)*` accepts dots. So the validator would accept
`v0.2`, and the slugifier never produces it.

**No token other than `{n}` and `{slug}` has a value.** `memory add` takes `--type`, `--title` and
`--tags` only (`wingfoil memory add --help`). Any other `{token}` in an `id_pattern` therefore
fails.

**Reproduction on `wingfoil@0.2.1`.** This uses a throw-away project. The identity comes from the
environment only.

```sh
T=$(mktemp -d) && npm install --silent --prefix "$T" wingfoil@0.2.1 && W="$T/node_modules/.bin/wingfoil"
export GIT_AUTHOR_NAME=Scratch GIT_AUTHOR_EMAIL=scratch@example.invalid \
  GIT_COMMITTER_NAME=Scratch GIT_COMMITTER_EMAIL=scratch@example.invalid
cd "$(mktemp -d)" && git init -q -b main && git commit -q --allow-empty -m init
"$W" init --template Kanban
sed -i 's/id_pattern: "release-{n}"/id_pattern: "rel-{slug}"/' .wingfoil/memory.yaml && git commit -qam slug
"$W" memory add --type release --title "v0.2"
"$W" memory add --type decision-log --title "Retrospective v0.2"
sed -i 's/id_pattern: "rel-{slug}"/id_pattern: "minor-{version}"/' .wingfoil/memory.yaml && git commit -qam version
"$W" memory add --type release --title "v0.3"; echo "exit $?"
sed -i 's/id_pattern: "minor-{version}"/id_pattern: "{workflow}-{phase}-plan"/' .wingfoil/memory.yaml && git commit -qam plan
"$W" memory add --type release --title "dev loop"; echo "exit $?"
```

Observed results:
- The first add gives `"id": "rel-v0-2"`, committed as `wf(release): add rel-v0-2`.
- The decision-log gives `dl-001-retrospective-v0-2`.
- `minor-{version}` fails with `error: missing value for token {version}`, exit 1.
- The plan-shaped pattern fails with `error: missing value for token {workflow}; missing value for
  token {phase}`, exit 1.

**This repository is affected, not only other projects.** `docs/self/.wingfoil/memory.yaml`
declares these patterns:
- `release-line`: `id_pattern: "rl-{version}"`;
- `release`: `"minor-{version}"`;
- `plan`: `"{workflow}-{phase}-plan"`.

21 ids in this repository contain a dot: `grep -rhE "^id:" docs/self/docs/04_memory docs/05_plans |
grep -c '\.'`. They include `minor-v0.1` to `minor-v1.0`, `retro-v0.1` and every
`*-rel-v0.2-*-plan`. None could have been created by `wingfoil memory add` at 0.2.1. Nothing has
failed yet, because this repository's Memory is written by hand (`bug-075`). The root move scheduled
as step 2 of v0.2.2 is what makes the verbs reach this configuration. From then on, the next
`release`, `release-line` or `plan` element cannot be added with the tool.

The retrospective's own `capture` action has the same problem. `retrospective.yaml` declares
`memory.add(type: decision-log, title: "Retrospective {release.version}")`, which produces
`dl-NNN-retrospective-v0-2` under `dl-{n}-{slug}`. The element that actually exists is `retro-v0.1`.

## Decision

`memory add` can produce every id its configuration declares, including version-shaped ones. Three
points are open, each with a recommendation.

**S1 — Dots in the slug.**
- **(a)** `slugifyTitle` keeps a `.` that sits between two alphanumerics (`v0.2` → `v0.2`) and
  still collapses every other run to `-`. This matches the validator.
- **(b)** The slug stays lossy, and version-shaped ids use a dedicated token (S2).
- **(c)** A per-type choice in `memory.yaml`.

*Recommendation: (a),* together with S2. The slugifier and the validator should agree on one
character class. Existing ids never change, because an id is immutable once added.

**S2 — Where a token other than `{n}` and `{slug}` gets its value.**
- **(a)** From a frontmatter field of the same name, given on the command line, e.g. `memory add
  --type release --field version=v0.3`. The same value is also written to the frontmatter, so the
  id and the `version:` field cannot disagree.
- **(b)** A fixed extra token, `{version}` alone.
- **(c)** Context tokens (`{workflow}`, `{phase}`, `{scope}`) are filled only by the workflow engine,
  which knows them. From the CLI they must be given explicitly, as in (a).

*Recommendation: (a) plus (c).* `{version}` is a frontmatter field (`release-line` and `release`
require `version`). `{workflow}` and `{phase}` are execution context that only the engine holds.

**S3 — An id that its type's pattern cannot express.** An example is `retro-{release.version}` for a
decision-log whose pattern is `dl-{n}-{slug}`.
- **(a)** A workflow action may override the pattern for that one add, e.g.
  `memory.add(type: decision-log, id_pattern: "retro-{release.version}")`. This is declared in the
  workflow and validated like any other pattern.
- **(b)** A `retrospective` Memory type with its own pattern.
- **(c)** `--id` on the CLI, free-form, validated only against spec-009's character class.

*Recommendation: (a).* It keeps the exception visible where it is used. (c) would let any caller
name any element, which is what `id_pattern` exists to prevent.

## Rationale

- **The failure is scheduled.** The root move (v0.2.2 step 2) is when WingFoil starts running its own
  verbs on its own Memory, and three of its eight types then become un-addable. Deciding in v0.3
  planning means the first version-shaped add after the move is a known gap, not a surprise.
- **A version in an id is data.** `minor-v0-3` and `minor-v0.3` are different ids. A lossy slug makes
  the id disagree with the `version:` field it was derived from, and every `where` filter or
  `{release.version}` interpolation that joins the two breaks on that difference.

## Actions

On ratification, with S1–S3 chosen in the approve commit's `Reason:`:
1. Amend `spec-009-validation-strategy` §1 (slug rule) and `spec-001-memory-yaml-schema`
   (`id_pattern` tokens and their sources).
2. Amend `spec-008-cli-grammar` for the `memory add` option chosen in S2.
3. Amend `retrospective.yaml`'s `capture` action under S3 (a).

v0.3 `release-planning` (`build-backlog`) derives the tasks. None are created here.

## Relations

- **Filed by:** `retro-v0.2` (external-use finding "the slug drops dots; no `{version}` token",
  reproduced on `wingfoil@0.2.1`).
- **Related:** `bug-075` (this repository's Memory unreachable by the verbs, which the v0.2.2
  root move is to close), `dl-019` (the `plan` type), `dl-090` (arguments of workflow tokens, which
  S3 (a) needs).
- **Traceability:** P1.3, P1.13; REQ-SYS-07.

---
id: "bug-090-dna-set-grammar-differs-across-three-artefacts"
type: bug
title: "`dna set`'s grammar is specified three different ways — positional in the code and its specs, `--field`/`--value` in the approved vision reference, and the vision layer is the one that wins"
status: in-review
severity: "medium"
release-origin: "v0.2"
release: "v0.2"
feature: "P2.1"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`docs/01_vision/X_cli-cmds.md` (**Version 1.2, Status: Approved**) specifies:

> `wingfoil dna set [--field FIELD] [--value VALUE]` — Define/update project DNA field (interactive or
> flag-based) … Supports nested fields (e.g., `--field tech-stack.backend --value nodejs`)

The shipped command is **positional** — `wingfoil dna set <key> <value>` — as `task-025` built it and
as `P2.1`, `spec-002` and `spec-008` codify it. So the same command has two grammars in two
artefacts, and `dl-081` has just ratified the **option** form for three *new* verbs without anyone
noticing the vision layer already used it for `set` itself.

## Steps to Reproduce

```
$ grep -n 'dna set' docs/01_vision/X_cli-cmds.md
→ wingfoil dna set [--field FIELD] [--value VALUE]

$ node dist/cli.js dna set --help
→ positional: dna set <key> <value>
```

`X_cli-cmds.md`'s status line reads `**Status:** Approved`, version 1.2.

## Expected Behavior

One grammar per command, stated once, and the layers agree — or, where they deliberately differ, the
difference is recorded rather than latent.

## Actual Behavior

Three artefacts describe `dna set` and two of them disagree about how it is invoked. The disagreement
has survived the command being built, specified twice, and used throughout this release.

## Notes

**The layer that disagrees is the authoritative one.** CLAUDE.md §10.1 and the project's own golden
rule put `docs/01_vision/` and `docs/02_requirements/` above configuration and code: *specs win*. On
that reading the implementation and its two specs are the ones that diverged, not the vision. That is
uncomfortable and is precisely why this needs a ruling rather than a patch — "fix the vision doc"
is the intuitive move and the one §10.1 forbids doing casually.

**Three questions the ruling has to separate**, because they have different answers:

1. Should `dna set` **also** accept `--field`/`--value`? `dl-081` ratified that form for
   `add|remove|update`, so accepting it for `set` would make the pillar uniform — and the vision doc
   already asks for it. Against: `set` is positional in two approved specs and every existing caller.
2. The reference also carries the **stale shape** `tech-stack.backend`, which the current schema does
   not have (`stacks.technologies` is a list) — the same staleness `bug-089` records in the BDD
   feature. That half is a straightforward correction whichever way (1) goes.
3. It also describes an **interactive mode** (`interactive or flag-based`) that `dna set` does not
   have and that no spec mentions. Is that a dropped requirement or an aspiration that was never
   scheduled? Nobody has established which.

**Read together with `bug-089`, this is one problem seen twice.** That bug has an acceptance contract
describing a shape the schema retired; this one has the vision reference describing a grammar the
implementation never had. The `dna set` contract is stated in at least four places — vision
reference, BDD feature, `spec-002`, `spec-008` — and they have drifted apart without anything
comparing them.

## Triage & Execution Notes

- triage (2026-09-24): **medium**. No user is affected and nothing is broken; the cost is that the
  authoritative description of a shipped command is wrong, and that `dl-081` made a grammar decision
  without the benefit of knowing a higher layer had already made it.
- No fix task filed: question (1) is a ruling, (2) is a correction that follows from it, and (3) is a
  scope question that may belong to v0.3 planning.

## Note (2026-09-24) — `--format` is global, and the vision reference says otherwise on every row

Recorded at the approver's instruction while ruling on this bug, because it is the same drift in the
same document and whoever edits `X_cli-cmds.md` will be standing in front of it.

`docs/01_vision/X_cli-cmds.md` declares `[--format json/yaml]` as a **per-command** option on **ten**
command rows across four pillars. Enumerated by
`grep -n 'format json/yaml' docs/01_vision/X_cli-cmds.md` at `66ef6304`, which returns eleven lines —
ten table rows plus one prose bullet (line 235, "All output commands support
`--format json/yaml/console`"):

| line | command | built? |
|---|---|---|
| 26 | `memory search` | yes |
| 32 | `memory history` | yes |
| 61 | `dna show` | yes |
| 63 | `paths` | yes |
| 98 | `directives list` | yes |
| 144 | `workflow status` | **no** |
| 145 | `workflow next` | **no** |
| 148 | `workflow list` | yes |
| 149 | `workflow show` | **no** |
| 178 | `audit` | **no** |

> **Correction (2026-09-24).** This paragraph originally said *nine* rows and named nine commands
> plus a vague "`agent execute`'s neighbours". Both halves are wrong: there are **ten** rows, and the
> tenth is **`audit`** — `agent execute` carries no `--format` at all, and neither do `memory import`
> or `dna infer`. The list was written from reading the pillar tables without grepping, and
> `task-098` then restated a differently-wrong version of it in durable prose, which its reviewer
> caught. Replaced above with the enumeration and the command that produces it. The implementation registers it **once, on the root program**
(`src/cli/program.ts`, the `.option('--format <format>', ...)` call in `buildProgram`, alongside
`--verbose`, `--no-color` and `--no-interactive`), and no subcommand declares a `--format` of its own.

> **Correction (2026-09-24).** This paragraph originally went on to say that
> `wingfoil --format json memory search foo` "is the shape that works", which implies a trailing
> `--format` does not. That implication is false, and it was written without running the command that
> settles it. Measured on `main`'s build in a throwaway `wingfoil init --template Scrum` repository,
> both placements succeed and return identical output:
>
> ```
> $ wingfoil --format json dna show project   -> {"name":"", ...}   exit 0
> $ wingfoil dna show project --format json   -> {"name":"", ...}   exit 0
> $ wingfoil memory search foo --format json  -> {"query":"foo", ...} exit 0
> ```
>
> Commander accepts a program-level option in trailing position. `task-098` caught this while
> deciding AC6, and the correction matters to that decision: because both placements work, the
> reference's nine `[--format json/yaml]` annotations are **not false about what a user may type**,
> which is most of why `task-098` left them. Had the original claim been true they would have been
> wrong and would have had to move. Measured at `c2102c87`:
`wingfoil --help` lists `--format` under the root Options block, and `wingfoil memory search --help`
lists only `--tag`, `--status` and `--type`.

**This is a divergence of form, not of capability, and the implementation is probably the better
shape** — one declaration instead of ten, and it cannot drift row by row. It is recorded rather than
fixed in passing for two reasons: it is *wider* than this bug, spanning four pillars and ten rows
where this bug concerns one command, so absorbing it here would silently widen the ruling; and it
interacts with `task-093`'s finding that a root-level option **swallows** a subcommand option of the
same name, which is why `--format` is one of the names that must never be derivable from the DNA
schema.

Not scheduled. Whoever corrects `X_cli-cmds.md` for this bug should decide whether the same pass
carries the `--format` rows, and say which it did.

## Note (2026-09-24) — the vision reference lists no row for `dna add`, `dna remove` or `dna update`

Raised by the approver while ruling on this bug: where do the three new verbs come from, given the
vision reference does not contain them? Answered here because the answer widens this bug's fix.

**They trace to `P2.1`, not to a new feature.** `docs/01_vision/06_features.md` lists `P2.1` as
`wingfoil dna set` — "Define/update project DNA" — and its prioritisation row calls it "Basic CRUD
operations" at Critical priority. `dl-081`'s Context quotes exactly that and observes that none of
`P2.1`, `spec-002` or `spec-006` "states a restriction", while the shipped command reaches 7 of
roughly 38 schema fields with no create and no delete. So `add`/`remove`/`update` are the rest of
`P2.1`, not an addition to the feature set.

**What is genuinely missing is the record, not the authority.** The chain exists as far as the specs:
`P2.1` → `dl-081` → `spec-002`, `spec-006` §3 (which now carries `dnaAdd`, `dnaRemove` and `dnaUpdate`
rows with their Tool pairings) and `spec-008` §9, each amended by `task-093` under a dated Revision
note. It stops at `docs/01_vision/X_cli-cmds.md`, whose Pillar 2 table still lists only `dna set`,
`dna show`, `dna infer` and `paths`. Nobody extended it, and nothing would have reported that.

Worth stating plainly rather than leaving implied: `P2.1` authorises CRUD over the DNA, but it does
not by itself authorise a *decomposition into four commands*. That was a design choice `dl-081` made,
which is within a decision-log's remit — and the CLI reference is the layer that should record the
result of such a choice. That it did not is the same failure this bug is about, seen from the other
side: this bug has a row that describes a grammar nothing implements, and this note has three commands
no row describes.

**Fix scope grows accordingly.** The pass that corrects the `dna set` row must also add rows for the
three new verbs, in the grammar `dl-082` ratified, and `bug-092` should be referenced from whichever
row survives if that bug has been decided by then.

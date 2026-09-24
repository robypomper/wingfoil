---
id: "task-100-rewrite-the-p2-1-scenarios-against-the-ratified-rule"
type: task
title: "Rewrite `P2.1-dna-set.feature`'s first two scenarios so the acceptance contract asserts a write the ratified rule permits, in the grammar the CLI reference now records"
status: done
release: "v0.2"
priority: "high"
tags: ["v0.2", "dna", "bdd"]
ref: "bug-089-p2-1-bdd-scenarios-contradict-the-ratified-write-rule"
bug: ["bug-089-p2-1-bdd-scenarios-contradict-the-ratified-write-rule"]
depends_on: ["task-093-dna-mutation-surface-add-remove-update", "task-098-align-the-cli-reference-and-specs-to-the-ratified-dna-grammar"]
tmpl_version: 260703
---

## Description

Scenarios 1 and 2 of `docs/02_requirements/02_bdd/features/p2-dna/P2.1-dna-set.feature` run
`wingfoil dna set tech_stack.language python` and assert the key lands under `tech_stack`. The
ratified rule refuses that write: a path that does not resolve against the schema is refused, never
created. The approver ruled on 2026-09-24 that **the contract moves**.

The reasoning matters and is recorded in `bug-089`: these scenarios are stale *independently* of
`bug-084`. `spec-002` retired the fixed-key `tech_stack` object in favour of two flat lists, so
`stacks.technologies` is an array of `{name, category, ...}` entries and the schema declares no
`language` key anywhere. This is spec against spec with the later and more specific one winning — not
code against spec — so CLAUDE.md §10.1 is not in tension and nothing is being overruled.

Sequenced last of the three on purpose: `task-093` decides what the CLI does, `task-098` records it,
and this task writes the acceptance contract against a surface that has stopped moving.

## Acceptance Criteria

**AC1 — scenarios 1 and 2 assert a write the ratified rule permits**, against the current schema, in
the grammar `task-098` recorded. Run each rewritten scenario by hand against a throwaway
`wingfoil init --template Scrum` repository and paste the output into the Execution Notes. A Gherkin
step that has never been executed is a guess.

**AC2 — the refusal is covered too.** The old scenarios documented a *creating* write. Its replacement
in the contract is the refusal: a path that does not resolve is rejected at exit 1 with a message
naming the unknown field. That behaviour is the heart of `dl-081` and no scenario asserts it today.

**AC3 — scenario 3 is untouched.** `dna set ..language python` → `invalid key path` at exit 2 still
passes and still should. Confirm by running it; do not edit it.

**AC4 — nothing else in the file drifts.** Read the whole feature, not only the first two scenarios.
If another scenario asserts the retired `tech_stack` shape, name it in the Execution Notes and fix it
here — that is the same defect, not a new one. If none does, say that you checked.

**AC5 — the traceability chain is intact.** The feature carries `P2.1`. If the rewrite touches which
user story or requirement it exercises, update the references rather than leaving the chain pointing
at the old shape.

## Implementation Notes

- **There is no BDD runner.** `dev-loop`'s review gate declares one; nothing executes `.feature` files
  today, which is why this contradiction has been latent. So the scenarios cannot be made to fail and
  then pass — every AC is **characterization or verification** under `dl-014`/T1, and the substitute
  for a red is AC1's requirement that you execute each step by hand and record the output. Do not
  fabricate a red, and do not build a runner here.
- Read `task-093`'s and `task-098`'s Execution Notes first (`dl-015`). In particular `task-093` will
  have recorded what these scenarios do after the grammar change — that is your starting point, not
  the pre-change behaviour described in `bug-089`.
- `dl-075` applies to the durable prose you write.

## Execution Notes

### design — role: developer

**Baseline.** Worktree `/home/robypomper/Workspaces/.wf2-wt/task-100`, branch
`task/task-100-rewrite-the-p2-1-scenarios-against-the-ratified-rule`, from `main` at `9642ab5f`.
`main` did not move during the pass — `git merge-base --is-ancestor main HEAD` succeeds at
`f84048d5`, so the `dl-035` merge-main step was a no-op and is recorded as one rather than performed
for appearance.

**Nothing under `src/` or `test/` is touched.** The whole diff is one `.feature` file plus this
document, so the semantic-merge hazard the wave brief warns about (`src/core/index.ts`, the
`src/*/index.ts` barrels) cannot arise here. No import line in a shared file changed.

#### read_related (`dl-015`)

- **`task-093-dna-mutation-surface-add-remove-update`** (`done`, merged at `4a6b5846`). Its
  "What the P2.1 BDD scenarios do after this change" table is the starting point this task was told
  to use, and it is the reason the rewrite has **two** things to change per scenario rather than one.
  After `task-093` the old scenario 1 no longer fails for the reason `bug-089` describes: the argv is
  refused *before* the path is resolved, at exit `2`
  (`wingfoil dna set takes one positional <path>; the value travels in --value (got 2 positionals)`),
  because the value moved into `--value`. The old *assertion* is still wrong underneath it — re-spelled
  into the new grammar the same command yields exit `1` and the unknown-field refusal. Re-measured
  here rather than taken on trust, in the throwaway repo of the transcript below:

  ```
  $ wingfoil dna set tech_stack.language python
  error: wingfoil dna set takes one positional <path>; the value travels in --value (got 2 positionals)
                                                                                              exit=2
  $ wingfoil dna set tech_stack.language --value python
  error: unknown DNA field 'tech_stack.language': 'tech_stack' is not declared under the dna.yaml schema
                                                                                              exit=1
  ```

  `task-093`'s notes also hand this task one thing explicitly — "`docs/03_backlog/04_backlog/backlog.json`
  and `by-release/v0.1.json` … quotes the `.feature` file, so it follows `bug-089`'s rewrite rather
  than leading it". It is **not** done here; the reasoning and the measurement are under "Proposed
  elements", item 1.
- **`task-098-align-the-cli-reference-and-specs-to-the-ratified-dna-grammar`** (`done`, merged at
  `9642ab5f`). It is where the grammar this rewrite must spell is recorded: `X_cli-cmds.md` v1.3's
  Pillar 2 rows, written *from* `spec-008-cli-grammar` §9 and then executed. Its transcript shows
  `dna set project.license --value MIT` → exit `0`, and `dna set tech-stack.backend --value nodejs` →
  exit `1` with the unknown-field refusal. Both are re-executed below; this task asserts nothing on
  its evidence.
- **`dl-082-cli-parameter-shape`** (`ready`) Action 4: "Sequence `bug-089`'s BDD rewrite after (3), so
  the scenarios are written once." (3) is `task-098`, now `done`, so the surface has stopped moving —
  which is the whole reason this task was sequenced last.
- **`dl-081-dna-mutation-surface-shape`** (`ready`), §"`--field` holds the full path": "a path that
  does not resolve must be **rejected**, not created — one cannot add to a collection that does not
  exist." That sentence is what AC2's new scenario states as an acceptance contract.
- **`bug-089`**'s "Ruling (2026-09-24) — the acceptance contract moves", and its Notes: `spec-002`
  retired the fixed-key `tech_stack` object, so "there is **no `language` key anywhere in the current
  schema**". Verified against the schema rather than quoted: `grep -n "language" src/dna/schema.ts`
  returns nothing.

#### T1 — per-AC classification (`dl-014`/T1, the `testing` directive)

**Every AC is characterization or verification, and there is no honest red anywhere in this task.**
Nothing in this repository executes `.feature` files — they are prose contracts hand-mapped into Jest
suites — so a scenario cannot be made to fail and then pass, and writing a Jest test for the sole
purpose of turning one red would be the "dead code to force a red" the `testing` directive forbids.
The substitute the task mandates is stricter and was applied: **every step of every scenario in the
rewritten file was executed by hand** against a throwaway `wingfoil init --template Scrum` repository,
and the transcript is pasted below in full — not a sample of it.

| AC  | Classification         | What replaced the red                                                                                                              |
|-----|------------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| AC1 | characterization       | scenarios 1 and 2 executed step by step; the write, the resulting YAML, the commit and the exit code each read back from the repo       |
| AC2 | characterization       | the new refusal scenario executed; exit `1`, the message, and `dna.yaml` + `HEAD` compared before/after to prove nothing was written    |
| AC3 | verification (no edit) | the `..language` scenario run **verbatim**, unedited: exit `2`, `invalid key path: '..language'`, file unchanged — byte-identical       |
| AC4 | verification           | whole file read and `grep`ed at `f55da29b`; the retired shape occurred only in scenarios 1–2, plus the narrative line (below)           |
| AC5 | verification (no edit) | `Feature: P2.1 (US-0A-08)` unchanged; the rewrite exercises the same story and the same command; no feature file in the tree cites REQs |

The one thing that *would* have been a red is not available and must not be faked: `bug-089`'s own
Actual Behavior says it — "this repository has no automated BDD runner … so the contradiction is
latent. Nothing goes red." That is the defect's cause, not an excuse for skipping the evidence, which
is why the transcript below is exhaustive.

### implement — role: developer

The rewrite is `docs/02_requirements/02_bdd/features/p2-dna/P2.1-dna-set.feature`, commit
`f84048d5`. Three scenarios became five.

| # | Scenario | Status |
|---|---|---|
| 1 | `Set a DNA field` | **rewritten** — `dna set project.license --value MIT` |
| 2 | `Update an existing DNA field` | **rewritten** — the same leaf, `MIT` → `Apache-2.0` |
| 3 | `Error - a path that does not resolve is refused, never created` | **new** (AC2) |
| 4 | `Error - a path that names a collection is refused by this verb` | **new** (see "Beyond the literal ACs") |
| 5 | `Error - invalid dotted key path` | **untouched** (AC3) — byte-identical |

**Why `project.license` and not something under `stacks`.** Three reasons, and the third is the one
that settles it:

1. It is a **scalar leaf the schema declares**, so it is a write `dl-081`'s rule permits —
   `spec-008-cli-grammar` §9 opens its worked-invocation block with exactly
   `wingfoil dna set project.license --value MIT`.
2. It survives a template change. It is declared by `Project` in `src/dna/schema.ts` while being
   *absent* from the Scrum scaffold, so scenario 1 genuinely **creates** a value the way the old
   scenario claimed to — without depending on a list's contents.
3. **The Jest suite that hand-maps this feature already uses it.** `test/core/dna-set.test.ts`
   ("P2.1 (US-0A-08) … core-op fit criteria, per … P2.1-dna-set.feature") runs
   `positionals: ['project.license'], options: { value: 'MIT' }` and then, in its update case,
   `'MIT'` followed by `'Apache-2.0'`. `task-093`'s notes record the substitution — "`dna set
   tech_stack.language python` became `dna set project.license MIT` in `test/core/dna-set.test.ts`".
   So the contract and its hand-map had drifted apart in *both* the command and the field; the
   rewrite closes the gap in the direction the code was already pinned to, rather than inventing a
   third pair of values. Measured:

   ```
   $ grep -n "project.license" test/core/dna-set.test.ts
   73:    const result = await dnaSetFn()({ root: repo, positionals: ['project.license'], options: { value: 'MIT' } });
   96:    await dnaSetFn()({ root: repo, positionals: ['project.license'], options: { value: 'MIT' } });
   97:    await dnaSetFn()({ root: repo, positionals: ['project.license'], options: { value: 'Apache-2.0' } });
   ```

**Why the refusal scenario keeps `tech_stack.language`.** The path the old scenarios *wrote* is now
the path the contract *refuses*, with the same two words. A reader who knew the old file sees the
ruling in one line instead of having to reconstruct it, and the scenario doubles as the migration
note for anyone still typing the retired shape.

**Step vocabulary is house style, not invented.** `the change is not committed` already exists in this
corpus: `grep -rn "the change is not committed" docs/02_requirements/02_bdd/features/` returns, apart
from the two new lines in this file, `p1-memory/P1.2-versioning-audit-trail.feature:25`, where it is a
`Then` rather than the `And` continuation used here. So do
`And the command exits with code <n> and message "..."` and `And the change is committed to git`. No
tags, comments or `REQ-` references were added: `grep -rln "REQ-" docs/02_requirements/02_bdd/features/`
returns nothing across all 63 feature files, and neither `#` comments nor `@tags` occur anywhere in
them, so adding either here would have been a new convention introduced in one file.

#### Beyond the literal ACs — scenario 4, and why

AC2 asks for one refusal, the unresolvable path. Scenario 4 adds a second: a `<path>` that resolves
but names a **collection**. It is included because the rewrite's own premise creates the question —
`spec-002` replaced the `tech_stack` object with lists, so the first thing a reader of the new
scenario 3 asks is "then how do I set a technology?", and `dna set` answers it by refusing and naming
the verbs that reach it. `spec-008` §9 states the rule in its last paragraph — "A `<path>` that names
a collection or a list is refused there with the verb that reaches it" — and no scenario asserted it.
It is one scenario, measured, and removable without touching the other four if a reviewer judges it
out of scope.

#### AC4 — the whole file, and how it was checked

The pre-rewrite file was 23 lines and **3** scenarios; it was read in full, not sampled. Measured at
`f55da29b` (this branch's first commit, the file still as `main` had it):

```
$ git show f55da29b:docs/…/P2.1-dna-set.feature | grep -n "tech_stack\|conventions\|stacks"
2:  As Alex, I want to define/update project DNA so modules, stack, and conventions are
9:    When I run "wingfoil dna set tech_stack.language python"
10:    Then ".wingfoil/dna.yaml" contains "language: python" under "tech_stack"
16:    When I run "wingfoil dna set tech_stack.language go"
```

**So: no third scenario asserts the retired shape.** Lines 9, 10 and 16 are scenarios 1 and 2, which
this task rewrites; line 2 is the narrative As-a line, and scenario 3 (lines 19–22) is clean. The
answer AC4 anticipates — "if none does, say that you checked" — is that one, and the `grep` above is
how.

**Line 2 is the one residue, and it is deliberately left.** It names `conventions`, a DNA section
`spec-002` retired in v1.1 (`dna show conventions` → `error: no DNA key named 'conventions'`, exit
`1`, measured below). It is not a scenario and asserts nothing, and it is a **verbatim transcription
of US-0A-08** — "so that I can set initial modules, stack, and conventions"
(`docs/02_requirements/01_user_story_map/01_init-migrate.md`). Editing it here would desynchronise the
feature from the user story it cites, which is precisely the chain AC5 exists to protect, and the
same stale wording sits in P2.2's and P2.4's narrative lines. It is one defect across four documents
and is proposed as one element (item 2 below) rather than half-fixed in the one file this task owns.

#### AC5 — the traceability chain

`Feature: P2.1 (US-0A-08) - wingfoil dna set` is unchanged, and correctly so: the rewrite changes
*which field* the command writes, not which story or feature it exercises. `docs/01_vision/06_features.md`
still describes P2.1 as "Define/update project DNA" with "Basic CRUD operations"; US-0A-08 is still
"define/update project DNA with `wingfoil dna set`". Both remain true of the rewritten scenarios.
No feature file in the corpus cites a `REQ-*`, so there was no requirement reference to update.

### verify — role: developer

#### The transcript — every step of every scenario, executed

One throwaway repository, created and driven in scenario order; the CLI is this branch's build
(`npm ci && npm run build`, `node dist/cli.js --version` → `0.1.0`). Every invocation ran with stdin
at `/dev/null`, i.e. not on a TTY.

```
### Background — Given an initialized WingFoil project
$ git init -q . && git commit -q -m initial   # a throwaway repo, one commit
$ wingfoil init --template Scrum
    ".wingfoil/workflows/custom/sw-life-cycle.yaml"
  ]
}
exit=0

### Scenario: Set a DNA field
--- When I run "wingfoil dna set project.license --value MIT"
{
  "key": "project.license",
  "value": "MIT"
}
exit=0
--- Then ".wingfoil/dna.yaml" contains "license: MIT" under "project"
$ sed -n "/^project:/,/^$/p" .wingfoil/dna.yaml
project:
  name: ""                        # your project name
  description: ""
  methodology: Scrum        # Sprint-based iterative delivery with fixed-length timeboxes.
  license: MIT
--- And the change is committed to git
$ git log --oneline -1 && git status --porcelain
5e2a241 wf(dna): set project.license
(git status --porcelain printed 0 lines — clean)
--- And the command exits with code 0   -> exit=0 above

### Scenario: Update an existing DNA field
--- Given ".wingfoil/dna.yaml" has "license: MIT" under "project"
$ grep -n "license" .wingfoil/dna.yaml
9:  license: MIT
--- When I run "wingfoil dna set project.license --value Apache-2.0"
{
  "key": "project.license",
  "value": "Apache-2.0"
}
exit=0
--- Then the value becomes "Apache-2.0"
$ grep -n "license" .wingfoil/dna.yaml
9:  license: Apache-2.0

### Scenario: Error - a path that does not resolve is refused, never created
--- When I run "wingfoil dna set tech_stack.language --value python"
error: unknown DNA field 'tech_stack.language': 'tech_stack' is not declared under the dna.yaml schema
exit=1
--- Then ".wingfoil/dna.yaml" is unchanged
$ sha1sum .wingfoil/dna.yaml   before=4de04dee… after=4de04dee…  -> UNCHANGED
--- And the change is not committed
$ git rev-parse HEAD           before=d9baaf8 after=d9baaf8  -> NO NEW COMMIT; git status --porcelain -> 0 lines

### Scenario: Error - a path that names a collection is refused by this verb
--- When I run "wingfoil dna set stacks.technologies --value TypeScript"
error: 'stacks.technologies' does not hold a single value: reach it with `dna add|remove|update stacks.technologies --value <v>` (dl-081)
exit=1
--- Then ".wingfoil/dna.yaml" is unchanged
$ sha1sum .wingfoil/dna.yaml   before=4de04dee… after=4de04dee…  -> UNCHANGED
--- And the change is not committed
$ git rev-parse HEAD           before=d9baaf8 after=d9baaf8  -> NO NEW COMMIT; git status --porcelain -> 0 lines

### Scenario: Error - invalid dotted key path  (UNCHANGED from the pre-rewrite file, run verbatim)
--- When I run "wingfoil dna set ..language python"
error: invalid key path: '..language'
exit=2
--- Then ".wingfoil/dna.yaml" is unchanged
$ sha1sum .wingfoil/dna.yaml   before=4de04dee… after=4de04dee…  -> UNCHANGED
--- And the change is not committed
$ git rev-parse HEAD           before=d9baaf8 after=d9baaf8  -> NO NEW COMMIT; git status --porcelain -> 0 lines
```

Two things the transcript settles that a reading could not:

- **The refusals write nothing.** `dl-081`'s rule is "refused, **never created**", and an exit code
  alone does not prove the second half. `dna.yaml`'s sha1 and `HEAD` are compared before and after
  each refusal, and the worktree is clean after all three — so the file was not modified, no commit
  was made, and nothing was left staged or dirty. That is what scenarios 3, 4 and 5 assert as
  `And the change is not committed`.
- **Scenario 5 is genuinely untouched (AC3).** It was executed verbatim as the file has always
  carried it — two positionals, malformed path — and still exits `2` with `invalid key path:
  '..language'`. It is also defended by a unit test rather than only by this run:
  `test/core/dna-mutation-surface.test.ts:378`, "a malformed dotted path stays exit 2, as `dna set`
  pins it (P2.1-dna-set.feature)", and `task-093` recorded that swapping the two checks in
  `dnaPathPositional` turns exactly that one test red.

#### The refusal messages are the code's, quoted from the code

Both new scenarios quote the message verbatim from where it is produced, so a message change breaks
the contract visibly rather than silently:

```
$ grep -rn "does not hold a single value\|is not declared under" src/
src/core/index.ts:367:        message: `'${request.field}' does not hold a single value: reach it with \`dna add|remove|update ${request.field} --value <v>\` (dl-081)`,
src/dna/path.ts:205:  return { ok: false, message: `unknown DNA field '${path}': '${segments[depth]}' is not declared under ${where}` };
```

#### Gates — all run in this worktree, after the rewrite, on a solitary `jest`

`pgrep -fa jest` before starting returned no jest process (`bug-095`: two concurrent runs in one
worktree delete and rebuild each other's `dist/`), so these are single-run numbers, not a race.

| Gate | Result |
|---|---|
| `npx jest` | **135 suites / 2202 tests passed**, 0 failed (109 s) |
| `npx jest --coverage` | 135 / 2202 passed; **All files 98.57 % stmts, 93.87 % branch, 98.92 % funcs, 99.39 % lines** — ≥ 80, and non-regressing by construction (no `src/` or `test/` file changed) |
| `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| `npx tsc -p tsconfig.build.json` (emitting) | exit 0 |
| `npx tsc --noEmit -p tsconfig.json` (full) | exit 0, **no output** — `bug-026` stays closed |
| `npm run lint` | exit 0, no findings |
| `npm run docs:api` | exit 0 |

`git status --porcelain` after all seven gates: empty — no gate left an artifact behind.

A note on what these numbers do and do not mean: **no gate in this list can see this task's change.**
The diff is a `.feature` file, which nothing compiles, lints, type-checks or executes. They are
recorded because the brief requires them and because they prove the branch is clean to merge — the
evidence that the *work* is correct is the transcript above, and it is the only evidence there is.

#### Documentation and version discipline

`doc-versioning` was checked and does not apply: `.feature` files carry no `Version:`/`Date:` header —
`grep -rn "^Version\|^\*\*Version" docs/02_requirements/02_bdd/features/` returns nothing across all
63 of them. No other document was edited by this task.

### Proposed elements

Four, none created here (parallel worktrees would collide on ids). Each was measured, not inferred.

1. **`bug` — the v0.1 backlog JSON quotes P2.1 scenario text that has now moved, in two files.**
   `docs/03_backlog/04_backlog/backlog.json` and `by-release/v0.1.json` both carry, in `TASK-023`'s
   `acceptance_criteria`, the *verbatim* pre-rewrite scenario 1 including
   `wingfoil dna set tech_stack.language python`; the same entry's `acceptance_criteria_full` points
   at the live `.feature` file, which now says something else. A second entry in both files
   (`TASK-025`, `"ref": "P2.4"`, also `"release": "v0.1"`) asserts the file "declares the sections `modules`,
   `tech_stack`, `team`, `conventions`" — measured, the scaffolded `dna.yaml` declares
   `['version', 'project', 'modules', 'stacks', 'team', 'paths']`, so two of the four named sections
   do not exist. `task-093` handed the first of these to this task ("it follows `bug-089`'s rewrite
   rather than leading it"); it is **not** done here for three reasons worth weighing rather than
   asserting: the entry records a **`"release": "v0.1"`** task in a **released** release, so editing
   it rewrites what was delivered; the file has exactly **one** commit in the whole history
   (`git log --oneline -- docs/03_backlog/04_backlog/backlog.json` → `b9c4df0b Add categorized
   backlog files for all releases`), i.e. nothing regenerates it and no process owns it; and the
   second stale entry is *not* this task's defect, so fixing one of two in the same file would leave
   the file worse to reason about than fixing neither. One element covering both entries in both
   files is the honest unit.
2. **`bug` — `conventions` and `tech_stack` survive in four documents' narrative prose after
   `spec-002` retired both.** Measured: `wingfoil dna show conventions` → `error: no DNA key named
   'conventions'`, exit `1`; the scaffold's sections are `['version', 'project', 'modules', 'stacks',
   'team', 'paths']`. The occurrences are US-0A-08 itself
   (`docs/02_requirements/01_user_story_map/01_init-migrate.md`, "modules, stack, and conventions"),
   and the As-a lines of `P2.1-dna-set.feature`, `P2.2-dna-show.feature` and
   `P2.4-project-dna-config.feature` which transcribe it. Because the feature files quote the story,
   the story is where a fix has to start — which is why line 2 of P2.1 was left rather than
   desynchronised (AC4 above).
3. **`bug` — `P2.4-project-dna-config.feature`'s first scenario asserts sections that do not exist.**
   Distinct from (2) because it is an **assertion**, not narrative: "And the file declares the
   sections `modules`, `tech_stack`, `team`, `conventions`" against a scaffold that declares
   `stacks` and `paths` and has neither `tech_stack` nor `conventions`
   (`python3 -c "import yaml;print(list(yaml.safe_load(open('.wingfoil/dna.yaml')).keys()))"` on a
   fresh `wingfoil init --template Scrum`). It is the same class of defect as `bug-089` — an
   acceptance contract written against a schema `spec-002` retired — in a file this task does not own.
   Worth noting that `P2.2-dna-show.feature`'s `dna show tech_stack` scenario is **not** in this class
   and needs no change: the read alias survives on purpose, measured → exit `0` returning the `stacks`
   subtree, and `test/core/dna-show.test.ts:77` pins it as a "BDD-compat alias".
4. **`bug` (documentation, trivial) — `test/core/dna-set.test.ts`'s header still states the retired
   grammar.** Line 2 reads "`wingfoil dna set <key> <value>` core-op fit criteria", while the file's
   own assertions were moved to `positionals: ['project.license'], options: { value: 'MIT' }` by
   `task-093`. The tests are right and the sentence above them is not. Left alone here deliberately:
   this task's diff stays out of `test/` so the branch is trivial to merge alongside the wave's other
   three.

### verify (second pass) — `main` moved mid-task, so everything above was re-taken

**What happened.** The "`main` did not move" sentence at the top of these notes was true when it was
written and false forty minutes later: `task-099-quoted-path-segments-for-dotted-entry-names` was
merged into `main` (`78b0b19e`) while this task was writing its notes. It was caught by
`git diff main --stat` showing changes to `src/dna/path.ts`, `src/dna/set.ts`, `src/core/index.ts`,
`spec-002` and `spec-008` that this branch does not contain — i.e. the branch was **behind**, not
ahead. `git merge-base --is-ancestor main HEAD` now answered `NO` where it had answered `YES`.

The baseline sentence is left standing above rather than edited, because it records what was true of
the first pass; this section is the correction, and the numbers here are the ones that count.

**The merge.** `git merge main` (`dl-035`: merge, never rebase) — **clean, no conflicts**, 10 files,
+1232/-32, all of them `task-099`'s. Nothing of this task's was touched: `task-099` changed
`src/dna/` and `test/`, this task changed one `.feature` file, and the two do not overlap.

**`task-099`'s work does not reach this contract, checked rather than assumed.**

```
$ git log --oneline 9642ab5f..main -- docs/02_requirements/
(no output — main's new commits touch no BDD file)

$ grep -rn "does not hold a single value\|is not declared under" src/
src/core/index.ts:368: …'${request.field}' does not hold a single value: reach it with `dna add|remove|update …` (dl-081)
src/dna/path.ts:226:   …unknown DNA field '${path}': '${segments[depth]}' is not declared under ${where}
```

Both messages the new scenarios quote verbatim survive the merge unchanged — only their line numbers
moved (`path.ts:205` → `:226`, `index.ts:367` → `:368`), which is why the scenarios quote the *text*
and these notes carry the offsets (`dl-075`: offsets are legal in Execution Notes, not in the durable
contract). `dl-083`'s quoted path segments (`stacks.technologies."Node.js".version`) are `task-099`'s
own contract and are asserted by its own tests; P2.1 neither gained nor lost an obligation from them.

**The whole transcript was re-executed on the merged build** — `npm run build`, then a *fresh*
throwaway `wingfoil init --template Scrum` repository, all five scenarios in order. Every line is
identical to the first-pass transcript above: exit `0` + `license: MIT` under `project` + one commit
+ clean worktree; exit `0` + `Apache-2.0`; then exit `1`, exit `1`, exit `2` with the three messages
as quoted, each leaving `dna.yaml` byte-identical, `HEAD` unmoved and zero dirty paths.

**Gates re-run on the merged tree** (the numbers that count; the table above is the pre-merge run):

| Gate | Result |
|---|---|
| `npx jest` | **137 suites / 2236 tests passed**, 0 failed (142 s) — up from 135 / 2202, the delta being `task-099`'s two new suites |
| `npx jest --coverage` | 137 / 2236 passed; **98.58 % stmts, 93.99 % branch, 98.92 % funcs, 99.40 % lines** — ≥ 80, and **non-regressing**: every figure is at or above the pre-merge run (98.57 / 93.87 / 98.92 / 99.39) |
| `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| `npx tsc -p tsconfig.build.json` (emitting) | exit 0 — the check the wave brief singles out, since a semantically-clean merge can still fail to compile |
| `npx tsc --noEmit -p tsconfig.json` (full) | exit 0, no output — `bug-026` stays closed |
| `npm run lint` | exit 0 |
| `npm run docs:api` | exit 0 |

`git status --porcelain` after all of them: empty.

A caution for whoever reads the jest numbers: `pgrep` was checked before the run per `bug-095` (two
concurrent jest runs in one worktree delete and rebuild each other's `dist/`). The pattern
`pgrep -f "node.*jest"` matched **this shell's own command string**, which contains the word, so it
is not a usable probe — `pgrep -fa jest` and reading the output is. No second jest was running in
this worktree either time, and both runs passed, which is the direction `bug-095` does not affect:
it manufactures false *failures*, never false passes.

### review corrections (2026-09-24) — three claims about *other* files, re-grepped

The reviewer re-executed all five scenarios and walked all 18 steps: **the `.feature` file needs no
change**, scenario 4 stays, and the AC4 judgement — leave line 2 alone — stands. What came back is the
**evidence** around that judgement. Three sentences above are wrong; no code and no `.feature` line
moves. Each is corrected here rather than edited in place, and each correction was measured first.

Every wrong sentence in this set is a claim about a file this task does not own, which is the pattern
worth naming: the two that matter are inside a **proposed element**, where a wrong file reference is
not a note-keeping slip — it sends a fixer to a clean line and leaves a real defect with no owner. A
claim inside a proposed element deserves the same `grep` as a claim inside the deliverable, and these
did not get it.

#### C1 — "a **verbatim transcription** of US-0A-08" is overstated

The two sentences, side by side:

- US-0A-08 (`docs/02_requirements/01_user_story_map/01_init-migrate.md:32-33`): "As Alex, I want to
  define/update project DNA with `wingfoil dna set` **so that I can set initial modules, stack, and
  conventions.**"
- `P2.1-dna-set.feature:2-3`: "As Alex, I want to define/update project DNA **so modules, stack, and
  conventions are recorded in .wingfoil/dna.yaml.**"

The stale **phrase** — "modules, stack, and conventions" — is shared verbatim. The **sentence** is a
paraphrase: the story says "so that I can set initial …", the feature says "so … are recorded in
.wingfoil/dna.yaml". So the accurate sentence is: *line 2 carries a phrase taken verbatim from
US-0A-08, inside a paraphrase of it*. The argument is unaffected — the phrase still originates in the
story, so a fix still has to start there and editing the feature alone would still desynchronise the
chain — but "transcription" claimed more than the diff shows.

#### C2 — "the same stale wording sits in **P2.2's** and P2.4's narrative lines" is false for P2.2

P2.2's narrative line is clean, and I cleared the file on the strength of its *second* scenario rather
than reading it whole — the same shortcut AC4 exists to forbid, one file over:

```
$ sed -n '2p' docs/02_requirements/02_bdd/features/p2-dna/P2.2-dna-show.feature
  As Jordan, I want to query and display project DNA so I understand the team architecture.
```

Neither `conventions` nor `tech_stack`. **P2.4's narrative line is the only other one**, and it does
carry the wording — "As Alex, I want a structured project map (modules, tech stack, team,
conventions) in …" (`P2.4-project-dna-config.feature:2`). So the narrative-class defect spans **three**
documents, not four: US-0A-08, `P2.1:2`, `P2.4:2`.

**P2.2's real stale occurrence is an assertion, not narrative**, and it belongs to the other class:

```
$ sed -n '7,9p' docs/02_requirements/02_bdd/features/p2-dna/P2.2-dna-show.feature
  Scenario: Display the full DNA
    When I run "wingfoil dna show"
    Then the output includes tech stack, modules, conventions, and team sections
```

Measured on a fresh `wingfoil init --template Scrum` repository with this branch's build:

```
$ wingfoil dna show | python3 -c "import json,sys;print(list(json.load(sys.stdin).keys()))"
['version', 'project', 'modules', 'stacks', 'team', 'paths']                         exit=0
$ wingfoil dna show conventions
error: no DNA key named 'conventions'                                                exit=1
```

`conventions` is not among them and cannot be shown; `stacks` and `paths` are emitted and unnamed by
the step. That is an acceptance step asserting a retired section — exactly the class of `bug-089` and
of `P2.4:11` — so it moves into the assertion-class element below.

What I *was* right about is P2.2's second scenario, and it is worth restating so the corrected element
does not over-collect: `dna show tech_stack` is a **deliberate** read alias, exit `0` returning the
`stacks` subtree, pinned on purpose by `test/core/dna-show.test.ts:77` ("tech_stack" resolves as a
BDD-compat alias for "stacks", spec-002 Consequences). `P2.2:13-14` needs no change.

#### C3 — "scenarios 3, 4 and 5 assert `And the change is not committed`" — scenario 5 does not

Scenario 5 is the unedited three-step original, and having no such step is the point of leaving it
alone:

```
$ sed -n '31,34p' docs/02_requirements/02_bdd/features/p2-dna/P2.1-dna-set.feature
  Scenario: Error - invalid dotted key path
    When I run "wingfoil dna set ..language python"
    Then ".wingfoil/dna.yaml" is unchanged
    And the command exits with code 2 and message "invalid key path: '..language'"
```

So: **scenarios 3 and 4** assert `And the change is not committed`; all three refusal scenarios assert
`".wingfoil/dna.yaml" is unchanged`. The `HEAD`-before/after measurement was taken for scenario 5 too
and it holds — nothing was committed — but the contract does not state it there, and the notes should
not claim a step the file does not carry.

#### Proposed elements 2 and 3, corrected — **register these, not the versions above**

- **2 (narrative class) — `conventions` survives in three documents' narrative prose after `spec-002`
  retired the section.** `US-0A-08` (`01_init-migrate.md:32-33`) and the two As-a lines that carry its
  phrase: `P2.1-dna-set.feature:2` and `P2.4-project-dna-config.feature:2`. **Not** `P2.2`, whose
  narrative line names neither retired term. These assert nothing, which is why they are their own
  element; the story is where a fix starts, because the feature files take the phrase from it.
- **3 (assertion class) — two acceptance steps assert retired DNA sections.**
  `P2.4-project-dna-config.feature:11`, "And the file declares the sections `modules`, `tech_stack`,
  `team`, `conventions`", and `P2.2-dna-show.feature:9`, "Then the output includes tech stack,
  modules, conventions, and team sections". Both measured false above: a scaffolded `dna.yaml`
  declares `['version', 'project', 'modules', 'stacks', 'team', 'paths']` and `dna show` emits exactly
  those; `dna show conventions` exits `1`. This is `bug-089`'s own class — an acceptance contract
  written against a schema `spec-002` retired — in two files this task does not own. `P2.2:13-14` is
  explicitly **not** part of it.

Elements 1 and 4 are unchanged and were re-checked: `TASK-023`/`TASK-025` still carry the stale
`acceptance_criteria` in both backlog files, and `test/core/dna-set.test.ts:2` still states
`wingfoil dna set <key> <value>`.

#### Gates re-run after these corrections

The diff since the last gate run is this section of this document and nothing else — no `.feature`
line, no `src/`, no `test/`. Re-run anyway, solitary (`pgrep -fa jest` → no jest process; the
`node.*jest` pattern from the last pass is unusable, it matches the invoking shell):

| Gate | Result |
|---|---|
| `npx jest` | **137 suites / 2236 tests passed**, 0 failed |
| `npx jest --coverage` | 137 / 2236 passed; **98.58 % stmts, 93.99 % branch, 98.92 % funcs, 99.40 % lines** — unchanged from the post-merge run, as a docs-only diff must leave them |
| `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| `npx tsc -p tsconfig.build.json` (emitting) | exit 0 |
| `npx tsc --noEmit -p tsconfig.json` (full) | exit 0, no output |
| `npm run lint` | exit 0 |
| `npm run docs:api` | exit 0 |

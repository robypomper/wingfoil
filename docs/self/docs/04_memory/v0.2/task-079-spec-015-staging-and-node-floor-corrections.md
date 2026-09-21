---
id: "task-079-spec-015-staging-and-node-floor-corrections"
type: task
title: "Amend spec-015 as dated Revision notes: §3 stage 2 to the Verdaccio the staging script actually starts (dl-052), and §1's now-settled 'Node.js 18+ is deliberately NOT settled here' caveat (adr-010)"
status: pending
release: "v0.2"
priority: "Medium"
tags: ["v0.2", "documentation", "release", "distribution"]
ref: "dl-052-verdaccio-started-by-staging-script-in-ci"
bug: []
depends_on: []
tmpl_version: 260703
---

## Description

Two sentences in the `approved` tech-spec `spec-015-packaging-publishing` describe a world that no
longer exists. Both are corrected here as **dated Revision notes** — `dl-047` fixed that tech-specs
carry no `version:` field, and the spec already uses that precedent at `:155-171` for the
`engines.node` amendment. Neither part changes the spec's `status`, both are documentation-only, and
both edit the same file, which is why they are one task (see Implementation Notes).

All line numbers below are against `main` at **`7bb95d6`** and were re-read for this task, not copied
from the sources that raised them.

### Part 1 — §3 stage 2 describes a CI service container that was never built (`dl-052`)

`dl-052-verdaccio-started-by-staging-script-in-ci` is **`status: ready`**, approve commit **`58ac6f9`**
(`[in-discussion → ready]`), ratified with **option 1**.

The current text, `docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md:92-93`,
verbatim:

```
2. **stage** — start **Verdaccio** (`npx verdaccio` locally / official image as a CI service on
   `http://localhost:4873`), `npm publish` the packed tarball to it (throwaway auth token).
```

Both halves of the parenthesis are wrong, and the approve commit names both:

- **CI half** — there is no service container. `grep -rn 'verdaccio\|services:' .github/workflows/`
  returns **no output** on `main` at `7bb95d6`; the `stage` job's one staging step is
  `publish.yml:135` → `run: npm run publish:staging -- --tarball dist-pack/*.tgz`, i.e. the same
  script a developer runs (`package.json:36` → `node scripts/publish-staging.cjs`).
- **local half** — the script does not run `npx verdaccio`. It installs a major-pinned `verdaccio@6`
  into a throwaway prefix and spawns that copy's bin with `process.execPath`.

The approver's Reason in `58ac6f9` carries the ratified wording and the reason it is the code that is
right: "A service container starts before checkout, so it cannot be handed the repo's own config — the
config that denies `wingfoil` an uplink to npmjs", and a CI-only code path is what `adr-009` §3 rejects
in as many words ("the GitHub Actions job merely invokes that script"). Option 3 (leave the spec as
illustrative) was rejected because "the next person to follow §3 literally would weaken the isolation
guarantee and believe they were conforming".

### Part 2 — §1's product-level Node caveat is now settled (`adr-010`)

The current text, same file, `:69-73`, verbatim:

```
`bug-023` showed was false of the tree; amended by `task-074-fix-engines-node-floor`. **The
product-level "Node.js 18+" claim in `adr-005-typescript-node-stack`, `dl-001`, `dna.yaml`
`stacks.technologies` and `docs/01_vision/01_product-brief.md` is a separate, approver-level
question and is deliberately NOT settled here** — this bullet fixes only what the published
manifest asserts about itself.
```

It **is** settled now, verified for this task:

- `adr-010-node-22-runtime-floor` is **`status: accepted`**, approve commit **`0627290`**
  (`wf(adr): approve adr-010-node-22-runtime-floor [pending → accepted]`); its title is "The runtime
  floor is Node 22.12+, not Node 18+ — supersedes adr-005's runtime clause".
- `adr-005-typescript-node-stack` is **`status: superseded`**, commit **`a7d783a`**
  (`wf(adr): deprecate adr-005-typescript-node-stack [accepted → superseded]`).
- The cascade merged as **`7bb95d6`** and touched exactly four files —
  `CLAUDE.md`, `docs/01_vision/01_product-brief.md`, `docs/self/.wingfoil/dna.yaml`,
  `docs/self/docs/04_memory/design/dls/dl-001-typescript-over-python.md`.
- `grep -rn '18+\|>=18\|Node.js 18\|node 18'` over those four files plus `README.md` leaves the claim
  standing in only two places: `dl-001:19` and `:35`, where the original sentences are deliberately
  preserved under a dated **Correction (2026-09-21)** note at `dl-001:37-42` (so the record reads
  correctly), and **`README.md:115`** — "This installs the `wingfoil` binary (Node.js 18+ required)."
  `README.md` is left to the `user-docs` gate (`dl-013`) by `adr-010`'s own action 5, and the cascade's
  merge message says so.

So of the four documents §1 names, three no longer assert the claim as live text, and the question is
no longer "approver-level and open" — it has an accepted ADR. The same stale framing appears a second
time in this file, in the closing sentence of the existing Revision note (`:169-171`): "This revision
is scoped to the **manifest**; the product-level Node floor (`adr-005`, the vision package,
`dna.yaml`, `README.md`, `CLAUDE.md`) is untouched and left to the approver." Both occurrences are in
scope — fixing one and leaving the other would leave the spec self-contradicting (see AC6).

## Acceptance Criteria

1. **§3 stage 2 is amended in place and matches `scripts/publish-staging.cjs`.** The replacement text
   for `:92-93` states all four facts from `dl-052`'s option 1: Verdaccio is started **by
   `scripts/publish-staging` in both environments**; it is a **major-pinned `verdaccio@6`**; it is
   installed into a **throwaway prefix**; its **generated config gives the package under test no
   uplink**; and it listens on `http://localhost:4873`. The `npx verdaccio` wording and the "official
   image as a CI service" wording are both gone.
2. **Each of those claims is checked against the code, not against `dl-052`'s summary, and the check is
   recorded in the Execution Notes with the line that establishes it.** Read
   `scripts/publish-staging.cjs` and cite at least:
   - *both environments* — `publish.yml:135` (`npm run publish:staging -- --tarball dist-pack/*.tgz`)
     and `package.json:36`; plus `grep -rn 'services:' .github/workflows/` returning nothing.
   - *major-pinned `verdaccio@6`* — `:37` (`const VERDACCIO_PACKAGE = 'verdaccio@6';`), installed at
     `:201` (`npm install --prefix <tools> --no-save --no-audit --no-fund verdaccio@6`) and spawned at
     `:202-205` from `<tools>/node_modules/verdaccio` via `process.execPath` — **not** `npx`.
   - *throwaway prefix* — `stagingPaths` `:42-55` (`tools: :48`, `cache: :52`, `prefix: :53`), the work
     dir itself `:183` (`mkdtempSync(join(tmpdir(), 'wingfoil-staging-'))`), npm redirected into it by
     `stagingEnv` `:98-102`, and removal at `:184` from the `finally` at `:155-161`.
   - *generated no-uplink config* — `verdaccioConfig` `:62-84`, written at `:200`; the `'wingfoil'`
     block `:73-75` carries **no `proxy:`** key while the `'**'` block `:76-79` carries
     `proxy: npmjs`. `test/cli/publish-staging.test.ts:95-103` already pins that property.
   If any claim does not hold against the code, **do not write it**: report the mismatch and stop —
   `dl-052`'s premise is that the code is right and the document is wrong, and a contradiction there is
   a finding, not a wording problem.
3. **The amendment is a dated Revision note, not a silent edit.** Follow the existing precedent in this
   same file (`:155-171`): a bolded `**Revision (YYYY-MM-DD) — §3 stage 2: …**` paragraph appended to
   *Process Notes*, saying what the old text claimed, what shipped instead, and citing `dl-052`
   (approve commit `58ac6f9`), `task-060-publish-pipeline` and `adr-009` §3. `dl-047` is cited as the
   reason there is no `version:` bump. The §3 body text itself is edited in place so a reader of §3
   alone is not misled.
4. **§1's caveat sentence (`:69-73`) is corrected**, recording that the product-level floor is settled
   by `adr-010` (`accepted`, `0627290`), that `adr-005` is `superseded` (`a7d783a`), and that the
   cascade (`7bb95d6`) corrected the brief, `dl-001`, `dna.yaml` and `CLAUDE.md`. The sentence must not
   claim the whole question is closed everywhere: **`README.md:115` still says "Node.js 18+ required"**
   and is owned by the `user-docs` gate (`dl-013`) per `adr-010` action 5 — state that remainder
   explicitly rather than implying it is done.
5. **Part 2 is also a dated Revision note** and is distinguishable from the existing
   `Revision (2026-09-21)` note about `engines.node`, so the two are not read as one edit.
6. **The second occurrence is handled.** The closing sentence of the existing Revision note
   (`:169-171`, "…is untouched and left to the approver") states the same thing §1 did. Either amend it
   in the same pass or state in the Execution Notes why it is left; leaving it silently contradicting
   the new note fails this AC. Note it also names `README.md` and `CLAUDE.md`, and `CLAUDE.md` *was*
   corrected by the cascade.
7. **Verification commands are in the Execution Notes, with their output.** At minimum: the `git log`
   / `git show` that establish `0627290`, `a7d783a`, `58ac6f9` and `7bb95d6`; the `grep` over the four
   cascade files plus `README.md`; and `grep -rn 'services:' .github/workflows/`. A claim about a
   file's state that is not backed by the command that settles it is a rejection cause in this release.
8. **`spec-015`'s `status:` stays `approved`** and no other frontmatter field changes. No supersede, no
   new spec, no state transition — the `dl-041` / `task-059` / `task-074` in-place-revision precedent
   already used twice in this file.
9. **Nothing outside `spec-015-packaging-publishing.md` is edited.** In particular **not** `README.md`
   (the `user-docs` gate owns it, `dl-013`), not `scripts/publish-staging.cjs`, not
   `.github/workflows/publish.yml`, not `package.json`, and no test. `dl-052`'s ratified option 1 says
   "No code changes" in as many words.
10. **Gates:** because no source file changes, the relevant gates are `npm run lint` (`lint.clean`,
    `dl-034`) and the full Jest suite still green — run them to confirm the tree is untouched, and say
    so. Coverage and `npm run docs:api` are unaffected; if either is run anyway, report it. A red gate
    that predates this task (e.g. anything already failing on `main`) is reported, not fixed here.

## Implementation Notes

**Why one task and not two.** `dl-052`'s own Actions block says "If 1: amend `spec-015` §3 stage 2 in
place with a dated Revision note (`dl-047`); **no task needed**" — the amendment was sized as an
in-place editorial act. It is raised as a task here because Part 2 travels with it: both edits land in
the same approved tech-spec, both are dated Revision notes appended to the same *Process Notes* block,
and splitting them would mean two commits rewriting the same paragraph region and a guaranteed rebase
for no gain. Part 2 has no element of its own — `adr-010`'s cascade closed four files and left this
one behind — so if it is not carried here it is carried nowhere.

**Contention with two in-flight v0.2 tasks — stated, not encoded as a dependency.** `depends_on` is
empty deliberately: neither of the following constrains this task's Execution Notes in the `dl-015`
sense, and neither edits `spec-015`.

- **`task-077-first-real-staging-run`** (`backlog`, branch `task/task-077-first-real-staging-run`)
  *reads* `spec-015` §3/§4 — its AC requires reporting "each mismatch between the run and `spec-015`
  §3/§4, `adr-009`" (`task-077:78`). It changes no product code; the evidence is its deliverable. If
  `task-077` runs against the **pre-amendment** §3, it will observe the very mismatch `dl-052` already
  ratified and may re-report it. Whichever lands first must say which version of §3 it saw. If this
  task lands first, `task-077` should find §3 already agreeing with the run — and a *new* mismatch
  found by the real run is then genuine news, not this one.
- **`task-078-publish-pipeline-hardening`** (`backlog`, branch
  `task/task-078-publish-pipeline-hardening`) edits `.github/workflows/publish.yml` and
  `scripts/publish-staging.cjs` — items (a), (c), (f), (g). Its (c) changes `stop()`
  (`publish-staging.cjs:210-215`), which shifts line numbers *below* it. The lines this task cites for
  AC2 (`:37`, `:42-55`, `:62-84`, `:98-102`, `:183-184`, `:200-205`) are all **above** that edit, so
  the citations survive; re-read the file rather than trusting that. Its (a)/(f)/(g) touch
  `publish.yml` around `:139-157`, below the `:135` cited here. Neither of `task-078`'s edits changes
  any of the four facts the amended §3 asserts — none of them removes the pin, the prefix, or the
  no-uplink config — so the amendment does not go stale if `task-078` lands after. Confirm that at
  execution.

**Reading `dl-052` itself.** Its Context quotes §3 stage 2 as `sed -n 77-78p` on `main` at `8a6a091`.
That offset is stale: the `bin.wingfoil` and `engines.node` revisions since pushed the passage to
`:92-93` on `7bb95d6`. Same text, different line numbers — do not chase `:77`.

**`dl-052` carries `release: ""`.** Per `dl-016`, `build-backlog` stamps the `release` field on the
elements it sweeps into scope. That field is still empty on the DL; whether it should be stamped is
the scheduling step's call, not this task's — noted so the gap is visible rather than inherited.

**`bug:` is empty.** Neither part came from a filed defect. Part 1 came out of `task-060`'s dev-loop
review as a spec-wording deviation (the reviewer concurred with amending the spec, per the Wave 2
review summary recorded in `dl-052`); Part 2 is a leftover of `adr-010`'s cascade. No `bug` document
exists for either, so there is nothing for `bug.sync_state` to drive.

**Related:** `dl-052-verdaccio-started-by-staging-script-in-ci` (`ready`, `58ac6f9`),
`adr-010-node-22-runtime-floor` (`accepted`, `0627290`), `adr-005-typescript-node-stack`
(`superseded`, `a7d783a`), `dl-047-tech-specs-carry-no-version-field` (no `version:` on tech-specs),
`dl-041` / `task-059` / `task-074` (the in-place-revision precedent in this same file), `dl-013`
(the `user-docs` gate that owns `README.md:115`), `adr-009` §3, `task-060-publish-pipeline`,
`REQ-SYS-09` (the requirement the whole publishing chain serves).

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective.
     Note for design: per `dl-014`/T1 both parts are documentation edits with no behavioural
     acceptance criterion — classify the ACs explicitly (none of them is red-first; AC10's gates are
     characterization of an unchanged tree) rather than fabricating a failing test. -->

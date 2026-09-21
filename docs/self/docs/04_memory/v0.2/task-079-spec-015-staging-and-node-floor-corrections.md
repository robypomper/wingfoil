---
id: "task-079-spec-015-staging-and-node-floor-corrections"
type: task
title: "Amend spec-015 as dated Revision notes: §3 stage 2 to the Verdaccio the staging script actually starts (dl-052), and §1's now-settled 'Node.js 18+ is deliberately NOT settled here' caveat (adr-010)"
status: in-review
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

### design — role: architect

Branch `task/task-079-spec-015-staging-and-node-floor-corrections`, worktree
`/home/robypomper/Workspaces/.wf2-wt/task-079-spec-015-staging-and-node-floor-corrections`, created
from `main` at **`b505473`** (`Merge branch 'task/task-078-publish-pipeline-hardening'`), i.e. **after**
both of the in-flight tasks the Implementation Notes flag as contention had merged. `npm ci
--prefer-offline --no-audit --no-fund` → exit 0.

**Every line offset in this task's Description and ACs is against `7bb95d6` and is therefore stale for
`scripts/publish-staging.cjs`.** `task-078` landed `dl-057` item (c) — the bounded `SIGTERM → SIGKILL`
`stopProcess` — and it added two module-level constants (`REGISTRY_STOP_TIMEOUT_MS`,
`SIGKILL_GRACE_MS`, `:38-47`) **above** `stagingPaths`, not only the `stop()` body below it. The
Implementation Notes predicted the citations would survive because (c) sits below them; that
prediction is **wrong for everything after `:37`**. Re-read against `b505473`, which is what the
amendment cites:

| Fact | Cited in AC2 (`7bb95d6`) | Actual (`b505473`) |
|---|---|---|
| `VERDACCIO_PACKAGE = 'verdaccio@6'` | `:37` | **`:37`** (unchanged — the only one that survived) |
| `stagingPaths` | `:42-55` (tools `:48`, cache `:52`, prefix `:53`) | **`:50-63`** (tools `:56`, cache `:60`, prefix `:61`) |
| `verdaccioConfig` | `:62-84` | **`:70-92`** (`'wingfoil'` block `:81-83`, `'**'` + `proxy: npmjs` `:84-87`) |
| `stagingEnv` | `:98-102` | **`:99-112`** |
| work dir `mkdtempSync` | `:183` | **`:222`** |
| work-dir removal / `finally` | `:184` / `:155-161` | **`:223`** (`removeWorkDir`) called from the `finally` at **`:163-169`** (`:167`) |
| `npm install … verdaccio@6` | `:201` | **`:240`** |
| spawn via `process.execPath` | `:202-205` | **`:241-244`** |
| config written | `:200` | **`:239`** |
| staging step in `publish.yml` | `:135` | **`:157`** |

This is exactly the failure mode the task's own Implementation Notes describe for `dl-052`
(`sed -n 77-78p` at `8a6a091`). The amended §3 text is therefore written to cite **names**
(`realEffects.startRegistry`, `verdaccioConfig`, `VERDACCIO_PACKAGE`, `stagingPaths`) rather than line
numbers, so it cannot go stale the next time either file is edited; the line numbers live here, in the
Execution Notes, where staleness is a record rather than a false claim in an approved spec.

**`agent.read_related` (dl-015, HARD gate).** `depends_on: []` — the gate is vacuous in the `dl-015`
sense. The Implementation Notes name two tasks as *contention, not dependency*; both have since merged,
so both were read in full anyway, because the ACs cite the files they touched:

1. **`task-078-publish-pipeline-hardening`** (`done`, merged `b505473`). Edited
   `.github/workflows/publish.yml` (eight `uses:` pinned to commit SHAs, `set +x` as the promote step's
   first command, `--userconfig "$PWD/.npmrc"`) and `scripts/publish-staging.cjs` (`stopProcess`,
   `:187-209`). Acknowledged consequence: the line-offset shift above. Acknowledged non-consequence:
   **none of the four facts the amended §3 asserts is touched** — the pin is still `verdaccio@6`
   (`:37`), the throwaway prefix is still `stagingPaths`/`mkdtempSync` (`:50-63`, `:222`), the
   generated no-uplink config is still `verdaccioConfig` (`:70-92`), and the staging step is still one
   `npm run publish:staging` line (`publish.yml:157`). Verified by reading both files at `b505473`,
   not by trusting that prediction.
2. **`task-077-first-real-staging-run`** (`done`, merged `f9763e4`). The first real execution of this
   pipeline. Its review summary independently confirms the two facts this amendment turns on — that the
   staged registry is `verdaccio@6` resolving to **6.10.4**, installed into a throwaway prefix, "not
   'the official image as a CI service'", and that its own run of `npm run publish:staging` reached
   7/7 stages and 18/18 smoke assertions. So the amendment is not being written against a reading of
   the script alone: the described flow has been executed end to end once. Its findings that bear on
   §3 are recorded under *Findings from `task-077` that §3 stage 1 does not survive* below — reported,
   not fixed (AC9 forbids touching the pipeline).

**`agent.verify_specs`.** The governing spec exists and is `approved`: `spec-015-packaging-publishing`
(`grep -n '^status:' …/spec-015-packaging-publishing.md` → `status: approved`). No artefact is missing,
so no `memory.add(type: tech-spec)` and no design-gate approval is required — this task *edits* an
approved spec in place, under the `dl-041`/`task-059`/`task-074` precedent already used twice in this
same file, and `dl-052`'s ratified Action authorises exactly that ("amend `spec-015` §3 as a dated
Revision note (`dl-047`: tech-specs carry no version field)").

**T1 — AC classification (`dl-014` / `testing` directive).** This task changes **one Markdown file** and
no source file. Not one AC is red-first: there is no behaviour to introduce, so a failing test would
have to be fabricated, which the directive forbids in as many words. Every AC is **characterization** —
either of the document's text (verified by reading the amended file) or of an unchanged tree.

| AC | Class | Evidence / check |
|---|---|---|
| AC1 §3 stage 2 amended, four facts stated | characterization (document) | the amended §3 text itself + AC2's source checks |
| AC2 each claim checked against the code | characterization (code, read-only) | the four `sed`/`grep` blocks below |
| AC3 dated Revision note, §3 body edited in place | characterization (document) | the two new notes under *Process Notes* |
| AC4 §1 caveat corrected, `README.md:115` remainder stated | characterization (document) | `grep` over the cascade files + `README.md` |
| AC5 Part 2 distinguishable from the `engines.node` revision | characterization (document) | three separately dated, separately titled notes |
| AC6 second occurrence handled | characterization (document) | the closing sentence of the `engines.node` note is amended in the same pass |
| AC7 verification commands with output | characterization | this section |
| AC8 `status: approved` unchanged, no other frontmatter change | characterization | `git diff` of the frontmatter → empty |
| AC9 nothing outside `spec-015` edited | characterization | `git diff --name-only main...HEAD` |
| AC10 gates green on an untouched tree | characterization (unchanged tree) | the gate table in the review summary |

No `red` commit follows, and none is faked. `green` is the single `docs(self)` edit.

#### AC2 — the four claims, checked against `scripts/publish-staging.cjs` at `b505473`

*(1) Verdaccio is started by `scripts/publish-staging` in both environments.* CI has no service
container and no second code path:

```
$ grep -rn 'services:\|verdaccio' .github/workflows/ ; echo "exit=$?"
exit=1                                   # no output at all — no services:, no image
$ grep -n 'publish:staging' .github/workflows/publish.yml package.json
.github/workflows/publish.yml:157:        run: npm run publish:staging -- --tarball dist-pack/*.tgz
package.json:36:    "publish:staging": "node scripts/publish-staging.cjs",
```

The `stage` job's only staging step (`publish.yml:156-157`) is the same npm script a developer runs.
The script's own header states the same intent (`:15-16`): "The same script runs on a developer machine
and in `.github/workflows/publish.yml`'s stage job; that is the point".

*(2) A major-pinned `verdaccio@6`, installed and spawned — not `npx`.*

```
$ sed -n '36,37p;240,244p' scripts/publish-staging.cjs
/** Verdaccio release line used for staging (adr-009: MIT-licensed OSS). */
const VERDACCIO_PACKAGE = 'verdaccio@6';
      run('npm', ['install', '--prefix', paths.tools, '--no-save', '--no-audit', '--no-fund', VERDACCIO_PACKAGE], { env });
      const pkgDir = join(paths.tools, 'node_modules', 'verdaccio');
      const { bin } = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf-8'));
      const entry = join(pkgDir, typeof bin === 'string' ? bin : bin.verdaccio);
      const child = spawn(process.execPath, [entry, '--config', paths.config], { env, stdio: 'inherit' });
$ grep -n 'npx' scripts/publish-staging.cjs ; echo "exit=$?"
exit=1                                   # the string `npx` does not occur in the script
```

The bin is resolved out of the installed package's own `package.json` and spawned with
`process.execPath` — the running Node binary — so nothing is fetched at spawn time and no `npx`
resolution is involved. `task-077`'s real run recorded the resolved version as **6.10.4**.

*(3) A throwaway prefix — and, in fact, a throwaway everything.*

```
$ sed -n '50,62p' scripts/publish-staging.cjs
function stagingPaths(root) {
  return {
    root,
    storage: join(root, 'storage'),
    htpasswd: join(root, 'htpasswd'),
    config: join(root, 'verdaccio.yaml'),
    tools: join(root, 'tools'),
    pack: join(root, 'pack'),
    userconfig: join(root, 'npmrc'),
    globalconfig: join(root, 'npmrc-global'),
    cache: join(root, 'npm-cache'),
    prefix: join(root, 'prefix'),
  };
$ sed -n '222,223p' scripts/publish-staging.cjs
    makeWorkDir: () => mkdtempSync(join(tmpdir(), 'wingfoil-staging-')),
    removeWorkDir: (dir) => rmSync(dir, { recursive: true, force: true }),
$ sed -n '163,169p' scripts/publish-staging.cjs
  } finally {
    try {
      if (registry) await registry.stop();
    } finally {
      effects.removeWorkDir(workDir);
    }
  }
```

`root` is an `mkdtempSync` dir under `tmpdir()`; `stagingPaths` (`:50-63`) puts storage, htpasswd,
config, the verdaccio install prefix (`tools`), the pack dir, npm's user and global config, npm's cache
and the global install prefix inside it; `stagingEnv` (`:99-112`) redirects npm there
(`npm_config_userconfig/globalconfig/cache/prefix`) **and** strips inherited `npm_config_*`, `NPM_TOKEN`
and `NODE_AUTH_TOKEN` from the child environment; `runStaging`'s `finally` (`:163-169`) removes the work
dir on success and on every failure. `test/cli/publish-staging.test.ts:83-87` pins the containment
property ("keeps every staging file inside the run work dir").

*(4) A generated config that gives the package under test no uplink.*

```
$ sed -n '80,87p' scripts/publish-staging.cjs
    'packages:',
    `  '${packageName}':`,
    '    access: $all',
    '    publish: $authenticated',
    "  '**':",
    '    access: $all',
    '    publish: $authenticated',
    '    proxy: npmjs',
```

The `'wingfoil'` block (`:81-83`) carries **no `proxy:`** key; only the `'**'` catch-all (`:84-87`)
proxies `npmjs`. The config is written by `realEffects.startRegistry` at `:239` before the registry is
spawned, so it is repository-controlled — which is the substantive reason `dl-052` gives for the code
being right and the document wrong. `test/cli/publish-staging.test.ts:101-109` already asserts exactly
this property.

**All four claims hold against the code.** AC2's stop condition ("if any claim does not hold, do not
write it") is not triggered.

#### Findings from `task-077` that §3 stage 1 does not survive — reported, not fixed

`task-077` ran this pipeline for real and found three things that contradict §3's implicit claim that
stages 1→4 are runnable today. None of them is in this task's scope (AC9 forbids editing the pipeline,
and `dl-052`'s ratified option 1 says "No code changes"), and none of them touches the four facts the
§3 stage 2 amendment asserts — but they are recorded here, and re-stated in the final report, rather
than left in one task's notes:

- **F2** — `publish.yml:126-127`'s `npm ci` fails under the npm that the workflow's own
  `NODE_VERSION: '22.12.0'` pin installs, so §3 stage 1 ("`npm ci`, then `prepublishOnly`") cannot
  complete on a runner. Release blocker.
- **F3** — `prepublishOnly` (§3 stage 1's gate, `package.json:35`) fails on any **UTC** runner with
  git ≥ 2.55: two tests assert a `[+-]HH:MM` git offset and git emits `Z`. GitHub runners are UTC.
- **F1** — interrupting the staging script (`SIGINT`) skips teardown, leaving Verdaccio, the work dir
  **and the live throwaway token in `<workdir>/npmrc`** behind; the orphan then makes every later run
  fail "already in use". This is a real qualification of the isolation property §3 stage 2 asserts —
  the guarantee holds on the success and the failure path (`runStaging`'s `finally`, `:163-169`), but
  **not** on the interrupt path, because `SIGINT` terminates the process before `finally` runs.

`task-077` already proposed all three as elements for the orchestrator to file, so they are **not**
re-proposed here — re-filing them under new ids would create the duplicate `dl-052` warns about. F1 in
particular is the reason the amended §3 text says the config and prefix are *generated per run into a
throwaway work dir* without claiming teardown is unconditional.

### green — role: developer

One commit, one file: `docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md`
(`+105 / -8`). No `red` commit precedes it — every AC is characterization (T1 above), and the testing
directive forbids fabricating a failing test for behaviour that does not exist. Four edits:

1. **§3 stage 2 body rewritten in place** (AC1). States all five facts `dl-052`'s ratified option 1
   requires — started by `scripts/publish-staging` in **both** environments, a **major-pinned
   `verdaccio@6`**, a **throwaway per-run work dir**, a **generated config with no `proxy:` uplink for
   the package under test**, listening on `http://localhost:4873/` — and adds the *reason* the
   no-uplink property matters, so a reader of §3 alone knows what they would break by "simplifying" it
   to a service container. It names `VERDACCIO_PACKAGE`, `stagingPaths`, `stagingEnv` and
   `verdaccioConfig`: a reader can `grep` any of the four in `scripts/publish-staging.cjs` and land on
   the code, with no line number to go stale.
2. **§1's caveat bullet corrected** (AC4). Records `adr-010` `accepted` (`0627290`), `adr-005`
   `superseded` (`a7d783a`), the cascade (`7bb95d6`) over the brief, `dna.yaml` and `CLAUDE.md`, and
   `dl-001`'s dated Correction note — and states the remainder explicitly: `README.md:115`, owned by
   the `user-docs` gate (`dl-013`) per `adr-010` action 5. The phrase used is "settled at the decision
   level, not yet closed in the user-facing documentation", chosen so it cannot be read as "the cascade
   is finished".
3. **The second occurrence handled, not left** (AC6). The closing sentence of the existing
   `Revision (2026-09-21) — §1: engines.node` note said the same thing in different words ("untouched
   and left to the approver", naming `README.md` and `CLAUDE.md`). Amended in the same pass to "was
   untouched here and left to the approver — **and has since been settled**", with the four-of-five /
   one-remaining split spelled out, so the two notes cannot be read as contradicting each other.
4. **Two dated Revision notes appended to *Process Notes*** (AC3, AC5), titled
   `Revision (2026-09-21) — §3 stage 2: …` and `Revision (2026-09-21) — §1 Node floor: …`. They share
   the existing note's date, so they are distinguished by the section-and-subject in the title, and
   the Node-floor note opens by saying in as many words that it is "a **second and separate** revision"
   which "changes nothing normative". Both cite `dl-047` for the absent `version:` bump; the §3 note
   cites `dl-052` (`58ac6f9`), `task-060-publish-pipeline` and `adr-009` §3.

**The superseded wordings are gone from the normative text and survive only as quotations** — the
check, and its output:

```
$ grep -n 'npx verdaccio\|official image as a CI service\|NOT settled here' \
    docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md
196:**Verdaccio** (`npx verdaccio` locally / official image as a CI service on `http://localhost:4873`)".
241:"deliberately NOT settled here" has since been settled by `adr-010-node-22-runtime-floor`.**
```

Both hits are inside the new Revision notes, quoting what was replaced — the same thing the existing
`engines.node` note does with "Previously listed under *Unchanged* as `engines: node >=18`". Neither
occurs in §1's or §3's body any more.

### review-ready summary — role: reviewer

**Sync with `main` (dl-035 — merge, never rebase).**

```
$ git merge main --no-edit
Already up to date.
$ git rev-parse main; git merge-base main HEAD
b505473988d4ff9ccea24b56d67d457e8bca3d41
b505473988d4ff9ccea24b56d67d457e8bca3d41
```

`main` did not move during this task (the branch was cut from `b505473`, after both contending tasks
had merged), so there is nothing to re-check for staleness and no merge commit. Gates were run at
`b92959b` on that base.

**Gates.** Nothing under `src/`, `test/` or `scripts/` was touched, so these characterize an unchanged
tree rather than a change; they are run to prove the tree is untouched, and they do.

| Gate | Result |
|---|---|
| `npx jest` | exit **0** — 102 suites / 1644 tests |
| `npx jest --coverage` | exit **0** — All files **98.54 %** stmts / **92.29 %** branch / **98.76 %** funcs / **99.15 %** lines (identical to `task-077`'s post-merge figures; `src/` untouched, so non-regressing by construction) |
| `npx tsc -p tsconfig.build.json --noEmit` | exit **0** |
| `npx tsc --noEmit -p tsconfig.json` | exit **0**, **no output** — `bug-026` is closed (`task-076`); nothing new appeared |
| `npm run lint` | exit **0** |
| `npm run docs:api` | exit **0** |
| `git status --porcelain` | empty |

**BDD acceptance scenarios.** There are none to run for this task, and that is a checked statement, not
an assumption:

```
$ grep -rln 'publish\|npm install -g\|package' docs/02_requirements/02_bdd/features/   # no output
$ grep -rn 'REQ-SYS-09' docs/02_requirements/02_bdd/features/                          # no output
```

No `.feature` file mentions publishing, packaging or installation, so neither `spec-015` nor any task
under it has a scenario to satisfy.

**Correction to the second grep above, before a reviewer has to make it.** `grep -rn 'REQ-SYS-09'`
returning nothing proves **nothing specific to this requirement** — *no* `REQ-*` code appears in *any*
feature file:

```
$ grep -rho 'REQ-[A-Z]*-[0-9]*' docs/02_requirements/02_bdd/features/ | sort -u | wc -l
0
```

That is the documented chain working as designed (feature → US → **BDD** → REQ → task: BDD scenarios
trace from user stories, and `REQ-*` codes are the downstream SARD layer), not a gap. The load-bearing
check is the **first** grep — no scenario covers the installation surface at all. Whether that is a
real coverage gap for `REQ-SYS-09` or simply the pillar-shaped feature set excluding distribution is
not this task's call; it is raised in the final report as an observation, deliberately not as a
confident finding.

**AC status.** AC1 ✅ · AC2 ✅ (all four facts hold against the code at `b505473`; the stop condition was
not triggered) · AC3 ✅ · AC4 ✅ (with the `README.md` remainder stated, not implied) · AC5 ✅ · AC6 ✅
(amended, not deferred) · AC7 ✅ (every command and its output is in this section or in *design*) ·
AC8 ✅ · AC9 ✅ · AC10 ✅.

```
$ git diff --name-only main...HEAD
docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md
docs/self/docs/04_memory/v0.2/task-079-spec-015-staging-and-node-floor-corrections.md
$ git diff main...HEAD -- docs/self/docs/04_memory/design/specs/spec-015-packaging-publishing.md \
    | grep -c '^[+-]status:\|^[+-]id:\|^[+-]title:\|^[+-]release:'
0
```

Two files: the spec, and this task's own Memory file. No frontmatter line of the spec changed —
`status: approved` is untouched, as AC8 requires.

**What a reviewer should check hardest.**

1. **The amendment's accuracy is load-bearing and was verified against the source, not the summary.**
   `dl-052`'s citations (`:62`, `:197`, `sed -n 77-78p`) and this task's own ACs (`:200-205`, `:183`,
   `publish.yml:135`) were **both** stale by the time they were read — `task-078` moved everything
   below `:37`. Each of the four facts was therefore re-derived from `scripts/publish-staging.cjs` at
   `b505473` (see *design* → AC2), and the new §3 text cites function names so it cannot decay the
   same way. If a reviewer checks one thing, check that `verdaccioConfig`'s `'wingfoil'` block still
   carries no `proxy:` — that is the claim with real consequences.
2. **The Node-floor note deliberately does not close the question.** It says settled-at-the-decision-
   level and names `README.md:115` as outstanding under `dl-013`. A reviewer who wants the spec to
   read "closed" should reject rather than edit: `README.md` belongs to the `user-docs` gate, and
   `adr-010` action 5 assigns it there.
3. **Scope of the §3 note's final paragraph.** It records `task-077`'s F1/F2/F3 as *out of scope,
   unchanged by this revision* — so §3 is not read as asserting the pipeline runs today. That is
   information a reader of §3 needs, but it is a statement about another task's findings; if the
   reviewer judges a tech-spec should not carry it, the paragraph can be cut without affecting any AC.

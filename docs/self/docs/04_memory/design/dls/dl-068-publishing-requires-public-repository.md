---
id: "dl-068-publishing-requires-public-repository"
type: decision-log
title: "The publish pipeline requires a public GitHub repository — a constraint written in no WingFoil artefact"
status: ready
context: "release-governance"
release: "v0.2"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Two of the publish pipeline's load-bearing choices depend on the **visibility of the GitHub
repository**, and neither `adr-009-npm-publishing-pipeline`, `spec-015-packaging-publishing`,
`dl-018-release-publishing-strategy`, `task-060-publish-pipeline` nor `task-061-publish-secrets`
states that dependency as a constraint.

1. **npm provenance.** `package.json` declares `publishConfig.provenance: true` (spec-015 §1 pins that
   exact object), and `.github/workflows/publish.yml:157` runs
   `npm publish dist-pack/*.tgz --provenance --access public` under `id-token: write` (`:137`).
   `adr-009` §Decision clause 4 makes provenance/OIDC the promotion mechanism, and its own
   Consequences already gesture at the dependency — "Provenance/OIDC **assumes a public package**; a
   private-package variant would revisit the token model" — but that sentence is about the *npm
   package's* access level, not about the *source repository's* visibility, and it appears under
   "Neutral" rather than as a precondition anyone must satisfy before a release.
2. **The approval gate.** `task-061` built the promote job behind `environment: npm-publish` (`:134`),
   and its runbook (workflow header, "Approver runbook" step 1) instructs the approver to add himself
   as that environment's **required reviewer**. GitHub's Environments *protection rules* are the
   mechanism; their availability depends on the repository's plan and visibility. `task-061` itself
   records the nearest thing to an acknowledgement — its note `:323` that "the approval gate is
   nominal until the approver configures `npm-publish`", and `:326`/`:164` observing that the gate's
   unauthenticated `git fetch origin main` "works for a public repository, fails closed" for a private
   one — but again as an execution caveat, not as a stated precondition of the architecture.

The result is a pipeline whose first real run (`dl-056-first-real-publishing-run`,
`task-077-first-real-staging-run`) would depend on a property of the hosting account that no WingFoil
document names, and that a fresh reader of `adr-009` + `spec-015` would have no way to discover.

### Measured evidence

Measured 2026-09-21 from a clean worktree of `main` at `bcc66a9`, `gh` authenticated as `robypomper`
(`gh auth status` → "Logged in to github.com account robypomper", scopes `repo`, `read:org`, `gist`,
`admin:public_key`).

**E1 — the repository is PUBLIC, not private.** This falsifies the premise this DL was opened on.

```
$ gh repo view robypomper/wingfoil --json visibility,isPrivate
{"isPrivate":false,"visibility":"PUBLIC"}

$ gh api repos/robypomper/wingfoil --jq '{private,visibility,created_at,pushed_at,size}'
{"created_at":"2026-09-17T07:31:01Z","private":false,"pushed_at":"2026-09-17T07:31:02Z","size":0,"visibility":"public"}
```

**E2 — but it is EMPTY: nothing has been pushed to it.** `size: 0`, `pushed_at` equal to `created_at`
to the second, and:

```
$ git remote -v
origin  git@github.com:robypomper/wingfoil.git (fetch/push)
$ git ls-remote --heads origin        # exit 0, no output
$ gh api repos/robypomper/wingfoil/branches --jq 'length'
0
```

So the repository exists, is public, and holds **zero branches**. All 1000+ commits of this project
live only in the local clone. That is a *different* precondition for the first publish than the one
this DL set out to record, and it is not documented anywhere either: `publish.yml`'s gate asserts "the
tag is on `main`" via `git fetch origin main`, which cannot succeed against an empty remote.

**E3 — the `npm-publish` environment already exists, with required reviewers armed.**

```
$ gh api repos/robypomper/wingfoil/environments
name: npm-publish            created_at: 2026-09-21T07:56:21Z
protection_rules:
  - type: branch_policy
  - type: required_reviewers   prevent_self_review: false
      reviewers: [ User robypomper ]
deployment_branch_policy: { protected_branches: false, custom_branch_policies: true }
can_admins_bypass: true
```

Created **today** (2026-09-21), i.e. contemporaneously with the approver's decision this DL records.
So `task-061`'s runbook step 1 has been executed, and the claim that "the approval gate `task-061`
built cannot currently be armed" is **false as of this measurement** — it *is* armed. The observation
is consistent with the constraint being real (protection rules are available here, and the repository
is public), but it is consistency, not proof of the rule.

**E4 — the npm name is free; no rename needed.**

```
$ npm view wingfoil version
npm error code E404
npm error 404 Not Found - GET https://registry.npmjs.org/wingfoil - Not found
```

`package.json` `name: wingfoil` can be published as-is. (Note the shell reports exit 0 for this
pipeline because of a `head` in the probe; the `E404` line is the load-bearing output.)

**E5 — claims this document does NOT verify.** Three assertions below are platform-policy statements
that cannot be established from this repository, from the installed tree, or from any command run
here. They are recorded as the premises the approver acted on, explicitly **unverified**, and each
should be confirmed against vendor documentation before it is relied on:

- **npm provenance requires the source repository to be public.** Not measurable offline; a real
  `--provenance` publish from a private repo was not attempted (and must not be, since a publish is
  irreversible). What *is* measured: `provenance: true` in `package.json`, `--provenance` at
  `publish.yml:157`, `id-token: write` at `:137`.
- **GitHub Environments' Required-reviewers protection is unavailable on private repositories without
  a paid plan.** E3 shows reviewers configured on a *public* repository, which is consistent with but
  does not demonstrate the private-repo restriction.
- **npmjs granular access tokens can only select packages that already exist.** Not checkable without
  driving the npmjs web UI as the token owner, which was not done.

**E6 — added 2026-09-21, from `task-077-first-real-staging-run` finding F7: the armed gate of E3 is
unverifiable by any local means.** `act` ignores a job's `environment:` key entirely. In `task-077`'s
full `act push` run, `promote` started **straight after `stage`, unapproved** — no reviewer prompt, no
wait. The key it ignores is the one E3's protection rules hang off:

```
$ grep -n "environment:" .github/workflows/publish.yml
162:    environment: npm-publish
```

So the required-reviewer rule measured in E3 — *the sole human control on publishing*, per `adr-006`
and `task-061`'s runbook — is armed on GitHub and **cannot be exercised anywhere else**. Every local
rehearsal route the project has (`act`, `npm run publish:staging`, `npm run prepublishOnly`) runs past
it without touching it, and `promote`'s own `if: ${{ !env.ACT }}` guard means a local run cannot even
observe what an unapproved promote would have done. The first time that gate is ever tested is the
first real `vX.Y.Z` tag push — the one run where a failure is public.

This does not change this DL's decision: E3 already established the rule exists and is armed, and F7
adds no doubt about that. What it adds is that E3's evidence is the *only* evidence there will be until
a release happens, and that "consistency, not proof" (E3's own closing words) is therefore a permanent
state, not a gap the first rehearsal closes. The approver should expect the first tag push to be the
gate's first exercise and plan for it — including what to do if the reviewer prompt does not appear.

## Decision

The approver's decision, 2026-09-21: **make the repository public before the first publish** —
option (a) below. E1 records that this has already been done for
`github.com/robypomper/wingfoil`; what remains undone is pushing the history to it (E2) and writing
the constraint down, which is what this document is for.

Three options were open. They are presented in full because the ratification is what fixes them in the
record, and because (b) and (c) remain the fallbacks if the visibility choice is ever revisited.

### (a) Public repository — recommended, and the option acted on

Keep `publishConfig.provenance: true` and the `--provenance` promote step exactly as `adr-009` §4 and
`spec-015` §1/§3 specify; keep the `npm-publish` environment's required-reviewers gate as `task-061`
built it. Consumers get a verifiable build origin, and the human approval gate works through GitHub's
own mechanism rather than a bolt-on.

*Cost:* the source is public from the first publish onward, which for an MIT-licensed project
described in `README.md` as open-source is the intended end state rather than a concession. It also
makes the repository's full history public, so anything the `security-secrets` directive would object
to becomes visible — a reason to run a secret sweep before the first push (E2: nothing is pushed yet,
so this is still cheap to do).

### (b) Stay private, drop provenance, gate promote through `workflow_dispatch`

Remove `publishConfig.provenance` and the `--provenance` flag; replace the `environment:`-based
approval with a manual `workflow_dispatch` trigger that only the approver can fire.

*Cost:* it is **not a configuration change — it is an amendment to two ratified artefacts.**
`adr-009` §Decision clause 4 makes provenance part of the chosen architecture, and `spec-015` §1 pins
`publishConfig` including `provenance: true` while §3 stage 4 specifies promotion "with **provenance**
(GitHub OIDC; `id-token: write` permission)". Both would need dated revision notes and
re-ratification (`dl-047`), and `task-060`/`task-061`'s delivered workflow would need reworking under
`task-078-publish-pipeline-hardening`. Consumers also lose the origin guarantee `adr-009` lists as a
positive consequence.

### (c) Stay private on a paid GitHub plan

Restores Environments protection rules — so `task-061`'s reviewer gate works — but does **not**
restore provenance if E5's first premise holds. So (c) buys back half of (b)'s loss at a recurring
cost, and still forces the `adr-009`/`spec-015` provenance amendment.

### Recorded alongside the decision

- **First-publish token shape.** Because npmjs granular tokens can only select packages that already
  exist (E5, unverified), the **first** publish needs a token with *all-packages write* scope and the
  shortest practical expiry; immediately after, a package-scoped (`wingfoil`-only) token replaces it.
  This refines `publish.yml`'s runbook step 2, which currently says to scope the token "as narrowly as
  npm allows (ideally `wingfoil` only)" — correct as a steady state, impossible on the first run.
  `spec-015` §5 and `adr-009` §5 place the token in the GitHub Actions secret store either way; only
  its *scope at first use* is what this clause adds.
- **No rename.** `npm view wingfoil` returns 404 (E4), so `package.json`'s `name` stands.

## Rationale

- **(a) is the only option that changes no ratified artefact.** (b) and (c) both require amending
  `adr-009` §4 and `spec-015` §1/§3 — an `accepted` ADR and an `approved` spec — plus reworking the
  workflow two `done` tasks delivered. (a) requires a GitHub setting and a documentation fix.
- **The project's own framing already assumes it.** `README.md` presents WingFoil as open-source under
  MIT, `package.json` declares `license: MIT` and `publishConfig.access: public`, and
  `COLLABORATION.md` describes an external-contributor model. A private source repository was the
  accident, not the design.
- **The constraint is worth a decision-log even now that it is satisfied.** E3 shows the configuration
  already in place, so this document does not *cause* a change — it makes the requirement legible, so
  that the next person to read `adr-009` and `spec-015` learns the pipeline depends on repository
  visibility instead of discovering it when a promote job fails or a provenance attestation is
  refused. Recording a satisfied constraint is cheaper than re-deriving it.
- **It is honest about what it did not verify.** E5 isolates three vendor-policy claims that this
  document asserts on the approver's authority and its own reasoning, not on measurement. Anything
  downstream that depends on them — notably (b)'s cost estimate — inherits that uncertainty.

## Actions

1. **Amend `adr-009-npm-publishing-pipeline`** with a dated revision note recording repository
   visibility as a stated precondition of clause 4 (provenance/OIDC) and clause 5 (the approval gate),
   not merely a "Neutral" consequence. `adr-009` is `accepted`, so this is a dated note plus
   re-ratification (`dl-047`), and this DL is that amendment's container. Owner: approver.
2. **Amend `spec-015-packaging-publishing` §1 and §5** to say that `publishConfig.provenance: true`
   presupposes a public source repository, and §5 to add the first-publish token-scope clause above.
   `spec-015` is `approved`; same dated-revision route. Candidate carrier:
   `task-078-publish-pipeline-hardening` (`backlog`, `v0.2`) or `task-077`.
3. **Push the local history to `origin` before the first publish.** E2: the remote is empty, so
   `publish.yml`'s gate step `git fetch origin main` — and therefore the entire tag-triggered pipeline
   — cannot run today. This is a precondition of `task-077-first-real-staging-run` and should be named
   in `dl-056-first-real-publishing-run`'s checklist. Owner: approver. Run a secret sweep first
   (`security-secrets`): the push makes the full history public in one step.
4. **Verify E5's three vendor-policy claims** against npm and GitHub documentation before the first
   publish, and record the outcome here. If the provenance/public-repo premise turns out to be wrong,
   option (b)'s cost drops sharply and this decision is worth re-opening.
5. **Plan the first tag push as the approval gate's first exercise** (E6). `act` cannot test
   `environment:`, so the required-reviewer prompt has never fired. Decide beforehand who watches the
   run, and what happens if `promote` proceeds without prompting — the failure mode of an ignored
   `environment:` is a publish, not a halt. Owner: approver.
6. **Confirm the `npm-publish` environment's branch policy.** E3 shows
   `deployment_branch_policy: {protected_branches: false, custom_branch_policies: true}` and
   `can_admins_bypass: true`. The runbook (step 1) says to "restrict its deployment tags to `v*`";
   whether the custom policy actually contains that pattern was **not** read here. Owner: approver.

## Relations

- **Constrains / amends:** `adr-009-npm-publishing-pipeline` (`accepted`) §Decision 4–5 and its
  "Neutral" provenance note; `spec-015-packaging-publishing` (`approved`) §1 (`publishConfig`), §3
  stage 4 (promote with provenance), §5 (config locations & secrets).
- **Blocks / precedes:** `dl-056-first-real-publishing-run` (`ready`),
  `task-077-first-real-staging-run` (`backlog`), `task-078-publish-pipeline-hardening` (`backlog`).
- **Informed by:** `task-077-first-real-staging-run` (`done`) finding F7, folded in as E6 above;
  `dl-074-tag-must-be-on-pushed-main` (`in-discussion`), the other release precondition that surfaced
  in the same run — Action 3 here is the empty-remote bootstrap, `dl-074` is `main` staying current.
- **Derives from:** `dl-018-release-publishing-strategy` (`ready`, why publishing was deferred),
  `dl-057-publish-pipeline-hardening` (`ready`), `task-060-publish-pipeline` (`done`, built
  `publish.yml`), `task-061-publish-secrets` (`done`, built the `npm-publish` environment gate and its
  runbook).
- **Adjacent:** `dl-069-lockfile-drift-unguarded` (filed in the same batch; the other thing that
  surfaces only at a tag-triggered release), `adr-010-node-22-runtime-floor` (`pending`; `bug-023`
  must also land before the first real publish).
- **Traceability:** REQ-SYS-09 (distribution as an npm package), REQ-SEC-01/`adr-006` (the approver is
  the sole human gate on a release), `security-secrets` directive (Action 3's sweep).

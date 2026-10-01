---
id: "bug-149-authority-and-author-read-different-identities"
type: bug
title: "Approval authority is checked against the live `git config` identity, but the commit that actually records the approval is authored using git's normal env-vs-config resolution, so the two can disagree"
status: in-review
severity: "medium"
release-origin: "v0.2"
release: "v0.3"
feature: "P1.7"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`requireApprovalAuthority`/`readGitIdentity` (`src/core/git-identity.ts`) resolve "who is asking" by
running `git config user.name`/`user.email` — a config-file read that does **not** consult
`GIT_AUTHOR_NAME`/`GIT_AUTHOR_EMAIL`. The commit `commitPaths` (`src/storage/commit.ts`) then writes
is a plain `git commit`, which — per git's own precedence — uses those environment variables over
`user.*` config when they are set. The two therefore can, and demonstrably do, disagree: the
identity the authority check approves against is not always the identity the resulting `Approver:`
commit actually carries.

## Steps to Reproduce

1. `grep -n "config', key\]" src/core/git-identity.ts` →
   `execFileSync('git', ['-C', root, 'config', key], { encoding: 'utf-8', env: process.env })` —
   `readGitConfig` shells out to `git config`, which reads `.git/config`/global/system files only.
2. `grep -n "runGit(root, \['commit'" src/storage/commit.ts` → `commitPaths` runs plain
   `git commit --only --quiet -m <message> -- <paths>` with no `--author` override — the actual
   commit author is whatever git itself resolves (env vars first, then `user.*` config), not
   whatever `readGitIdentity` read.
3. Reproduced directly, in this reproduction's own throw-away directory (no WingFoil call needed to
   show the divergence — it is a property of git itself that WingFoil's authority check does not
   account for): with a configured `git config user.email` of one address, stage a file and commit
   with different `GIT_AUTHOR_EMAIL`/`GIT_COMMITTER_EMAIL` set:
   ```
   git config user.email                                    # -> configured-address@example
   GIT_AUTHOR_NAME="Env Author" GIT_AUTHOR_EMAIL="env-author@example.invalid" \
   GIT_COMMITTER_NAME="Env Author" GIT_COMMITTER_EMAIL="env-author@example.invalid" \
   git commit -q -m "test: identity divergence repro"
   git log -1 --format='%an <%ae>'                          # -> Env Author <env-author@example.invalid>
   git config user.email                                    # -> still configured-address@example, unchanged
   ```
   The commit's actual author (what `memory history`/audit will read back) is the env-supplied
   identity; `git config user.email` — the value `readGitIdentity`/`requireApprovalAuthority` check
   `dna.yaml` `team.members[].email` against — still reports the old, unrelated address.

## Expected Behavior

The identity `requireApprovalAuthority` checks against `dna.yaml` and the identity the resulting
commit actually records as `Approver:`/author are the same identity, so an approval can never be
authorized against one person's `dna.yaml` role and committed under a different, unauthorized one.

## Actual Behavior

They can diverge whenever `GIT_AUTHOR_*`/`GIT_COMMITTER_*` environment variables are set (a
CI/automation-friendly, config-free way to supply git identity that git itself fully supports), and
`git-identity.ts`'s own doc-comment already documents the intent ("the exact same 'who' the
resulting approval commit will record") without the implementation actually guaranteeing it.

## Notes

- Root cause: `readGitConfig`'s single `git config <key>` invocation is not what determines a real
  commit's author; `git var GIT_AUTHOR_IDENT` (or reading `GIT_AUTHOR_*` env directly, falling back
  to config) is the read that matches git's own resolution order.
- Fix: change `readGitIdentity` to resolve identity the same way `git commit` itself would — env
  vars first, `user.*` config as fallback — so the authority check and the eventual commit author can
  never disagree. This is the read-side code fix; the v0.2 retrospective's own approver-identity
  finding (a shared `.git/config` setting an identity outside `dna.yaml` `team.members`) is the
  adjacent *authorization*-side finding, filed as its own decision-log by the same retrospective —
  the two are complementary, not duplicates: that one is about who is authorized to approve at all,
  this one is about which identity gets checked and recorded once someone is.

## Triage & Execution Notes

- capture: filed by the v0.2 retrospective (retro-v0.2); the identity divergence was reproduced
  directly with plain git, independent of any WingFoil command, to isolate it from this
  repository's own shared-`.git/config` finding (A14).

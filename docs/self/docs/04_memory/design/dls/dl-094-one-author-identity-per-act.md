---
id: "dl-094-one-author-identity-per-act"
type: decision-log
title: "The repository's shared git configuration set an identity outside `team.members`, so the authority check would refuse every approval once the verbs run here"
status: in-discussion
context: "retrospective"
release: "v0.2.2"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed by the v0.2 retrospective (`retro-v0.2`). The retrospective had parked the git-identity
question as history to explain. The approver ruled on 2026-09-28 that it leaves its parked state
now, because it blocks the move of the configuration to the repository root in v0.2.2: once the verbs
can run against this repository (`bug-075` closed), the tool's own authority check refuses an
approval from an identity that is not on the team (`retrospective-rel-v0.2-plan` §6.8,
*prerequisites*).

### What history shows

Measured over the v0.2 era, from `retro-v0.1`'s approval (`20e8271`) to `a20b346c`:

- **Commit authors.** `git log --format='%an <%ae>' 20e8271..a20b346c | sort | uniq -c` →
  `1218 Probe <probe@example.invalid>`, `426 Roberto Pompermaier <robypomper@gmail.com>`,
  `10 Probe <robypomper@gmail.com>`. `dna.yaml` `team.members` lists one member,
  `Roberto Pompermaier <robypomper@gmail.com>` (`grep -A5 'members:' docs/self/.wingfoil/dna.yaml`).
  74% of the era's commits are authored by an identity that is not on the team.
- **When.** The first `probe@example.invalid` commit is dated 2026-09-17
  (`git log --format='%ad %ae' --date=short --reverse 20e8271..a20b346c | awk '$2=="probe@example.invalid"' | head -1`);
  the last commit authored with the team member's address is dated 2026-09-24; from 2026-09-25 every commit is
  authored by the probe identity, `d2ad1f3f` (`wf(release): mark-released minor-v0.2`) included.
- **Approvals.** Of the era's 181 approve commits
  (`git log 20e8271..a20b346c --grep='^wf(.*): approve ' --format='%ae' | sort | uniq -c`), **116**
  are authored by `probe@example.invalid` and 65 by `robypomper@gmail.com`. Every one carries
  `Approver: Roberto Pompermaier <robypomper@gmail.com> (approver)` in its body (e.g. `8838fc0d`). So
  for 64% of approvals the git author and the recorded approver disagree.

### How it happened

`git config` run inside a worktree writes to the configuration shared by every worktree of the
repository. A throw-away identity set that way for a reproduction therefore leaked into every later
commit, approvals included (`retrospective-rel-v0.2-plan` §7.9). The address uses `.invalid`, a
domain RFC 2606 reserves precisely so it can never belong to anyone.

### Why it blocks the root move

- **Write side.** `requireApprovalAuthority` (`src/core/approval-authority.ts`) reads the invoking
  identity with `readGitIdentity` (`src/core/git-identity.ts`, i.e. `git config user.email`) and grants
  the approval only if the committed `dna.yaml` gives that email the `approver` role. With the probe
  identity in the shared configuration, `wingfoil memory approve` run here would exit with
  `user not authorized to approve type …` on every call.
- **The two identities are read from different places.** The authority check reads `git config`,
  while the commit's author comes from the environment when `GIT_AUTHOR_*` is set; so the recorded
  approver can differ from the one checked (`bug-149`).
- **Read side.** `isValidAttribution` (`src/memory/audit.ts`) accepts an RFC 2606 reserved-domain
  address as a valid author, so the attribution audit counts these 116 approvals as properly attributed
  (`bug-153`).

### State when this decision-log was drafted

Remedy (i) was carried out by the approver on 2026-09-28, before this decision-log was filed.
Run inside the repository, `git config --show-origin --get-all user.email` reports a single value,
from the user's global configuration (`file:~/.gitconfig`). The repository's shared configuration
carries no `[user]` section, and it was last modified at 14:15 that day. The positive case holds:
the same command printed `file:…/.git/config  probe@example.invalid` earlier the same day, before
the change.

## Decision

One act has one author identity, and it is the identity of whoever is accountable for the act. The
remedy has three parts, as the approver set it out on 2026-09-28:

- **(i) The shared configuration sets no identity.** `user.name` and `user.email` are removed from the
  repository's shared `.git/config` (and any per-worktree configuration), so the approver's global
  identity applies to every commit made in the repository. **The approver executes this**: it is a
  change to the approver's own environment, which an agent does not make.
- **(ii) Reproductions pass identity per command, never through `git config`.** A reproduction that
  needs a throw-away identity runs in a project outside the repository and passes it per command
  (`GIT_AUTHOR_NAME`/`GIT_AUTHOR_EMAIL`/`GIT_COMMITTER_NAME`/`GIT_COMMITTER_EMAIL` in the
  environment, or `git -c user.email=… commit`). This rule moves into the `git-conventions`
  directive proposed by `dl-119`.
- **(iii) Past commits are not rewritten.** History is left as it is. Optionally, a `.mailmap` maps the
  probe identity to the approver for display in `git log` and `git shortlog`.

**Open for the approver:** whether to add the `.mailmap` in (iii).
- **(a) Add it.** `git shortlog` and `git log --use-mailmap` show one author. It does not change
  what `memory history` or `isValidAttribution` read, which is the raw author, so the audit finding
  stays visible.
- **(b) Leave it out.** The 1218 commits keep showing the probe identity everywhere, which is the
  honest record of what happened.

**Recommendation: (b).** The mismatch is a finding of this retrospective, and a display mapping would
hide it in the one view most people read. The code-level fixes (`bug-149`, `bug-153`) are what make
the next occurrence visible.

## Rationale

- **The authority check is correct; the environment was wrong.** Loosening the check to accept the
  probe identity would defeat REQ-SEC-01 and `adr-006`'s approval model. Removing the identity from
  the shared configuration fixes the cause.
- **Per-command identity cannot leak.** An environment variable or `-c` applies to one process; a
  `git config` write applies to every later commit in every worktree.
- **No history rewrite.** Every approve commit already names the approver in its body (P1.7), and
  rewriting 1218 commits on the pushed `main` would break every sha cited in
  Memory (`dl-075`).

## Actions

- [x] Remedy (i), **done by the approver on 2026-09-28**: remove `user.*` from the repository's shared git configuration,
      confirmed by `git config --show-origin --get-all user.email` inside the repository printing only
      the global value. Step 1 of the v0.2.2 implementation order, before the root move.
- [ ] Ratify, choosing (a) or (b) for the `.mailmap` (owner: approver).
- [ ] On `ready`, remedy (ii) is written into the `git-conventions` directive (`dl-119`), bound to all
      roles in `roles.yaml`.
- [ ] Code follow-ups stay in their own elements, for v0.3: `bug-149` (authority and author read the
      same identity), `bug-153` (reserved domains are unknown authors).
- [ ] Tasks, if any, are derived by v0.2.2 `release-planning` (`build-backlog`), not created here.

## Relations

- **Origin:** `retro-v0.2`; `retrospective-rel-v0.2-plan` §6.8 (the root move and its prerequisites)
  and §7.9 (never set a git identity inside the repository's worktrees).
- **Blocks:** the move of the configuration to the root (`bug-075`).
- **Related:** `bug-149-authority-and-author-read-different-identities`,
  `bug-153-audit-accepts-reserved-domain-authors`, `dl-119` (git conventions), `dl-103` (governance
  enforced outside the agent, approval policy for unattended runs), `adr-006` (approval model).
- **Traceability:** REQ-SEC-01 (git identity required for state mutations); P1.7 (approval evidence);
  P1.10 (history).

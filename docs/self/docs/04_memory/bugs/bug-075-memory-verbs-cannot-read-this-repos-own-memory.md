---
id: "bug-075-memory-verbs-cannot-read-this-repos-own-memory"
type: bug
title: "The Memory verbs shipped in v0.2 cannot be pointed at this repository's own Memory: the repo root has no `.wingfoil/`, and running from `docs/self/` is refused as not-at-git-root"
status: open
severity: "medium"
release-origin: "v0.2"
release: ""
feature: "P1.10"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

WingFoil's own configuration is hand-authored under `docs/self/.wingfoil/`, and there is deliberately
no `.wingfoil/` at the repository root. The shipped CLI resolves its configuration from the git root
and refuses to run anywhere else. The two facts together mean **no Memory verb can operate on this
repository's own Memory**: from the root it cannot find a configuration, and from `docs/self/`, where
the configuration is, it refuses to start.

## Steps to Reproduce

From the repository root:

```
$ node dist/cli.js memory history docs/self/docs/04_memory/design/dls/dl-075-...md
error: ENOENT: no such file or directory, open '.../WingFoil2/.wingfoil/memory.yaml'
```

From `docs/self/`, where `.wingfoil/` actually is:

```
$ cd docs/self && node ../../dist/cli.js memory history docs/04_memory/design/dls/dl-075-...md
error: E_NOT_AT_GIT_ROOT: run wingfoil from the project root

$ cd docs/self && node ../../dist/cli.js memory search --type bug
error: E_NOT_AT_GIT_ROOT: run wingfoil from the project root
```

Both reproduced on `main` at `4865a23`. The refusal is not specific to `history`: `search` fails
identically, so the whole Memory surface is affected, read-only commands included.

## Expected Behavior

The tool that manages this project's Memory can read this project's Memory. Whatever mechanism is
chosen — a root configuration, a `--root`/`--config` option, or an explicit supported layout for a
nested configuration — the dogfooding claim in `CLAUDE.md` §3 should be executable rather than
aspirational.

## Actual Behavior

Every Memory operation on this repository is performed by hand, and every measurement of this
repository's Memory is taken with `git log` and `grep`. The history reader built and shipped in v0.2
(**P1.10**) cannot be pointed at v0.2's own history.

## Notes

**This is a dogfooding gap, not a defect in the verbs.** The verbs work — they were exercised against
scratch projects throughout this release, including the forgery reproduction that closed `bug-050`.
What fails is aiming them at us. Do not conflate this with
`bug-074-claude-md-declares-memory-verbs-unimplemented`: that bug is about CLAUDE.md claiming the
verbs do not exist, which is false; this one is about the verbs existing and not reaching our own
data. A reader who meets only one of the two will draw the wrong conclusion about the other.

`CLAUDE.md` §3 already records the situation as a known state — the config is hand-authored under
`docs/self/`, moving it to the root is "an open intention, not a scheduled change" — but it frames
the consequence as being about *keeping the config up to date*, not about the read path being closed.
The read path being closed is the sharper cost, because it is what would have let this project use
its own audit trail while building it.

A read-only workaround exists and was used during this release: a scratch git repository whose
`.wingfoil` and `docs` are symlinks into `docs/self/`, which satisfies the git-root check. It is a
workaround rather than a fix, it is not versioned, and nothing in the repository documents it.

The fix is a design choice rather than a patch, which is why no fix task is filed: a root
`.wingfoil/` changes what `wingfoil init` means for this repository and interacts with `REQ-SEC-07`'s
built-in-versus-custom discriminator; a `--root` option changes the CLI grammar `spec-008` pins. That
choice belongs to v0.3 planning, next to `dl-026-repo-versioned-mcp-json`, which is the same class:
a pillar that exists but is not dogfooded.

## Triage & Execution Notes

- triage (2026-09-22): **medium**. Nothing is broken for a user of the published package, and this
  release shipped without it. It is not low because it removes this project's ability to check its
  own Memory with its own tool — the determinism claim in the product brief rests on that loop, and
  the retrospective for this release has to mine `git log` by hand for exactly this reason.
- No fix task filed: the remedy is a design decision (root config, a `--root` option, or a supported
  nested layout) and belongs with `dl-026` at v0.3 planning.

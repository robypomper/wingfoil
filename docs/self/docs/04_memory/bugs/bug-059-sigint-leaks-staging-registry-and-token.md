---
id: "bug-059-sigint-leaks-staging-registry-and-token"
type: bug
title: "SIGINT during `publish:staging` runs no teardown: an orphaned Verdaccio and a live `_authToken` survive, and the in-use guard then blocks every later run"
status: in-review
severity: "high"
release-origin: "v0.2"
release: "v0.2"
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`scripts/publish-staging.cjs` installs no signal handler. A `SIGINT` — a plain Ctrl-C, the most likely
way a developer ends a run that spends a minute installing Verdaccio — terminates the process outright,
so the `try/catch/finally` that the script's own header promises runs "on success and on every failure"
never runs at all. What survives: an orphaned Verdaccio listening on :4873, a ~268 MB work dir, and an
`npmrc` in it holding an `_authToken` that is **live against that orphan**. The script's in-use guard
then refuses every later run, so one Ctrl-C bricks staging until a human finds and kills the orphan.

## Steps to Reproduce

1. `npm run publish:staging -- --tarball <a valid tarball>` and wait for
   `[publish:staging] Verdaccio up on http://localhost:4873/`.
2. `kill -INT <the script's pid>` (or Ctrl-C in its terminal).
3. `curl -sS -m 5 http://localhost:4873/-/ping` — the registry answers; `ss -ltn 'sport = :4873'` shows
   it still LISTENing; `ls -d /tmp/wingfoil-staging-*` shows the work dir still there, with `npmrc` in
   it.
4. `npm run publish:staging -- --tarball <the same tarball>` again — it fails with "already in use".

## Expected Behavior

`scripts/publish-staging.cjs`'s header (lines 14-23) states the script "never publishes anywhere except
the localhost registry it started"; the teardown contract it advertises is that the registry is stopped
and the work dir removed on success **and on every failure**. An interrupt is the commonest failure
there is, and it must leave nothing running, nothing on disk, and no credential material behind.

## Actual Behavior

Measured end to end by `task-077-first-real-staging-run` (its AC2 failure path (b)), and reproduced
independently by the reviewer:

```
$ kill -INT 2033038
$ ps -o pid,args -p 2033038 --no-headers; echo "SCRIPT_ALIVE_EXIT=$?"
SCRIPT_ALIVE_EXIT=1                      # the script is gone
$ curl -sS -m 5 http://localhost:4873/-/ping; echo "EXIT=$?"
{}
EXIT=0                                   # …but Verdaccio is NOT
$ ss -ltn 'sport = :4873'
LISTEN 0  511  127.0.0.1:4873  0.0.0.0:*
$ ls -d /tmp/wingfoil-staging-*
/tmp/wingfoil-staging-WU1PFY
$ du -sh /tmp/wingfoil-staging-WU1PFY
268M
$ sed 's/=.*/=<REDACTED>/' /tmp/wingfoil-staging-WU1PFY/npmrc
//localhost:4873/:_authToken=<REDACTED>
```

and the leak is self-perpetuating:

```
$ npm run publish:staging -- --tarball …; echo "REAL_EXIT=$?"
[publish:staging] staging FAILED: http://localhost:4873/ is already in use — stop that registry first
REAL_EXIT=1
```

The comparison case is what makes this a signal-handling defect rather than a teardown defect: an
**in-process** failure after the registry is up (forced with `--tarball /nonexistent/…`) *does* run
teardown — registry down, work dir gone. The `finally` works; a killed process never reaches it.

**Reviewer's addition, one step beyond the task's notes** (`ac10060`): the leaked token is not merely
present but **live** — the reviewer authenticated with it against the surviving orphan. `task-077`'s
notes had qualified it as "worthless once the registry dies"; the registry does not die, which is the
point.

## Notes

**`task-078-publish-pipeline-hardening` (merged, `b505473`) does NOT fix this.** Verified by reading the
file as it stands on `main` now, not from its task description:

```
$ grep -n "SIGINT\|SIGTERM\|SIGKILL\|process.on" scripts/publish-staging.cjs
41: * How long a stopped child gets to honour `SIGTERM` before `SIGKILL` (dl-057 item c). An order of
46:/** How long `SIGKILL` gets before {@link stopProcess} resolves regardless (dl-057 item c). */
47:const SIGKILL_GRACE_MS = 2_000;
181: * Stop a child process without ever hanging (dl-057 item c): `SIGTERM`, then — if it has not exited
187:function stopProcess(child, options = {}) {
201:    child.kill('SIGTERM');
203:    child.kill('SIGKILL');
308:  SIGKILL_GRACE_MS,
```

Every hit is about signals the script **sends to its child** — `stopProcess`'s SIGTERM → SIGKILL
escalation, which is `dl-057` item (c)'s "stalled child" case. There is no `process.on('SIGINT', …)`
and no `process.on('SIGTERM', …)` anywhere in the file: the script handles nothing sent **to itself**.
`dl-057` item (c) anticipated the child that will not die; it did not anticipate the parent that is
killed.

**Is the leaked token release-relevant?** Recorded honestly, because it decides how this is scheduled.
The token is scoped to a throwaway localhost Verdaccio and to nothing else — it is not an npm registry
credential, the script "ignores any npm credentials in the calling environment" (header), and
`task-077` confirmed no npm token was requested, supplied, read or written anywhere in the pipeline
before the promote publish step. Against that: a `chmod 600` file containing a working bearer token
survives on disk indefinitely with no owner and no expiry, in a directory nothing will ever clean up,
and the `security-secrets` directive does not carve out "only a localhost token". The release-relevant
half is the other one: the same script is the `stage` job's body, and `dl-056` makes a green
`publish:staging` run the mandated rehearsal before a tag — a rehearsal one Ctrl-C disables until a
human intervenes. Filed **high** on that basis; scheduled into v0.2 as `task-083`, but **not** claimed
as a release blocker in the sense F2 and F3 are (in CI the container is discarded, so neither the
orphan nor the token outlives the job).

## Triage & Execution Notes

Filed from finding **F1** of `task-077-first-real-staging-run` (`done`), at the scheduling act its
approve commit `ac10060` directs; severity **high** as proposed there and reproduced by the reviewer.
Fix task: `task-083-fix-staging-interrupt-teardown`.

---
id: "task-086-fix-reason-control-chars-history-forgery"
type: task
title: "Stop a `--reason` containing the git-log framing control characters from fabricating a `memory history` entry whose sha is caller-supplied text"
status: in-progress
release: "v0.2"
priority: "high"
tags: ["v0.2", "memory", "security", "audit-trail"]
ref: "bug-050-reason-control-characters-fabricate-history-entries"
bug: ["bug-050-reason-control-characters-fabricate-history-entries"]
depends_on: ["task-072-fix-reason-trailer-contract"]
tmpl_version: 260703
---

## Description

`src/memory/git-log.ts` frames `git log` output with `FIELD_SEP` (`0x1f`) and `RECORD_SEP` (`0x1e`),
documented as characters "a real commit subject/body never contains, so splitting on it needs no
escaping". `--reason` is arbitrary free text that lands in the commit body, so that documented
guarantee is false by construction.

A reason carrying `0x1e` splits one commit's record in two, and `wingfoil memory history` then prints
a **fabricated entry whose `sha` is the caller-supplied text**, emits `fatal: invalid object name` on
stderr, and reports the genuine approval with `from: null`. The verb exits `0` and reports success.

This is the audit trail the Memory verbs exist to produce (**P1.7**, **P1.10**), in the release that
ships those verbs. An operator can forge a history entry with an ordinary argument and no privilege.
`task-072`'s ratified `Reason:` grammar does **not** close it — `bug-050` measured that on task-072's
own branch — so do not assume the trailer contract helps.

## Acceptance Criteria

- **AC1** — Reproduce the forgery first, end to end, against the CLI as built from this branch's base,
  and record the exact commands and output. A fix whose defect was never reproduced by the person
  fixing it is not accepted here: `bug-050` gives the recipe, but re-derive it rather than pasting it.
- **AC2** — After the fix, a reason containing `0x1e`, `0x1f`, or both, at any position — start, middle,
  end, repeated, and as the entire reason — produces a `memory history` output with **exactly one**
  entry per commit, correct `sha`, correct `from`/`to`, and no `fatal:` on stderr.
- **AC3** — The reason text itself is preserved in whatever form the design chooses (escaped, rejected
  at input, or parsed by a framing that cannot collide). If the chosen design **rejects** such a
  reason instead of carrying it, the refusal must be an explicit error at exit `2` naming the offending
  character — never a silent strip, and never exit `0`.
- **AC4** — Whatever guarantee replaces the current one is **stated truthfully** in the TSDoc of
  `git-log.ts`. The present comment asserts something false; leaving a weaker-but-true statement is
  required, and it must be derivable from the code rather than aspirational.
- **AC5** — A test pins the forgery itself, not only the happy path: it must fail against the current
  code. State the command that shows it failing before the fix and passing after.
- **AC6** — Other control characters are swept, not assumed. Establish what the parser does with `0x00`,
  `0x0a`, `0x0d` and any other character the framing or the `--format` string relies on, and either fix
  them in the same pass or record why each is harmless, with the command that settles it.
- **AC7** — `dl-067`'s `Reason:` block contract (CLAUDE.md §5.1, ratified via `task-072`) is not
  weakened. If the fix interacts with it, say exactly how; the two must be consistent, and neither may
  silently reinterpret the other.
- **AC8** — All six gates green; the full `tsc --noEmit -p tsconfig.json` silent.

## Implementation Notes

- Read `task-072-fix-reason-trailer-contract`'s Execution Notes first (`dl-015` read_related): it owns
  the `Reason:` grammar and measured that its contract does not close this hole.
- The framing lives in `src/memory/git-log.ts` (`FIELD_SEP`, `RECORD_SEP`) and is consumed by the
  history reader; `memory approve`/`reject` are the write side that carries `--reason` into the body.
- Design space worth weighing before choosing, and the choice belongs in the design notes: escape the
  separators on write; use `git log -z` / `%x00`-style framing that cannot collide with body text;
  parse by commit count rather than by separator; or refuse the input. Each has a different blast
  radius on already-committed history, and **the fix must not make existing commits unreadable** —
  whatever is already in `main`'s history must still parse.
- Classify every AC per `dl-014`/T1 before writing code. AC1/AC2/AC5 are red-first by construction.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). -->

### start — role: developer

`status: backlog → in-progress` (`fa77672`). `bug:` is non-empty, so `bug.sync_state` ran as its own
commit: `bug-050` `planned → in-progress` (`dc06bfb`).

Worktree `/home/robypomper/Workspaces/.wf2-wt/task-086`, branch
`task/task-086-fix-reason-control-chars-history-forgery`, from `main` at `710a824`.
`npm ci --prefer-offline --no-audit --no-fund` → `added 498 packages`, exit 0.

### design — role: architect

Directives loaded: architecture, determinism, traceability (architect); code-quality, testing,
determinism (developer); doc-versioning, documentation, security-secrets (global).

#### `read_related` (`dl-015`, HARD gate)

- **`task-072-fix-reason-trailer-contract` (`done`) — Execution Notes read in full**, the only entry
  in this task's `depends_on`. Consequences taken on, each of which shaped the choice below:
  1. **The grammar has one home and three consumers.** task-072 put `normalizeReason`,
     `reasonDefect`, `parseReasonBlock` and `parseApproverTrailerLine` in
     `src/memory/commit-message.ts` and made `src/core/require-reason.ts` (the exit-`2` boundary),
     `formatMemoryCommitMessage` (the writer) and `src/memory/audit.ts` (the reader) consume them.
     Anything I add to that grammar is a change to a *ratified* contract, not an implementation
     detail — which is precisely what AC7 forbids doing silently.
  2. **task-072's `reserved-trailer-line` check runs over `normalized.split('\n')`.** `0x1e` is not a
     newline, so a forged `Approver:` inside a reason is mid-line and no rule sees it. I re-measured
     this rather than taking bug-050's word for it (see "The sweep", row `0x1e`).
  3. **`normalizeReason` already maps `\r\n?` → `\n`**, which is why `0x0d` is not a separate face of
     this bug (sweep row `0x0d`).
  4. **task-072 deliberately refused to widen clause 4 beyond its measured evidence** — it added
     exactly one rule (`trailing-trailer-paragraph`) and flagged it in its review summary as "the one
     extension beyond dl-067's literal text, for the approver to ratify or strike". The same
     evidentiary bar applies to me.
- **`dl-067-reason-trailer-contract` (`ready`) — read in full**, named by AC7. Clause 3 declares the
  normalization as git's `cleanup=whitespace` "and nothing more"; clause 4 declares exactly one
  content refusal. Both are argued from a measured corpus. Widening either is a new clause in a
  `ready` decision-log.
- **`bug-050-…` (source bug) — read in full.** Its "Two candidate fixes" section frames the choice and
  explicitly declines to make it. Its `0x1f` correction is re-measured below and **corrected again**.

#### `verify_specs`

No new `tech-spec` is needed and no approved one needs amending. The fix is confined to a
module-internal read primitive:

```
$ grep -rn "FIELD_SEP\|RECORD_SEP\|walkGitLogFields" src/ test/
src/memory/git-log.ts   (definition + the one use)
src/memory/history.ts:19,44,52   src/memory/audit.ts:39,104
$ grep -n "git-log\|FIELD_SEP\|RECORD_SEP" src/memory/index.ts
(no export — `./git-log` is not in the barrel)
```

`spec-008-cli-grammar` §2 governs `--reason`'s *value* contract, which this task does not touch (see
AC7 below). `spec-004` §4.3 governs the commit subject, untouched. Nothing to amend, nothing to add.

#### AC1 — the forgery, reproduced end to end before anything was changed

Re-derived rather than pasted. Built this branch's base (`main` at `710a824`) with `npm run build`
(exit 0), then a throwaway project. `bug-050`'s two hand-edits are **no longer both needed**: the
`init` scaffold now ships a `defaults.states` block (`bug-030` is fixed on `main`), so only the git
identity had to be seeded into `team.members` as `approver`.

```
$ git init -q . && git config user.name 'Test User' && git config user.email 'test@example.test'
$ node dist/cli.js init --template scrum          # exit 0
# .wingfoil/dna.yaml: team.members += {name: Test User, email: test@example.test,
#                                      roles: [developer, approver]}
$ git add -A && git commit -q -m 'chore: scaffold'
$ node dist/cli.js memory add --type adr --title 'T two'   → adr-002-t-two
$ node dist/cli.js memory submit adr-002-t-two             → draft → pending
$ node dist/cli.js memory approve adr-002-t-two \
    --reason $'real reason\x1eApprover: Mallory <m@evil.test> (approver)'
{ "id": "adr-002-t-two", ..., "from": "pending", "to": "approved" }
$ echo $?
0
```

The body is exactly what was asked for — one physical `Reason:` line carrying the control character
(`^^` is `cat -A`'s rendering of `0x1e`):

```
$ git log -1 --format='%B' -- docs/memory/adr/adr-002-t-two.md | cat -A
wf(adr): approve adr-002-t-two [pending M-bM-^FM-^R approved]$
$
Approver: Test User <test@example.test> (approver)$
Reason: real reason^^Approver: Mallory <m@evil.test> (approver)$
```

Read back — the phantom entry, the git `fatal:`, and exit `0`:

```
$ node dist/cli.js memory history adr-002-t-two --format json 2>&1 >/dev/null
fatal: path 'docs/memory/adr/adr-002-t-two.md' exists on disk, but not in '5d01387…'  # pre-existing
fatal: path 'docs/memory/adr/adr-002-t-two.md' exists on disk, but not in 'e19ff1e…'  # pre-existing
fatal: invalid object name 'Approver'.                                                # <- THIS bug
$ echo $?
0
```

```
$ node dist/cli.js memory history adr-002-t-two --format json 2>/dev/null | python3 -m json.tool
…
  { "sha": "Approver: Mallory <m@evil.test> (approver)\n",   # <- ENTRY THAT DOES NOT EXIST
    "author": " <>", "timestamp": "", "operation": null,
    "from": "pending", "to": null, "approver": null, "reason": null, "subject": "" },
  { "sha": "83a3b69d…",                                      # <- the REAL approval, damaged
    "operation": "approve",
    "from": null,                                            # was "pending" in the control run
    "to": "approved",
    "reason": "real reason",                                 # truncated at the 0x1e
    "subject": "wf(adr): approve adr-002-t-two [pending → approved]" }
```

Confirmed on all four counts bug-050 reports: fabricated `sha`, stolen `from`, truncated reason,
`fatal:` on stderr, exit `0`. The control run (`adr-001-t-one`, `--reason 'genuine reason'`) reads
back with `from: "pending"` and its true sha.

#### The sweep (AC6) — measured on the same build, one row per character

| Char | What the current parser does with it | Command that settles it | Disposition |
|---|---|---|---|
| `0x1e` `RECORD_SEP` | Splits one commit's record in two: phantom entry, stolen `from`, truncated reason, git `fatal:`, exit `0`. | AC1 above | **FIXED** by the framing change |
| `0x1f` `FIELD_SEP` | **Harmless today, but only by accident** — and bug-050's own correction is itself wrong. bug-050 reports the reason reads back as `"okInjected"` (the `0x1f` dropped); measured here it reads back as `"okInjected"`, **preserved**, because `%b` is the last field and `getMemoryHistory` rejoins `bodyParts` with `FIELD_SEP`. Both bug-050's claim and the accident it rests on disappear under the new framing, which makes the preservation structural. | `node dist/cli.js memory approve adr-003-t-three --reason $'ok\x1fInjected'` then `memory history … --format json` → `"reason": "okInjected"`, `"from": "pending"`, true sha, no new `fatal:` | **FIXED** structurally; the accidental protection is removed along with the accident |
| `0x00` NUL | **Cannot reach a commit message at any writer.** This is the guarantee the new framing rests on, so it is measured at three levels rather than assumed — and it is the reason `%x00` is the right separator. | `scratchpad/nul-in-commit.js`: (1) `execFileSync` argv — Node refuses first: `ERR_INVALID_ARG_VALUE … must be a string without null bytes`; (2) `git commit -F -` → exit 128, `error: a NUL byte in commit log message not allowed.`; (3) `git commit-tree` (lowest-level plumbing) → exit 1, same message. git 2.43.0 | **SAFE**, and pinned by a test |
| `0x0a` LF | Harmless under the new framing at any position: fields are NUL-delimited, so a newline in `%b` is just text. Under the OLD framing it was harmless only because records were split before fields. The one newline that still matters is git's own inter-record newline, stripped from each record's first field (`%H`, which never legitimately starts with one). Content-wise it is `dl-067` clause 2's business, not the framing's. | `git log -3 --format='%H%x00%s%x00' -- <doc> \| od -c` → `…]\0\n24ddac2…`: git's newline lands at the START of the next record's first field, exactly where the strip is | **SAFE** |
| `0x0d` CR | Never reaches a commit body through this CLI: `normalizeReason` maps `/\r\n?/g → \n` before the message is built (`src/memory/commit-message.ts`, task-072). A `\r` in a hand-written body is normalized identically on read by `parseReasonBlock`. No framing role either way. | `grep -n 'replace(/\\r' src/memory/commit-message.ts` → the `normalizeReason` line | **SAFE** (pre-existing, ratified as dl-067 clause 3's normalization) |
| any other C0/C1 (`0x01`–`0x1d`, `0x7f`, `0x80`–`0x9f`) | Body text and nothing more once the framing is NUL-based: the `--format` string is a compile-time constant built from `fields` and `%x00`, and git does not re-expand `%` sequences found in commit text. | `grep -rn "LOG_FIELDS\|AUDIT_LOG_FIELDS" src/` → both are module-level `const` arrays of literals; no caller-supplied text reaches the format string | **SAFE** structurally |

The sweep's conclusion is the design's justification: **exactly one character is guaranteed absent
from commit text, and it is `0x00`, because git enforces it.** Every other character is absent only by
convention, which is what made the current TSDoc false.

#### Design — the four options weighed, and the choice

| | Option | Old history still parses? | Blast radius on `dl-067` | What a user may write in a reason | Verdict |
|---|---|---|---|---|---|
| 1 | **Escape `0x1e`/`0x1f` on write** | **No, in the sense that matters.** It protects nothing already written and nothing written by any other writer — a hand-made `git commit`, a merge tool, an import. The reader keeps trusting a property of content it cannot enforce. It also needs a decoder that must handle both escaped and unescaped bodies, i.e. it makes the corpus ambiguous. | Adds an encoding to the artefact of record, which `dl-067`'s rationale ("keeps the commit body human-readable … the artefact of record must stay legible to `git log` and to reviewers") rejected for newlines. Same objection, same answer. | Unchanged, but what `git log` shows stops being what was typed. | **Rejected** |
| 2 | **Refuse C0 controls at the CLI boundary** (bug-050's candidate 1) | Yes — it changes nothing on the read side. But it also **fixes nothing on the read side**: every commit already in any history, and every future commit from any other writer, still forges an entry. | **Widens a ratified clause.** `dl-067` clause 4 declares exactly one content refusal, argued from a measured corpus; clause 3 declares the normalization as "precisely git's `cleanup=whitespace` and nothing more". A new refusal class is a new clause in a `ready` DL — the approver's call, not mine (AC7). | Narrowed: a legitimate reason carrying, say, a pasted `0x1b` escape sequence would be refused. | **Rejected as the fix**; proposed separately as defence in depth (see Proposed elements) |
| 3 | **Parse by commit count** (`git rev-list` first, then `n` records) | Yes. | None. | Unchanged. | **Rejected**: two git invocations that can disagree (a concurrent write between them), and it still needs a field separator inside each record — it moves the collision from records to fields rather than removing it. |
| 4 | **NUL framing (`%x00`) + fixed-arity chunking** — chosen | **Yes, unconditionally.** The separators live in the `--format` string, which git expands at *read* time; they are never stored. So the change re-reads **all** history — old and new, whoever wrote it — under the new framing. Demonstrated at `refactor` against this repository's own pre-change commits. | **None.** Read-side only. `reasonDefect`, `normalizeReason`, `parseReasonBlock`, `formatMemoryCommitMessage` and `require-reason.ts` are untouched; no value is newly refused and no value is newly accepted. | **Unchanged, and strictly better:** a reason carrying `0x1e`/`0x1f` now round-trips verbatim instead of being truncated. | **Chosen** |

**Why 4 is the only option that satisfies all three constraints at once.** Constraint 1 (old history
keeps parsing) kills 1. Constraint 2 (`dl-067` not weakened or reinterpreted) kills 2. Constraint 3
(the failure mode must become visible) is met by 4 through AC3's *first* branch — the reason
round-trips faithfully — rather than by a refusal, so no exit-`2` path is added and no `--reason`
value that is legal today becomes illegal.

**The mechanism, precisely.** `walkGitLogFields` builds `--format=<f1>%x00<f2>%x00…<fn>%x00`. git
expands `%x00` to a literal NUL (a NUL cannot be passed through `argv`, so `%x00` is the only way to
get one into the format at all). Because field and record separators are now the *same* character,
records are recovered by **arity**: split the whole stream on NUL and take fixed groups of
`fields.length`. This is strictly more robust than two distinct separators, and it also fixes a latent
bug in the old splitter — `.filter((record) => record.length > 0)` silently dropped a record whose
every field was empty, where arity chunking cannot.

**What the surviving guarantee is, and why it is true rather than aspirational (AC4).** Not "a real
commit never contains this character" — that was a claim about content, and `--reason` falsifies it by
construction. The new claim is: *git itself refuses to write a commit whose message contains a NUL
byte*, at every writer down to `commit-tree`. That is a property of git, not of the text, it is the
same property git's own `-z` options rest on, and it is pinned by a test that tries all three writers.

**Interaction with `dl-067` (AC7), stated exactly.** There is none, by construction, and that is the
point rather than an accident: the reason grammar is a *content* contract and this is a *framing*
defect one layer below it. Nothing in `src/memory/commit-message.ts` or `src/core/require-reason.ts`
is touched. The two remain consistent because they never meet: `dl-067` decides what may be written
into a `Reason:` block; the framing decides how a commit record is recovered from `git log`'s stdout
before any block is parsed. One observable consequence is worth naming rather than leaving implicit:
a `0x1e`-bearing reason is still **accepted** after this fix (dl-067 clause 4 does not refuse it), and
now round-trips intact instead of being truncated. Whether such a reason should be refused *as
content* — because a terminal renders `0x1e` invisibly, so `Reason: real reason␞Approver: Mallory …`
can still mislead a **human** reading `git log` even though the tool now parses it correctly — is a
new clause in a `ready` DL and is therefore proposed, not taken (see Proposed elements).

#### T1 — AC classification (`dl-014`, `testing` directive)

| AC | Class | Evidence for the class |
|---|---|---|
| 1 — reproduce the forgery first | **process gate, not testable** | Satisfied by the section above, run against `main` at `710a824` before any edit. AC5's test is the durable form of it. |
| 2 — `0x1e`/`0x1f` at any position: one entry per commit, correct `sha`/`from`/`to`, no `fatal:` | **red-first** | AC1 measured the opposite on the current code. `grep -rn "x1e\|x1f\|\\\\u001e" test/` → 0 hits: no test anywhere puts either character in a commit. |
| 3 — the reason text is preserved | **red-first** | Measured above: the real entry's reason came back `"real reason"`, truncated at the `0x1e`. |
| 4 — the TSDoc states a true guarantee | **characterization for the fact it rests on**, documentation for the prose | The prose is not testable. The *fact* — git refuses a NUL in a commit message — pre-exists this task, so its test pins behaviour that already holds and passes on first run. Recorded as characterization deliberately: fabricating a red for it would mean writing a test that asserts git is broken. |
| 5 — a test pins the forgery itself | **red-first** | Same evidence as AC2; this AC is the requirement that the pin exists, AC2 is what it asserts. |
| 6 — sweep the other control characters | **characterization** (`0x00`, `0x0a`, `0x0d`, other C0/C1) | Each row of the sweep table records behaviour that already holds; the tests written for them pass on first run against the *fixed* code and assert a property, not a fix. `0x1f` is the exception and is red-first, counted under AC2. |
| 7 — `dl-067` not weakened | **characterization** | The whole of `test/memory/reason-trailer.test.ts`, `test/core/reason-trailer-verbs.test.ts` and `test/memory/commit-message.test.ts` must keep passing **unchanged** — that is the assertion. Plus one explicit case pinning that `reasonDefect` still returns `null` for a `0x1e`-bearing reason, i.e. that clause 4 was not widened behind the approver's back. |
| 8 — gates | **process** | Run at `refactor`/`review`. |

**Gate state:** `frontmatter.required` (title, scope) satisfied; `depends_on.acknowledged` satisfied
(task-072 above); `tech-spec.approved` — no new or amended spec, so nothing pending. `design` passes
through, no approver gate (no spec was scaffolded).

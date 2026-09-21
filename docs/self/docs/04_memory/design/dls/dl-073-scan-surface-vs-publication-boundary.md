---
id: "dl-073-scan-surface-vs-publication-boundary"
type: decision-log
title: "Our secret scan and the real publication boundary do not coincide: REQ-SEC-08 can be fully satisfied while the repository is unpushable"
status: in-discussion
context: "ad-hoc"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`spec-007-secret-hygiene-patterns` §1 scopes the scan to the project's **declared surface roots**.
`test/` is outside it, by design. GitHub's push protection scans **everything pushed**. Those two
surfaces are not the same shape, and on 2026-09-21 the gap became concrete: the tool reported a clean
repository while GitHub refused the repository's first push, over a test fixture whose entire purpose
is to be secret-shaped.

That is not a bug in the scanner and not a bug in push protection. It is a boundary the project has
never decided where to draw. `REQ-SEC-08`'s fit criterion — "a scan of committed `.wingfoil/` content
matches **0** known secret patterns" — is satisfied. The repository was still unpushable. So a clean
scan does not mean "safe to publish", and nothing anywhere says so.

The immediate instance is filed as
`bug-055-secret-scan-fixture-literal-blocks-push-protection` (`open`, `medium`). This DL is the
boundary question that instance raises, deliberately kept separate: fixing the fixture removes this
occurrence; it does not decide what our scan is *for*.

### Measured evidence

Measured 2026-09-21 on `main` at `ba2cad0`, against a build in a clean worktree (`npm ci` +
`npm run build`, exit 0).

**E1 — the declared surface, in the spec and in the code.** `spec-007` §1:

> The secret-hygiene scan (hereafter "the scan") walks every **text file** tracked or staged under:
> - `.wingfoil/` (repo-root, once `init` exists) …
> - `docs/self/.wingfoil/` and `docs/self/docs/04_memory/` …

```
$ grep -n "SCAN_SURFACE_ROOTS" src/validation/secret-scan.ts
306:export const SCAN_SURFACE_ROOTS = ['.wingfoil', 'docs/self/.wingfoil', 'docs/self/docs/04_memory'] as const;
```

Three roots. `src/`, `test/`, `.github/`, `docs/01_vision/`, `docs/02_requirements/`,
`docs/03_backlog/`, `docs/05_plans/`, `package.json`, `README.md` — none of them is scanned.

**E2 — the divergence, in one measurement.** The same pattern set, run over the declared surface and
then over one unscanned file:

```
$ node -e 'const s=require("./dist/validation/secret-scan.js");
           const r=s.scanProjectSurface("/home/robypomper/Workspaces/WingFoil2");
           console.log("surface blocking:", r.blocking.length, "warnings:", (r.warnings||[]).length);
           const t=s.scanText(require("fs").readFileSync("test/validation/secret-scan.test.ts","utf-8"),
                              "test/validation/secret-scan.test.ts");
           console.log("that one file:", t.blocking.length, t.blocking.map(f=>f.patternId+"@"+f.line).slice(0,8));'
surface blocking: 0 warnings: 0
that one file: 24 [ 'private-key-pem@52', 'generic-api-key-assignment@57', 'aws-access-key-id@62',
                    'aws-secret-access-key@68', 'gcp-service-account-key@75', 'github-token@80',
                    'slack-token@85', 'jwt-like@92' ]
```

**Zero** findings on the declared surface. **Twenty-four** in a single tracked, pushed file, by our own
patterns, including the one GitHub blocked (`aws-secret-access-key@68`). The tool is not wrong; it was
never asked.

**E3 — REQ-SEC-08 is satisfied.** `docs/02_requirements/03_sard/05_security-compliance.md:92-93`:

> **Fit Criterion:** After `init`, the built-in `security` directive is present; a scan of committed
> `.wingfoil/` content matches **0** known secret patterns (e.g., API keys, private-key headers).

E2's first line is that criterion, met. Nothing in the requirement mentions publication, the remote, or
the tarball.

**E4 — the event.** The first push to `git@github.com:robypomper/wingfoil.git` was rejected with
`GH013 … Push cannot contain secrets`, naming `test/validation/secret-scan.test.ts` at lines 66 and 68
across five commits (`6e35188`, `79c3d94`, `9751d3c`, `6a3b02f`, `f0076f9`) as an "Amazon AWS Secret
Access Key". The approver cleared it through GitHub's allow-secret URL, creating a standing
allowlist exception. The per-commit line numbers were re-derived here and match exactly (66 in the
oldest, 68 in the other four — see `bug-055` step 2); the rejection and the allow themselves happened
on GitHub and are recorded as reported, not reproduced — no push was attempted from this session.

**E5 — the exclusion is deliberate and was recently reaffirmed.** `spec-007` §1's scope is not an
oversight: it names its roots and gives its reason (the config store is what REQ-SEC-08 is about). A
proposed bug about the ignore-list was dismissed earlier the same day on exactly that ground. That
dismissal is reported context rather than something this document can verify — a dismissed proposal
leaves no artefact by construction, and none was found in the repository, which is consistent with it.

**E6 — the publication boundary is not one boundary but three**, and they differ:

- **What git pushes:** everything tracked — `src/`, `test/`, `.github/`, all of `docs/`.
- **What npm publishes:** `files: ["dist", "README.md"]`. `test/` is not in the tarball, so this
  particular fixture never reaches npm at all.
- **What `spec-015` §5 / `task-061-publish-secrets` guard:** the publish path specifically.

So "the publication boundary" in this decision means **the git remote**, which is the widest of the
three and the only one that just failed.

## Decision

Three options, presented with a recommendation; the approver's choice is recorded in this document's
approve commit `Reason:`.

### (A) Follow the publication boundary — scan everything git tracks, with an ignore list

`SCAN_SURFACE_ROOTS` is replaced by "every tracked text file", with `.wingfoil/security-ignore`
(`DEFAULT_IGNORE_FILE`, already implemented) carrying the known fixtures.

*For:* it makes a clean scan mean what a user will assume it means. The mechanism already exists —
`matchesIgnoreGlob`/`loadIgnoreGlobs` are built and tested (`task-043`) — so this is a scope change,
not a new feature. It would have caught this before the push.

*Against:* it requires an ignore list whose entries are, by construction, "files we have decided
contain secret-shaped strings on purpose" — and an ignore list is exactly the artefact that goes stale
and starts hiding real findings. It changes REQ-SEC-08's meaning, so the requirement and `spec-007` §1
both need amending. And it will produce findings across `docs/` that nobody has looked at yet: E2
measured one file; the repository-wide number is **unknown** and should be measured before this option
is chosen, not after.

### (B) Require fixtures to be non-literal, by directive rule

Keep the surface as it is. Add a rule to the `security-secrets` directive (and/or `testing`): a test
that proves a secret pattern must construct its fixture at runtime, never as a source literal.

*For:* it attacks the cause rather than the symptom. The fixtures are the only known population of
deliberate secret-shaped literals in the repository, and making them non-literal removes them from
*every* scanner's view — GitHub's, a future mirror's, an employer's DLP tool's — not just from ours. It
needs no spec change to REQ-SEC-08 and no ignore list. `bug-055` verifies the technique preserves the
test exactly (the built string is `===` the literal, and the assertion still passes).

*Against:* it is a directive, i.e. prose, and the project's own `spec-007` Context argues that "a
directive is prose, not a checkable artefact". Nothing enforces it; the next contributor writing a new
pattern test will paste a literal, and no gate will say so — unless the rule is paired with a check,
at which point it needs a surface to check over, which is option (A). It also does nothing about
secret-shaped strings that are not test fixtures, wherever those may be (unmeasured — see (A)'s
against).

### (C) Accept the divergence and document it — **recommended as the immediate step, not as the end state**

State plainly, in `spec-007` §1 and in the `security-secrets` directive, that the scan covers the
**configuration store** and is not a pre-publication check; that a clean scan is not a statement about
what a remote's push protection will accept; and that publishing is guarded separately
(`spec-015` §5 / `task-061`).

*For:* it is true today, costs one paragraph in each of two documents, and closes the actual harm this
event exposed — which was not the blocked push (that is recoverable and was recovered) but the
**false confidence**: a green scan that a reader could reasonably read as "safe to push". Nothing in
(A) or (B) is blocked by doing this first.

*Against:* documenting a gap is not closing it. On its own it leaves the next fixture, the next
detector and the next remote to find the boundary again the hard way.

### Recommendation

**(C) now, (B) next, (A) only if measured.** They are not exclusive and the ordering matters:

1. **(C)** immediately — it is a documentation change that makes an existing false impression go away,
   and it is a prerequisite for the others being understood.
2. **(B)** as the substantive fix, carried by `bug-055`'s fix task, because it removes the literals
   from every scanner's view rather than teaching one scanner to ignore them.
3. **(A)** only after someone measures what a repository-wide scan actually reports. If the answer is
   "24 findings, all in one fixture file", (A) is cheap and (B) makes its ignore list nearly empty. If
   it is "hundreds across `docs/`", (A) is a project of its own and the ignore list becomes the
   liability its critics describe. **That number is not known**, and choosing (A) without it would be
   choosing blind.

### Sub-questions to settle with the main option

- **S1 — what a clean scan is allowed to claim.** If (C), the wording matters: "0 findings on the
  configuration store" is honest; "no secrets in this repository" is not. *Recommendation:* the
  narrow claim, stated in both `spec-007` §1 and the directive.
- **S2 — does REQ-SEC-08 change?** Under (C) and (B), no — the requirement is about `.wingfoil/`
  content and stays satisfied. Under (A), yes, and so does `spec-007` §1.
  *Recommendation:* leave REQ-SEC-08 alone unless (A) is chosen.
- **S3 — the standing GitHub exception.** It exists now and is load-bearing for any fresh push of full
  history (the five historical commits cannot be rewritten — `dl-035`). Should it be recorded
  somewhere in-repo, so it is not discovered later as an unexplained allowance?
  *Recommendation:* yes — one line in the `security-secrets` directive or `bug-055`'s resolution,
  naming the detection, the file and why.
- **S4 — measure before deciding (A).** *Recommendation:* run the pattern set over every tracked text
  file once and record the number in this document before (A) is voted on.

## Rationale

The harm this event actually caused is the one worth fixing first, and it is not the blocked push. It
is that the project's own tool said *clean* about a repository that could not be published, and no
artefact anywhere told the operator that those are different questions. `REQ-SEC-08` is satisfied (E3),
the scanner is correct (E2's first line), `spec-007` §1 is being obeyed (E1) — and the outcome was a
rejected push and a permanent third-party security exception. When every component is behaving as
specified and the result is still wrong, the specification of the boundary is what is missing, which
is why (C) comes first and is a documentation change rather than code.

(B) is recommended over (A) as the substantive fix on a generality argument: a literal that no scanner
can see is safe from *every* scanner, whereas widening our surface only teaches *our* scanner about
*our* fixtures — and the thing that actually blocked the push was not our scanner. `bug-055` verifies
the technique costs the tests nothing.

(A) is recommended against **only on the evidence available**, which is the honest position: its
decisive cost is the size and staleness of the ignore list, and nobody has measured what that list
would contain (S4). If the measurement comes back small, (A) becomes cheap and this recommendation
should be revisited rather than defended.

## Actions

1. **Owner `approver`: choose the ordering**, and settle S1–S4.
2. **(C), if chosen:** amend `spec-007` §1 with an explicit scope statement (the scan covers the
   configuration store; it is not a pre-publication check; publication is guarded by `spec-015` §5),
   and add the matching sentence to the `security-secrets` directive. `spec-007` is `approved`, so per
   `dl-047-tech-specs-carry-no-version-field` this is a dated Revision note plus re-ratification.
3. **(B), if chosen:** add the fixture rule to `security-secrets` (and cross-reference it from
   `testing`), and hand it to `bug-055-secret-scan-fixture-literal-blocks-push-protection`'s fix task
   so the rule and its first application land together.
4. **S4, before (A) is voted on:** measure the pattern set over every tracked text file and record the
   figure here as a dated amendment.
5. **S3:** record the standing GitHub allowlist exception in-repo, wherever (2) or (3) lands.

## Relations

- **Occasioned by:** `bug-055-secret-scan-fixture-literal-blocks-push-protection` (`open`, `medium` —
  the instance; fixing it does not decide this boundary, which is why they are separate).
- **Amends (depending on outcome):** `spec-007-secret-hygiene-patterns` §1 (`approved`); the
  `security-secrets` custom directive; REQ-SEC-08 **only** under option (A).
- **Constrained by:** REQ-SEC-08 (the fit criterion that is satisfied while the repository is
  unpushable), `dl-035-task-branch-sync-with-main` (`ready` — why the five historical commits stay as
  they are, which is why the GitHub exception is permanent),
  `dl-036-secret-scan-warn-severity-vs-req-sec-08` (`ready` — the *other* gap between REQ-SEC-08's
  wording and what the gate enforces; this is a scope gap, that is a severity gap, and neither fixes
  the other).
- **Adjacent:** `bug-037-dotenv-secret-pattern-misses-prefixed-lines` and
  `bug-038-init-skips-secret-scan-of-builtin-templates` (both about what the scan *misses* inside its
  surface; this is about the surface itself), `task-043-secret-credential-hygiene` (built
  `scanProjectSurface`, the ignore-glob mechanism option (A) would need, and the fixtures),
  `task-061-publish-secrets` (`spec-015` §5 — the publish-path guard, i.e. the third boundary in E6),
  `adr-009-npm-publishing-pipeline`, `spec-015-packaging-publishing`,
  `dl-056-first-real-publishing-run`, `dl-057-publish-pipeline-hardening`,
  `dl-068-publishing-requires-public-repository` (the other decision about what publishing to a public
  remote entails).
- **Traceability:** REQ-SEC-08 (secret/credential hygiene), REQ-SEC-10 (built-in template integrity —
  the scan's other caller), P3.8 (built-in Security directive).

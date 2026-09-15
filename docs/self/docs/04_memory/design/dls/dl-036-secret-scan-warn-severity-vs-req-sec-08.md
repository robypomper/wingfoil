---
id: "dl-036-secret-scan-warn-severity-vs-req-sec-08"
type: decision-log
title: "Three of spec-007's ten patterns can only warn, so REQ-SEC-08's 'matches 0 known secret patterns' is not what the gate enforces"
status: in-discussion
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

**REQ-SEC-08**'s Fit Criterion says a scan of committed `.wingfoil/` content **"matches 0 known secret
patterns"**. **`spec-007-secret-hygiene-patterns`** §4 step 6 defines the gate differently:

> `blocking.length === 0` is required for the caller to proceed; `warnings` are always returned for
> display regardless of outcome

and §2 marks three of its ten patterns `severity: warn` — `jwt-like`,
`generic-high-entropy-string`, `dotenv-style-secret-line`. A `warn` finding is *a known secret pattern
that matched*, and it does not fail the scan.

The practical consequence, in the reviewer's words: **a genuinely leaked JWT, or a real
`NPM_TOKEN=<value>` dotenv line committed into a memory document, would pass the gate green.** Today
the repository has zero warnings, so nothing is currently slipping through — the gap is in what the
gate *guarantees*, not in what it has missed.

`task-043-secret-credential-hygiene` implemented spec-007 faithfully and deliberately did **not**
assert `warnings.length === 0` in its Fit-Criterion test, on the grounds that asserting it would
contradict the approved spec. That was the right call under the `traceability` directive — a task does
not fork the canonical table — and it is why this lands here instead of being quietly fixed in code.

## Decision

Three shapes are available; this DL asks the approver to pick one.

1. **Promote on review.** Keep the two-severity model, but treat the three `warn` patterns as
   *blocking on the committed surface specifically* — the surface is small, curated and
   author-controlled, so a high-entropy string or a dotenv line appearing there is far more likely to
   be real than in general-purpose code. Preserves the `warn` severity for other consumers.
2. **Add a `--strict` mode** in which any finding of any severity blocks, and make the REQ-SEC-08
   gate use it. Leaves the default behaviour untouched, at the cost of two behaviours to reason about.
3. **Amend REQ-SEC-08** to say what spec-007 actually enforces — "matches 0 blocking secret patterns,
   with warnings surfaced for review" — accepting the weaker guarantee deliberately rather than by
   drift.

**Recommended: option 1, decided per-pattern — promote two of the three, not all three.** The three
are not equivalent on *this* surface, which `git ls-files` shows is 169 Markdown files and 26 YAML
files — authored documentation, not source code:

| Pattern | Regex trigger | False-positive risk on a docs surface | Recommendation |
|---|---|---|---|
| `jwt-like` | literal `eyJ` prefix + three dot-separated base64url segments | **Very low** — a match essentially requires someone to write a JWT-shaped string | **Promote to `block`** |
| `dotenv-style-secret-line` | line-anchored `[A-Z_]*(SECRET\|TOKEN\|PASSWORD\|API_KEY\|PRIVATE_KEY)[A-Z_]*=<value>` | **Moderate, and concentrated** — a fenced `.env` example in a document about publishing is the likely tripper, and `task-061-publish-secrets` will write exactly that | **Promote to `block`, but only together with making §3's escape hatch discoverable** |
| `generic-high-entropy-string` | `(auth\|credential\|bearer)\s*[:=]\s*<24+ chars of `[A-Za-z0-9_\-/+=]`>` | **Real** — the value alphabet includes `/` and `-`, so an ordinary long path or identifier after an `auth:` key matches | **Leave at `warn`** |

This closes both concrete leak scenarios the review named — a genuinely leaked JWT, and a real
`NPM_TOKEN=<value>` line in a memory document — while leaving at `warn` the one pattern whose trigger
is loose enough to fire on prose.

Not a candidate: making all ten patterns `block`. §2's severity split exists because the three `warn`
patterns are the entropy- and shape-based ones with genuine false-positive rates; `task-043`'s first
review catalogued several (a path assigned to a `token` variable, `const secret =
getSecretFromEnvironment()`). Promoting them wholesale would make the gate unusable and it would get
disabled, which is the worst outcome.

## Rationale

- The two documents disagree about what the requirement guarantees, and the disagreement is invisible
  from either one alone. That is the class of gap this project keeps paying for.
- **The three patterns are not equivalent in risk.** `dotenv-style-secret-line` and `jwt-like` have
  recognisable structure and low false-positive rates on a curated documentation surface;
  `generic-high-entropy-string` is the one that would genuinely misfire. A per-pattern decision may
  beat a blanket one, which is an argument for option 1 over option 2.
- Option 3 is honest but weakens a security requirement to match an implementation, which inverts the
  project's authority order (CLAUDE.md §10.1). It should only win if the approver concludes the
  warn-level patterns cannot be made precise enough to block on.
- **Related and worth settling together:** `spec-007` §3's escape hatches (fence markers, placeholder
  values, a `.wingfoil/security-ignore` glob list) are implemented, but **no `security-ignore` file
  exists in the repository**, so the first author to trip a false positive has to discover the hatch
  from the spec. Whichever option is chosen, promoting patterns to blocking raises the odds of that
  happening — so seeding the file, or at least documenting the hatch where authors will meet it,
  belongs in the same change.

## Actions

- Owner **approver**: choose option 1, 2 or 3; if 1, decide per-pattern rather than for all three.
- If 1 or 2: amend `spec-007` §2/§4 (new spec version per the doc-versioning directive) and widen
  `task-043`'s Fit-Criterion test to assert the newly-blocking set.
- If 3: amend REQ-SEC-08's Fit Criterion.
- Any option: seed `.wingfoil/security-ignore` or document the §3 escape hatch where an author writing
  a memory document will encounter it.
- Related: `bug-015-scan-reads-worktree-not-index` (the same scanner, a different defect).

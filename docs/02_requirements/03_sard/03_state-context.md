# SARD — Part 3: State & Context Management (NFR)

**ID prefix:** `REQ-STATE-*`
**Derivation:** how information, directives, and state persist and pass between components, per the BDD suite.

---

## 3. Non-Functional Requirements — State & Context

### REQ-STATE-01 — Frontmatter-based lifecycle, validated per type

* **Description:** Each deliverable's state lives in its Memory frontmatter; every transition is validated against the
  element type's state machine.
* **Rationale:** State close to the deliverable; illegal lifecycle moves blocked.
* **Fit Criterion:** A transition not permitted by the type's `sequence`/`gates`/`waiting` state machine
  (`spec-001-memory-yaml-schema`) is rejected with `"illegal transition <from> -> <to> for type '<type>'"` and
  leaves the state unchanged. Per `dl-032-illegal-transition-message-contract` (option c) that string is the
  message; any explanatory text (e.g. "a `gates` state — its forward edge requires `approve`, not `submit`")
  rides as the issue's detail rather than replacing it. The exit code is **`1`**, per BDD P1.6 and
  REQ-INT-04 (an illegal transition is a logic error, not a usage/argument error); `spec-009` §3 has been
  rewritten to key exit codes on the nature of the failure rather than on the detecting pass.
* **Traceability:** Feature P1.6 (US-3-09, BDD `p1-memory/P1.6-memory-submit.feature`); Feature P4.11 (US-4-08,
  BDD `p4-workflow/P4.11-deliverables.feature`); Feature P4.13 (US-1-02, BDD `p4-workflow/P4.13-state-deduction.feature`).

### REQ-STATE-02 — State recomputability (no index)

* **Description:** Project/workflow state is recomputable purely from Memory files at a given commit.
* **Rationale:** Single source of truth (see REQ-SYS-03).
* **Fit Criterion:** Recomputing state from files for a fixed commit equals any previously cached state; no
  `.wingfoil/state/` artifact is required for correctness.
* **Traceability:** Feature P4.13 (US-1-02, BDD `p4-workflow/P4.13-state-deduction.feature`).

### REQ-STATE-03 — Active workflow context with multiple open mains

* **Description:** `workflow start` sets the active context; multiple main workflows may be open; commands target the
  last started unless `--name` is given; `end` clears or restores context.
* **Rationale:** Real teams interleave workflows (e.g., a bug report during a release cycle).
* **Fit Criterion:** With two mains open, a command without `--name` targets the last started; `workflow end --name X`
  closes X and restores the previously active workflow (P4.2/P4.3 scenarios pass).
* **Traceability:** Feature P4.2 (US-0A-16, BDD `p4-workflow/P4.2-workflow-start.feature`); Feature P4.3 (US-0A-17,
  BDD `p4-workflow/P4.3-workflow-end.feature`).

### REQ-STATE-04 — Atomic step execution

* **Description:** A workflow step's actions execute atomically: on failure, no partial side effects remain.
* **Rationale:** Prevent half-applied git/state operations.
* **Fit Criterion:** When an action fails (e.g., `git.merge` conflict), the working tree is left clean and the step is
  marked `failed`; a multi-action step stops at the first failing action.
* **Traceability:** Feature P4.10 (US-0A-20, BDD `p4-workflow/P4.10-workflow-steps.feature`).

### REQ-STATE-05 — Role- and task-scoped context passing

* **Description:** The execution context passed to an agent contains only the directives for its role and the Memory
  relevant to its task, as distinct addressable sections.
* **Rationale:** Crisp, low-noise context; determinism.
* **Fit Criterion:** The assembled context object exposes separate `dna`, `memory`, `directives` sections; it contains
  100% of the role's assigned directives and 0 directives of other roles.
* **Traceability:** Feature P5.4.3 (US-1-04, BDD `p5-interaction/P5.4.3-context-preloading.feature`); Feature P5.4.4
  (US-1-05, BDD `p5-interaction/P5.4.4-execution-context.feature`); Feature P3.6 (US-3-06,
  BDD `p3-directives/P3.6-auto-load-by-role.feature`).

### REQ-STATE-06 — Archived content excluded from context

* **Description:** Documents in an archived state — `deprecated` on any type, and `superseded` on `adr`/`tech-spec` —
  remain in the repo but are excluded from agent context and default searches.
* **Rationale:** Distinguish active from archived decisions.
* **Fit Criterion:** A `deprecated` or `superseded` document never appears in an assembled agent context nor in default
  `memory search` results, while remaining present on disk and in git history.
* **Traceability:** Feature P1.9 (US-5-04, BDD `p1-memory/P1.9-memory-deprecate.feature`); Feature P5.3.3 (US-1-10,
  BDD `p5-interaction/P5.3.3-relevance-filtering.feature`). Archived set ratified by
  `dl-028-archived-states-excluded-from-context`.

### REQ-STATE-07 — Iteration state for include() composition

* **Description:** An `include()` with `iterate_over: <type>` and optional `where` filters runs the sub once per
  matching element.
* **Rationale:** Drive per-element sub-workflows (e.g., TDD loop per backlog task).
* **Fit Criterion:** Given N elements matching the `where` filter, the included sub executes exactly N times; given 0
  matches, it executes 0 times and the phase completes with a "no elements matched" note.
* **Traceability:** Feature P4.16 (US-6-04, BDD `p4-workflow/P4.16-include-composition.feature`).

### REQ-STATE-08 — Default state-machine fallback

* **Description:** A Memory type that does not declare its own `states` uses the default machine
  `draft → pending → approved/rejected → deprecated`.
* **Rationale:** Reduce config friction for simple types.
* **Fit Criterion:** A type defined without a `states` block accepts exactly the default transitions and rejects any
  transition outside them.
* **Traceability:** Feature P1.13 (US-0A-04, BDD `p1-memory/P1.13-memory-element-schema.feature`).

### REQ-STATE-09 — Context assembly determinism

* **Description:** Context assembly is deterministic for unchanged inputs: the same `(task, role, project-commit)` tuple
  always produces the same assembled context, independent of incidental on-disk ordering.
* **Rationale:** Supports REQ-SYS-07 (North Star); this requirement scopes the determinism guarantee specifically to the
  context-assembly path.
* **Fit Criterion:** Assembling the execution context twice for the same `(task, role, project-commit)` tuple yields
  byte-for-byte identical output across ≥ 2 runs; shuffling the on-disk order of unrelated Memory files does not change
  the assembled output. (Path-scoped specialization of REQ-SYS-07.)
* **Traceability:** Feature P5.4.4 (US-1-05, BDD `p5-interaction/P5.4.4-execution-context.feature`).

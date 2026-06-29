# User Story Map — AI Session Launch with Full Context

**Backbone:** Session launch, fetch next task, launch agent with pre-loaded context (< 30s)
**Origin Journey:** `05_journeys.md` → Journey 1 (Alex: "Start a New AI Session with Full Context")
**Primary Persona:** Alex (solo dev)

> Tag: **[MVP · vX]** = MVP delivery release · **[Future]** = post-MVP. See [00_index.md](00_index.md).

---

## Backbone: AI session with context

### Step 1 — Alex reviews next workflow task

* **[MVP · v0.3]** US-1-01: As Alex, I want to see the next step of the active workflow with `wingfoil workflow next`,
  with its element, role directives, and instructions, so that I know what to do without re-reading specs. _(feat: P4.4)_
* **[MVP · v0.3]** US-1-02: As the system, I want to infer workflow state from Memory file existence and their
  frontmatter (validated against type state machine) so that I don't need a separate state index file. _(feat: P4.13)_

### Step 2 — Launch agent on next task with full context

* **[MVP · v0.3]** US-1-03: As Alex, I want to launch the agent on the next task with `wingfoil agent execute --next`,
  resolving role and target element from current step, so that I start it with pre-loaded context. _(feat: P5.3.1)_
* **[MVP · v0.3]** US-1-04: As the agent, I want DNA, Memory, and directives automatically retrieved based on role and
  task so that I initialize with full context without manual requests. _(feat: P5.4.3)_
* **[MVP · v0.3]** US-1-05: As the agent, I want to receive structured execution context (DNA + Memory + Directives) at
  task start so that I operate deterministically. _(feat: P5.4.4)_

### Step 3 — Agent auto-loads role directives and prompts

* **[MVP · v0.2]** US-1-06: As the agent, I want to auto-load role-specific directives and instruction templates via MCP
  Prompts at session start so that I know task rules and instructions. _(feat: P5.2.2)_

### Step 4 — Agent queries DNA + Memory

* **[MVP · v0.1]** US-1-07: As the agent, I want to efficiently retrieve DNA entries and Memory documents (read-only)
  via MCP Resources so that I have pre-loaded project context. _(feat: P5.2.1)_
* **[MVP · v0.1]** US-1-08: As Alex, I want to query Memory by keywords and metadata with `wingfoil memory search` so that I
  quickly find relevant decisions. _(feat: P1.5)_
* **[MVP · v0.1]** US-1-09: As Alex, I want to find relevant documents via keyword and metadata matching so that I retrieve
  content without scanning everything. _(feat: P1.12)_
* **[MVP · v0.3]** US-1-10: As the agent, I want to load only relevant Memory documents (relevance filtering) so that I avoid
  noise and context window exhaustion. _(feat: P5.3.3)_

#### Edge cases (interruption / exception handling)

* **[MVP · v0.3]** US-1-E1: As Alex, I want deprecated and superseded Memory documents excluded from agent context
  retrieval by default so that stale or historical decisions never pollute the working context. _(edge: Journey 1 —
  stale/irrelevant context)_
* **[MVP · v0.3]** US-1-E2: As the agent, I want a bounded context budget that drops the lowest-relevance documents when
  Memory is large so that I never exhaust the context window on noisy retrieval. _(edge: Journey 1 — context overflow)_

### Step 5 — Agent executes task with full context

* **[MVP · v0.3]** US-1-11: As Alex, I want agent output and commits to be consistent with previous decisions and
  conventions so that I can review and approve results without re-explaining. _(ref: P5.3.1, P5.4.4)_

### Future (Post-MVP)

* **[Future]** US-1-F1: As Alex, I want semantic Memory search (NLP) so that I find decisions even without exact keywords. _(
  Post-MVP: Semantic Memory search)_
* **[Future]** US-1-F2: As Alex, I want native IDE plugins so that I access WingFoil context without CLI/MCP. _(Post-MVP: IDE
  plugins)_
* **[Future]** US-1-F3: As Alex, I want Memory document tagging and relationships so that I navigate connected decisions. _(
  Post-MVP: Memory tagging & relationships)_
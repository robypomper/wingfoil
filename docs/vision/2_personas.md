# Personas — WingFoil

**Version:** 1.0
**Date:** 2026-06-15
**Status:** Pending

---

## Persona 1 — Alex, the Solo Developer

> *"I'm the only one who knows what this codebase is supposed to do — including the AI."*

- **Profile:** Full-stack developer, works alone on side projects or freelance. Uses Claude Code or Cursor as daily
  driver. Manages everything: architecture, code, deploy, docs.
- **AI usage level:** Writing → Planning → Review
- **Pain:** Every new AI session starts from scratch. The agent re-discovers conventions already established, makes
  decisions already made, drifts from the original intent. Alex re-explains context constantly.
- **Goals with WingFoil:**
    - Load the agent with relevant project info in seconds (not the entire codebase)
    - Stop re-explaining decisions
    - Keep the codebase consistent across sessions
    - Know what to do next without re-reading specs (`wingfoil workflow next`)

---

## Persona 2 — Sam, the Code Reviewer

> *"I want to review code faster with AI help, but I need confidence that quality standards are being enforced."*

- **Profile:** Developer on a team of 3–8, beginning to adopt AI tools. Currently uses AI agents only for code review,
  quality checks, and documentation review — not yet for writing code.
- **AI usage level:** Review → Planning (gradually expanding)
- **Pain:** Limited confidence in AI for development tasks yet; concerns about quality and team fit. Limited visibility
  into what conventions apply during reviews. Reviews are manual, slow, and inconsistent with team standards.
- **Goals with WingFoil:**
    - Launch AI review agent with clear team directives and quality standards
    - See what submissions are pending review without digging through PRs
    - Validate agent output quickly against documented conventions
    - Gradually build confidence in AI for other tasks (writing, planning)
    - Keep review decisions auditable and traceable to team standards

---

## Persona 3 — Jordan, the Team Developer

> *"I want to know what rules I'm supposed to follow and get my agent to respect them automatically."*

- **Profile:** Mid-level developer on a team of 3–8, directed by a tech lead (like Morgan). Uses AI agents daily for
  code writing and exploration.
- **AI usage level:** Writing → Review
- **Pain:** Doesn't know what conventions Morgan has defined; agents ignore team rules without reminders. Hard to sync
  on what's been decided, what conventions apply, and where the project stands. Constantly asks "Is this the right
  approach?"
- **Goals with WingFoil:**
    - Follow team directives automatically without re-reading them every session
    - Know what task to work on next from team workflow
    - Get agent to respect team rules without manual instructions
    - Stay aligned with team context and decisions
    - Submit work that's aligned with team standards the first time

---

## Persona 4 — Morgan, the Tech Lead

> *"I need to know that agents are working within the rules we've set, not inventing new ones."*

- **Profile:** Senior developer leading a team of 2–6. Sets architecture decisions, reviews PRs, defines conventions.
  The team (humans + agents) works in parallel streams.
- **AI usage level:** Review → Planning
- **Pain:** Agents don't respect established conventions unless explicitly reminded. Decisions made in one session don't
  propagate. Governance is manual and leaky.
- **Goals with WingFoil:**
    - Encode the team's rules once and have them enforced automatically
    - Know when an agent or developer is working outside the guardrails
    - Get notified when a human decision is required
    - Define team workflow once; have agents and humans follow it consistently

---

## Persona 5 — Casey, the Non-Technical Manager

> *"I need visibility into the development process without being in every decision."*

- **Profile:** Product manager, team lead, or stakeholder. Does not write code. Cares about delivery, quality, and team
  velocity. Works with one or more technical leads who handle the details.
- **AI usage level:** Review (agents' outputs), Planning (project roadmap, specs)
- **Pain:** Unclear what's been decided, what the process is, what risks exist. Relies entirely on secondhand
  information from technical leads. Can't tell if an agent's output is correct or aligned with intent.
- **Goals with WingFoil:**
    - Understand project decisions and methodology at a glance
    - Get notified when alignment/review is needed
    - See a clear audit trail of what was decided and why
    - See workflow state and identify bottlenecks (e.g., pending approvals)

---

## Persona 6 — Taylor, the Architect (Future)

> *"I need to document what we've decided, and have both humans and agents reference it correctly."*

- **Profile:** Solutions architect or senior developer who designs systems and makes foundational decisions. Works with
  Morgan (Tech Lead) to codify architecture patterns.
- **AI usage level:** Planning → Review
- **Pain:** Architectural decisions get buried in Slack, old docs, or nowhere. Agents reinvent decisions. New team
  members don't know the principles.
- **Goals with WingFoil:**
    - Write architectural decisions once (ADR, RFC) and have them centrally queryable
    - Have agents reference architecture docs in their reasoning
    - Build a searchable knowledge base of design patterns and constraints

---

*Note: Taylor is defined for future reference. MVP focuses on Alex, Sam, Morgan, and Casey.*
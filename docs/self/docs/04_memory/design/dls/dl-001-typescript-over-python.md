---
id: dl-001-typescript-over-python
type: decision-log
title: "Reject Python; adopt TypeScript/Node.js for WingFoil implementation"
status: ready
context: "scope"
release: ""
tmpl_version: 260703
---

## Context

WingFoil's implementation language is foundational to distribution strategy, SDK ecosystem maturity, and determinism enforcement. The decision affects CLI tooling, agent integration, validation rigor, and contributor accessibility.

Viable candidates evaluated: **Python**, Go, Rust, and TypeScript/Node.js.

## Decision

Adopt **TypeScript** with **Node.js 18+** runtime and **npm** package distribution (recorded in `dna.yaml` `tech_stack`). Explicitly exclude Python (and Go, Rust) as the implementation platform.

## Rationale

**TypeScript/Node.js wins on three dimensions:**

1. **Single-language coherence across all pillars.** The CLI (Commander.js + chalk), MCP server (Anthropic SDK over stdio), and workflow engine all run in the same language (TypeScript). This eliminates cross-language integration friction, simplifies deterministic behavior (single runtime, single type system), and makes the codebase more maintainable for a solo developer (Roberto) supported by AI agents. Modules (`core`, `storage`, `memory`, `dna`, `directives`, `workflow`, `cli`, `mcp-server`) can share code and types without serialization or RPC overhead.

2. **First-class MCP and Anthropic SDK support.** The Model Context Protocol and Anthropic SDK are mature in TypeScript/Node.js and actively maintained. This ensures WingFoil can expose MCP Resources, Prompts, and Tools with minimal impedance, and receive agent directives reliably. Python's MCP support lags; Python is not a primary target for Anthropic SDK investment.

3. **Determinism via static types and Zod validation.** TypeScript's static type system, paired with Zod validation at I/O boundaries, enforces structural correctness at compile and runtime. This directly supports the **Determinism North Star** (REQ-SYS-07): two independent runs from the same specs + WingFoil config using different agents must produce substantially equivalent software. Explicit schema validation (Zod) makes context building auditable and repeatable; implicit duck typing (Python) introduces silent failures and divergent behavior across runs.

4. **npm distribution for target audience.** WingFoil's users (Alex, Jordan, Morgan, Casey) are already embedded in the JavaScript/Node.js ecosystem or immediately adjacent (web developers, CLI tool users). npm is the standard distribution channel for this audience; PyPI adds friction. Semantic versioning and rapid iteration cycles benefit from npm's maturity.

**Why Python is rejected:** Python is a natural fit for data science, ML pipelines, and scripting, but WingFoil's domain is *deterministic configuration management and workflow orchestration*—it does not require Python's numerical computing or data wrangling strengths. Python introduces distribution friction (PyPI fragmentation, virtual environment management across teams), weaker MCP maturity, and forces developers to toggle between Python for WingFoil and TypeScript/JavaScript for agent integration—undermining the single-language principle. Go and Rust offer performance gains but sacrifice developer accessibility (learning curve, toolchain complexity) and provide no MCP/Anthropic SDK advantage; WingFoil is I/O and configuration-bound, not CPU-bound.

The decision is recorded in `dna.yaml` (`tech_stack: {language: TypeScript, runtime: Node.js 18+, package_manager: npm}`) and linked to ADR-005 (the architectural decision itself).

> **Correction (2026-09-21) — the runtime clause reads Node.js 22.12+, not Node.js 18+.**
> `adr-010-node-22-runtime-floor` (`accepted`, `0627290`) sets WingFoil's supported runtime floor to
> **Node.js 22.12 or later**, measured from the production dependency closure: of 58 packages
> declaring `engines.node`, two exceed `>=18.0.0` — `commander@15` at `>=22.12.0` and
> `@hono/node-server@1.19.14` at `>=18.14.1` — so `18+` was false by two packages. Wherever this
> document says "Node.js 18+" — the Decision sentence above, and the closing `dna.yaml` quotation —
> read **Node.js 22.12+**. The `tech_stack:` quotation is doubly historical: `dna.yaml` has since
> moved that content to `stacks.technologies`, whose `version:` the next item of adr-010's cascade
> corrects to `"22.12+"`.
>
> **The substantive decision is unchanged and still holds.** What this document decides is
> TypeScript over Python, Go and Rust, and npm over PyPI; all four rationale points stand on
> single-language coherence, MCP/SDK maturity, static types + Zod, and the audience's ecosystem —
> none of which depends on the runtime's minimum version. adr-010 supersedes only adr-005's runtime
> clause and explicitly re-affirms TypeScript, npm and semver, so this DL is **amended, not
> deprecated**: `status: ready` is correct and unchanged. Recorded as a dated note per `dl-047`
> (decision-log elements carry no `version:` field to bump), in the form `dl-051` uses.

---
id: dl-006-no-native-ide-plugin
type: decision-log
title: "No native IDE plugins in MVP—MCP-only approach"
status: in-discussion
context: "scope"
release: ""
tmpl_version: 260703
---

## Context

WingFoil's Interaction Layer (Pillar P5) requires an agent-integration surface to enable AI-assisted development workflows. The design team evaluated two primary approaches: native IDE plugins (VS Code, Cursor, JetBrains) versus MCP (Model Context Protocol) as the sole integration point.

The MVP timeline is aggressive—5 weeks from inception to v1.0 (August 7, 2026)—with a team of one developer supported by AI agents. This scope and schedule constraint necessitates prioritizing the highest-impact work with the clearest path to determinism.

## Decision

**No native IDE plugins will be shipped in the MVP (v0.1–v1.0).** MCP Server is the only agent-integration surface for the MVP. Native IDE plugin support is deferred to v1+ and will be tracked as a post-MVP enhancement.

## Rationale

### Scope & Timeline Efficiency

Native IDE plugins require:
- Separate codebases per IDE (VS Code, Cursor, JetBrains, Vim, Neovim, etc.)
- IDE-specific APIs, build tooling, and distribution channels (VS Code Marketplace, JetBrains Plugin Marketplace)
- Persistent GUI state management and synchronization with WingFoil backend
- QA and compatibility matrix across IDE versions

This work is orthogonal to the core five pillars and would consume 2–3 weeks of the aggressive 5-week MVP timeline without advancing the Determinism Index or core platform stability.

### MCP is Sufficient for MVP

The MCP Server provides:
- **Role-based context delivery** (P5.4.2): Agents receive curated Memory + DNA + Directives scoped to their role, eliminating the need for IDE UI to manage these concerns
- **Unified transport**: Works with Claude Code, Cursor (via Claude integration), and any future MCP-compatible IDE or agent
- **Tool-based workflow commands**: All state changes (memory.add, memory.submit, memory.approve, workflow actions) are exposed as MCP Tools, making IDE plugin UI largely unnecessary for MVP use cases
- **Read-only Resources**: Memory, DNA, Workflow state are queryable via MCP Resources; agents retrieve what they need on-demand without polling IDE UI state

Early adopters (solo developers like Alex, small teams) do not require IDE integration for v0.1–v1.0; they interact through CLI + MCP prompts. IDE plugins become valuable when:
- Teams scale (Jordan and Morgan personas benefit from visual workflow dashboards in their IDE)
- Non-technical stakeholders (Casey) need integrated progress visibility
- Real-time collaboration features are added (v1+)

### Determinism Argument

Determinism (the Determinism Index, WingFoil's North Star — REQ-SYS-07) requires that two independent runs from the same specs + WingFoil config produce substantially equivalent output. Native IDE plugins introduce platform-specific UI state (editor selections, panel layouts, keyboard shortcuts, plugin version) that is difficult to version or replay deterministically. MCP, by contrast, is protocol-level and independent of IDE implementation, making it easier to guarantee reproducible behavior across different agents and environments.

### Strategic Positioning

Deferring native plugins to v1+ allows WingFoil to:
1. **Validate the core platform** with early adopters who use CLI + MCP
2. **Establish determinism** without the complexity of IDE-specific state management
3. **Build plugin infrastructure later** from a stable core (after Pillar P5 is proven)
4. **Partner selectively** with IDE vendors (VS Code, Cursor, JetBrains) in v1+ on plugin distribution and UX co-design

---

## Actions

1. **Document MCP as the primary agent integration point** in P5 feature specifications and user journey documentation (Journeys 3–6 assume MCP availability, not IDE plugins).
2. **Create a post-MVP enhancement issue** tagged "v1.0+" for "native IDE plugin support" to surface this to future development planning.
3. **Add to product-brief Known Constraints** (already noted; confirm parity in docs/01_vision/01_product-brief.md §Known Constraints & Assumptions).

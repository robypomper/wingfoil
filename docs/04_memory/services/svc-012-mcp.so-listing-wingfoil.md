---
id: svc-012-mcp.so-listing-wingfoil
type: service
title: "mcp.so listing WingFoil"
status: pending
provider: "mcp.so"
kind: "listing"
owner_role: "approver"
verify: "gh api repos/chatmcp/mcpso/issues/comments/5898281792 --jq '.user.login, .created_at'; once the listing is published, search \"wingfoil\" on https://mcp.so"
url: "https://github.com/chatmcp/mcpso/issues/1#issuecomment-5898281792"
account: "robypomper (GitHub, author of the submission comment)"
renews: ""
repo_refs: []
decision: "dl-130-visibility-steps-in-the-release-flow"
set_up_in: "v0.2"
tmpl_version: 260929
---

## Purpose

A listing of WingFoil's MCP server on mcp.so, a directory of MCP servers that agent users browse. It is
one of the external listings `dl-130` counts as part of the project's visibility.

## Configuration

Submitted by the approver on 2026-09-29 through the **free route**: a comment in the issue
`chatmcp/mcpso#1`, posted at 2026-09-29T20:32:59Z. The paid option (39 USD to skip the review queue) was
declined. The listing is **waiting for review**.

The comment presents WingFoil with its repository, npm package, license (MIT), transport (stdio) and
language, and states what the server exposes: read-only Resources for DNA, Memory documents and
workflows, and one Prompt per role. It names no Tool, which matches the server as shipped (`tools/list`
answers `-32601`, `bug-151`). It gives the client configuration:
`{ "mcpServers": { "wingfoil": { "command": "npx", "args": ["-y", "wingfoil", "mcp"] } } }`.

## Verification

While the review is pending: `gh api repos/chatmcp/mcpso/issues/comments/5898281792 --jq '.user.login, .created_at'`
→ `robypomper`, `2026-09-29T20:32:59Z` (read by the agent on 2026-09-29). Once mcp.so publishes the
listing: search "wingfoil" on `https://mcp.so` and open the listing.

## Management

- **State:** this element stays `pending` until mcp.so publishes the listing. Approval (`active`) makes
  sense only when `verify` finds the listing; before that, `url` is replaced with the listing's URL.
- **Updates:** if the server's surface changes (Tools arrive with P5.2.3 in v0.4), the listing's
  description is updated on mcp.so and the change is recorded here.
- **Retirement:** `memory deprecate`, with a `Reason:` that says whether the listing was removed or
  replaced.

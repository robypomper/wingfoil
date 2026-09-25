#!/usr/bin/env bash
# Example 02 — declare a custom Memory type with its own state machine, then walk a document through it.
source "$(dirname "$0")/../lib.sh"
new_repo

step init --template Kanban
step dna add team.members --value "Ada Lovelace" --entry-email ada@example.com --entry-roles approver

# A `story` type: draft → ready (a gate: needs approve; reject goes back to draft) → in-progress → done.
cat >> .wingfoil/memory.yaml <<'YAML'
  story:
    path: docs/memory/story/{id}.md
    id_pattern: "story-{n}-{slug}"
    states:
      sequence: [ draft, ready, in-progress, done ]
      gates:
        ready: { reject: draft }
    template:
      file: memory/templates/story.md
      frontmatter:
        required: [id, type, title, status]
YAML
cat > .wingfoil/memory/templates/story.md <<'MD'
---
id: ""
type: story
title: ""
status: draft
---

<!-- As a <user>, I want <goal>, so that <benefit>. -->
MD

# Configuration is read as committed: adding a document of the new type before committing fails.
expect_exit 1 memory add --type story --title "Login page"
git add .wingfoil && git commit --quiet -m "chore(wingfoil): add the story Memory type"

step memory add --type story --title "Login page"
ID=story-001-login-page
step memory submit "$ID"                                  # draft → ready
expect_exit 1 memory submit "$ID"                         # ready is a gate: submit cannot pass it
step memory approve "$ID" --reason "Ready for the sprint." # ready → in-progress
step memory submit "$ID"                                  # in-progress → done

STATUS=$(json_field "$(wf memory search --type story --format json)" 'd.matches[0].status')
assert_eq "$STATUS" "done" "final status"
assert_clean
done_ok "custom type: draft → ready → in-progress → done"

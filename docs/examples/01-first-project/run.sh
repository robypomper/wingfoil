#!/usr/bin/env bash
# Example 01 — from `wingfoil init` to a first approved task, with its audit trail.
source "$(dirname "$0")/../lib.sh"
new_repo

step init --template Scrum
step dna set project.name --value "My Project"

# Approving needs the approver role: your git email must be a team member holding `approver`.
step dna add team.members --value "Ada Lovelace" --entry-email ada@example.com --entry-roles approver,developer

step memory add --type task --title "My first task" --tags demo,quickstart
ID=task-001-my-first-task

# Write the task's content, then submit: the submit commit carries the content and the state change.
printf '\nImplement the login form.\n' >> "docs/memory/task/$ID.md"

step memory submit "$ID"
step memory approve "$ID" --reason "Scope is clear."

HISTORY=$(wf memory history "$ID" --format json)
assert_eq "$(json_field "$HISTORY" 'd.entries.map(e=>e.operation).join(",")')" "add,submit,approve" "history operations"
assert_eq "$(json_field "$HISTORY" 'd.entries[2].approver')" "Ada Lovelace <ada@example.com> (approver)" "approver recorded"

FOUND=$(wf memory search first --format json)
assert_eq "$(json_field "$FOUND" 'd.matches[0].status')" "approved" "search result status"

printf '\n$ git log --oneline\n'; git log --oneline
assert_clean
done_ok "first project: init → add → submit → approve"

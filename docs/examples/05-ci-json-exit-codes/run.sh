#!/usr/bin/env bash
# Example 05 — script WingFoil in CI: machine-readable output and the 0/1/2 exit-code contract.
source "$(dirname "$0")/../lib.sh"
new_repo

step init --template Scrum --format json

expect_exit 0 memory search nothingmatches --format json   # no match is still success
expect_exit 1 memory submit task-999-nope --format json    # well-formed, cannot be done
assert_eq "$(json_field "$LAST_OUTPUT" 'd.error')" "document not found: task-999-nope" "json error object"
expect_exit 2 memory add --type task --format json         # the command line itself is wrong
expect_exit 2 frobnicate                                   # unknown command

# A CI gate: fail the build while any task is still waiting for approval.
wf memory add --type task --title "Pending work" --format json >/dev/null
wf memory submit task-001-pending-work --format json >/dev/null
PENDING=$(json_field "$(wf memory search --type task --status pending --format json)" 'd.matches.length')
printf '\npending tasks: %s\n' "$PENDING"
assert_eq "$PENDING" "1" "pending count"
# In a real pipeline: [ "$PENDING" -eq 0 ] || { echo "tasks awaiting approval"; exit 1; }

assert_clean
done_ok "CI: json output, exit codes 0/1/2, a pending-approval gate"

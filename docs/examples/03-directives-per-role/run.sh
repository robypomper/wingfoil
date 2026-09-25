#!/usr/bin/env bash
# Example 03 — write a custom directive, bind it to a role, read a role's rules, then retire it.
source "$(dirname "$0")/../lib.sh"
new_repo

step init --template Scrum
step directive create --name api-style
cat >> .wingfoil/directives/custom/api-style.md <<'MD'

- Every HTTP endpoint is versioned under `/v<n>/`.
- Errors are returned as `{ "error": { "code", "message" } }`.
MD
git commit --quiet -am "docs(directive): write the api-style rule"

step directive assign --directive api-style --role developer

IDS=$(json_field "$(wf directives list --role developer --format json)" 'd.entries.map(e=>e.frontmatter.id).join(",")')
printf '\ndeveloper directives: %s\n' "$IDS"
case ",$IDS," in *,api-style,*) ;; *) fail "api-style not listed for developer" ;; esac

# Built-in directives cannot be removed; an assigned directive cannot be removed either.
expect_exit 1 directive remove code-quality
expect_exit 1 directive remove api-style

# There is no unassign command: edit roles.yaml, commit, then remove.
sed -i.bak '/^    - api-style$/d' .wingfoil/roles.yaml && rm .wingfoil/roles.yaml.bak
git commit --quiet -am "chore(wingfoil): unassign api-style from developer"
step directive remove api-style

assert_clean
done_ok "directives: create → assign → list → unassign → remove"

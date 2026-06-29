Feature: P1.2 (US-0A-02) - Versioning & Audit Trail
  As Morgan, I want every change (Memory, DNA, Directives, Workflow) tracked via git
  with author, timestamp, and commit message so the audit trail is complete without
  manual effort.

  Background:
    Given an initialized WingFoil project with a configured git user

  Scenario: Every state change records author and timestamp
    Given a Memory document "task-101" exists
    When its frontmatter "status" changes from "draft" to "pending"
    Then a git commit is created for the change
    And the commit records the author identity and an ISO-8601 timestamp
    And the commit message references the document id "task-101" and the new state "pending"

  Scenario: Audit trail completeness across pillars
    Given changes were made to DNA, a directive, and a workflow file
    When the audit trail for the project is queried
    Then 100% of those changes are attributable to an author and a timestamp
    And no change is reported as "unknown author"

  Scenario: Error - committing a change with no configured git identity
    Given the git user name and email are not configured
    When a state change is attempted
    Then the change is not committed
    And the system returns exit code 1 with message "git identity not configured (user.name/user.email)"

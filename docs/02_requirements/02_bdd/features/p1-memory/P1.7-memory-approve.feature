Feature: P1.7 (US-2-10) - wingfoil memory approve
  As Sam, I want to approve a Memory document recording approver, timestamp, and reason
  so the review is auditable and tied to directives.

  Background:
    Given an initialized WingFoil project
    And a Memory document "task-101" exists with "status: pending"
    And the current user has the "reviewer" role

  Scenario: Approve a pending document with a reason
    When I run "wingfoil memory approve task-101 --reason 'meets standards'"
    Then the document transitions to the type's post-review approved state
    And the git commit records the approver identity, timestamp, and reason "meets standards"
    And the command exits with code 0

  Scenario: Error - approving without a reason
    When I run "wingfoil memory approve task-101"
    Then the state is unchanged
    And the command exits with code 2 and message "missing required argument: --reason"

  Scenario: Error - approver lacks authority for the type
    Given the current user does NOT hold an approver role for type "task"
    When I run "wingfoil memory approve task-101 --reason 'ok'"
    Then the state is unchanged
    And the command exits with code 1 and message "user not authorized to approve type 'task'"

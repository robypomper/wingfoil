Feature: P4.15 (US-4-12) - Fallback on Rejection
  As Morgan, I want a rejection to jump to a fallback step in the same workflow and
  optionally set a new document state so rejections are handled gracefully.

  Background:
    Given an initialized WingFoil project
    And a review step declares "fallback: { step: red, set_state: in-progress }"
    And a deliverable "task-101" is at the review step

  Scenario: Reject jumps to the fallback step and sets state
    When "task-101" is rejected at the review step
    Then the workflow position moves to step "red"
    And "task-101" frontmatter becomes "status: in-progress"

  Scenario: Reject without set_state keeps the document state
    Given the review step declares "fallback: { step: red }" with no set_state
    When "task-101" is rejected
    Then the workflow position moves to step "red"
    And "task-101" keeps its current state

  Scenario: Error - fallback references a step not in the workflow
    Given the review step declares "fallback: { step: ghost }"
    When "task-101" is rejected
    Then the rejection is not applied
    And the message is "fallback step 'ghost' not found in workflow"

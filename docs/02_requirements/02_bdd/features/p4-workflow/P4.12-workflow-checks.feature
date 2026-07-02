Feature: P4.12 (US-6-03) - Workflow Checks (pre/post execution)
  As Morgan, I want validation rules on steps (file.exists, frontmatter.required,
  git.commits, tests.coverage) so quality gates are enforced.

  Background:
    Given an initialized WingFoil project
    And a step declares a post-check "tests.coverage >= 80"

  Scenario: Step passes when the check is satisfied
    Given the measured test coverage is 85 percent
    When the post-check runs
    Then the check passes
    And the step is allowed to complete

  Scenario: Error - step is blocked when a check fails
    Given the measured test coverage is 72 percent
    When the post-check runs
    Then the check fails
    And the step is blocked with message "post-check failed: tests.coverage 72% < 80%"

  Scenario: Error - pre-check blocks execution on a missing required file
    Given a pre-check "file.exists: design.md" and "design.md" is absent
    When the step is about to execute
    Then execution does not start
    And the message is "pre-check failed: required file missing: design.md"

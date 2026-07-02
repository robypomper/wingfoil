Feature: P4.4 (US-1-01) - wingfoil workflow next
  As Alex, I want to see the next step of the active workflow, its element, role
  directives, and instructions so I know what to do without re-reading specs.

  Background:
    Given an initialized WingFoil project
    And the main workflow "release-cycle" is active

  Scenario: Show the next actionable step
    When I run "wingfoil workflow next"
    Then the output shows the next step name, its target element, the role, and role directives
    And the response is produced in under 1 second

  Scenario: Filter the next step by assignee
    Given a step is assigned to "me"
    When I run "wingfoil workflow next --assigned-to me"
    Then only steps assigned to the current user are shown

  Scenario: Edge - workflow has no remaining steps
    Given all steps of "release-cycle" are complete
    When I run "wingfoil workflow next"
    Then the command exits with code 0 and message "no next step: workflow 'release-cycle' is complete"

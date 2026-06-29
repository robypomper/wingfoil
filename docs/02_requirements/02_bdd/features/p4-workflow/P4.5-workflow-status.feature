Feature: P4.5 (US-2-01) - wingfoil workflow status
  As Sam, I want to see the state of all open main workflows and pending approvals so I
  find the reviews to do.

  Background:
    Given an initialized WingFoil project
    And 2 main workflows are open with 1 pending approval among them

  Scenario: Show status of all open workflows
    When I run "wingfoil workflow status"
    Then both open workflows are listed
    And the active workflow is highlighted
    And the 1 pending approval is shown

  Scenario Outline: Status supports machine-readable formats
    When I run "wingfoil workflow status --format <format>"
    Then the output is valid <format>

    Examples:
      | format |
      | json   |
      | yaml   |

  Scenario: Edge - no open workflows
    Given no workflows are open
    When I run "wingfoil workflow status"
    Then the command exits with code 0 and message "no open workflows"

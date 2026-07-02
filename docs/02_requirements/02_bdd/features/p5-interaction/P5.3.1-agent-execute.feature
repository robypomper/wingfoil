Feature: P5.3.1 (US-1-03) - wingfoil agent execute [--next]
  As Alex, I want to launch the agent with auto-loaded context, resolving role and element
  from the current step with --next, so I start work with pre-loaded context.

  Background:
    Given an initialized WingFoil project
    And the active workflow's next step targets element "task:101" with role "developer"

  Scenario: Launch agent resolving role and element from the step
    When I run "wingfoil agent execute --next"
    Then the agent starts with role "developer" and element "task:101"
    And DNA, Memory, and directives for that role are pre-loaded
    And the agent is ready within 30 seconds of launch

  Scenario: Explicit element override
    When I run "wingfoil agent execute --element task:202"
    Then the agent starts targeting element "task:202" regardless of the next step

  Scenario: Error - --next with no actionable step
    Given the active workflow has no next step
    When I run "wingfoil agent execute --next"
    Then no agent is launched
    And the command exits with code 1 and message "no next step to execute"

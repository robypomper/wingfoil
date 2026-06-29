Feature: P4.17 (US-0A-21) - Built-in Workflow Templates (Task, Release)
  As Alex, I want pre-built workflow templates (Task, Release) so I start from common
  patterns without building them from scratch.

  Background:
    Given a new project being initialized with WingFoil

  Scenario: Built-in workflow templates are available after init
    When initialization completes
    Then a main workflow template "release-cycle" is available
    And an includable sub template "task" is available

  Scenario: Release template composes the task sub
    When I show the "release-cycle" template
    Then its implementation phase includes the "task" sub via iterate_over

  Scenario: Error - a built-in workflow template is structurally invalid
    Given a built-in workflow template fails schema validation
    When initialization runs
    Then init aborts before registering the template
    And the message is "built-in workflow template invalid: <name>"

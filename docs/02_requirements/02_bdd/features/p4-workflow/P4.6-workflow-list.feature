Feature: P4.6 (US-0A-18) - wingfoil workflow list
  As Alex, I want to list workflows executable now so I know what I can start.

  Background:
    Given an initialized WingFoil project
    And main workflows "release-cycle" and "report-bug" are defined
    And a sub workflow "dev-loop" is defined

  Scenario: List only currently executable workflows
    When I run "wingfoil workflow list"
    Then "release-cycle" and "report-bug" are listed as startable
    And "dev-loop" is NOT listed because it is not the next step

  Scenario: A sub appears when it is the next step
    Given "dev-loop" is the next step of the active workflow
    When I run "wingfoil workflow list"
    Then "dev-loop" is listed as executable now

  Scenario: List every defined workflow with --all
    When I run "wingfoil workflow list --all"
    Then "release-cycle", "report-bug", and "dev-loop" are all listed

  Scenario: Edge - no workflows are defined
    Given no workflows are defined in the project
    When I run "wingfoil workflow list"
    Then zero workflows are listed
    And the command exits with code 0 and message "no workflows defined"

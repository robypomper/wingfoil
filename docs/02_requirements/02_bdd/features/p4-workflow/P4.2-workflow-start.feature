Feature: P4.2 (US-0A-16) - wingfoil workflow start
  As Alex, I want to start a main workflow and set it as the active context so the first
  step is initialized.

  Background:
    Given an initialized WingFoil project
    And a main workflow "release-cycle" is defined

  Scenario: Start a main workflow
    When I run "wingfoil workflow start --name release-cycle"
    Then "release-cycle" becomes the active workflow context
    And its first step is initialized
    And the command exits with code 0

  Scenario: Starting a second main workflow updates the active context
    Given "release-cycle" is already active
    When I run "wingfoil workflow start --name report-bug"
    Then "report-bug" becomes the active workflow context
    And "release-cycle" remains open

  Scenario: Error - starting a sub workflow directly
    Given a sub workflow "dev-loop" is defined
    When I run "wingfoil workflow start --name dev-loop"
    Then no workflow is started
    And the command exits with code 1 and message "cannot start a sub workflow directly: dev-loop"

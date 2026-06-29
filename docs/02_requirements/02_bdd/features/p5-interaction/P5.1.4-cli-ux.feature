Feature: P5.1.4 (US-0A-14) - CLI UX Improvements
  As Alex, I want clear help, formatting, and error messages so I use the CLI without
  confusion (cross-cutting).

  Background:
    Given an installed WingFoil CLI

  Scenario: Help is available for every command
    When I run "wingfoil <any-command> --help"
    Then usage, options, and at least one example are printed
    And the command exits with code 0

  Scenario: Error - unknown command yields an actionable error
    When I run "wingfoil memroy add"
    Then the CLI exits with code 2
    And the message includes "unknown command 'memroy'" and suggests "memory"

  Scenario: Error - errors use a consistent format with an exit code
    When any command fails with a user error
    Then the message follows the pattern "error: <reason>"
    And the exit code is non-zero

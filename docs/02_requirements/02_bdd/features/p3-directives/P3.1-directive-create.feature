Feature: P3.1 (US-4-02) - wingfoil directive create
  As Morgan, I want to create a custom directive file so I codify "how we work" rules for
  my team.

  Background:
    Given an initialized WingFoil project

  Scenario: Create a new custom directive
    When I run "wingfoil directive create --name no-direct-db-access"
    Then a directive file "no-direct-db-access" is created under ".wingfoil/directives/custom/"
    And the change is committed to git
    And the command exits with code 0

  Scenario: Error - creating a directive whose name already exists
    Given a custom directive "no-direct-db-access" already exists
    When I run "wingfoil directive create --name no-direct-db-access"
    Then no file is overwritten
    And the command exits with code 1 and message "directive already exists: no-direct-db-access"

  Scenario: Error - invalid directive name
    When I run "wingfoil directive create --name 'bad name!'"
    Then no file is created
    And the command exits with code 2 and message "invalid directive name (use kebab-case)"

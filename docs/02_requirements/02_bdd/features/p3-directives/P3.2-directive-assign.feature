Feature: P3.2 (US-4-05) - wingfoil directive assign
  As Morgan, I want to bind a directive to a role defined in DNA so rules attach to a job
  function, not a person.

  Background:
    Given an initialized WingFoil project
    And DNA defines the role "developer"
    And a directive "testing" exists

  Scenario: Assign a directive to a role
    When I run "wingfoil directive assign --directive testing --role developer"
    Then the role "developer" lists "testing" among its assigned directives
    And the command exits with code 0

  Scenario: Error - assigning to a role not defined in DNA
    When I run "wingfoil directive assign --directive testing --role wizard"
    Then no assignment is made
    And the command exits with code 1 and message "unknown role 'wizard' (not defined in dna.yaml)"

  Scenario: Error - assigning a non-existent directive
    When I run "wingfoil directive assign --directive ghost --role developer"
    Then no assignment is made
    And the command exits with code 1 and message "unknown directive: ghost"

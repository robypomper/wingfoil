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

  # dl-062 Q1 option 3 (flag `--force`), task-169.
  Scenario: Error - roles.yaml cannot be edited in place
    Given roles.yaml is committed with the role "developer" bound by an inline list "[code-quality]"
    When I run "wingfoil directive assign --directive testing --role developer"
    Then no assignment is made
    And the command exits with code 1 and message "roles.yaml cannot be updated in place; edit assignments.developer by hand, or pass --force to rewrite the whole file"

  Scenario: Rewrite roles.yaml as a whole file with --force
    Given roles.yaml is committed with the role "developer" bound by an inline list "[code-quality]"
    When I run "wingfoil directive assign --directive testing --role developer --force"
    Then the role "developer" lists "testing" among its assigned directives
    And one commit records only roles.yaml
    And stderr carries a "warning:" line naming what the rewrite did not preserve
    And the command exits with code 0

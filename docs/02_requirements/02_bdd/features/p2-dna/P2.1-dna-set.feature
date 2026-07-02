Feature: P2.1 (US-0A-08) - wingfoil dna set
  As Alex, I want to define/update project DNA so modules, stack, and conventions are
  recorded in .wingfoil/dna.yaml.

  Background:
    Given an initialized WingFoil project

  Scenario: Set a DNA field
    When I run "wingfoil dna set tech_stack.language python"
    Then ".wingfoil/dna.yaml" contains "language: python" under "tech_stack"
    And the change is committed to git
    And the command exits with code 0

  Scenario: Update an existing DNA field
    Given ".wingfoil/dna.yaml" has "language: python"
    When I run "wingfoil dna set tech_stack.language go"
    Then the value becomes "go"

  Scenario: Error - invalid dotted key path
    When I run "wingfoil dna set ..language python"
    Then ".wingfoil/dna.yaml" is unchanged
    And the command exits with code 2 and message "invalid key path: '..language'"

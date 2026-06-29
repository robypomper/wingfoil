Feature: P1.3 (US-4-01) - wingfoil memory add
  As Morgan, I want to create/add a document to Memory in draft state so conventions
  are git-backed and discoverable.

  Background:
    Given an initialized WingFoil project
    And the Memory type "decision" is defined in ".wingfoil/memory.yaml" with initial state "draft"

  Scenario: Add a new Memory document in draft state
    When I run "wingfoil memory add --type decision --title 'Use PostgreSQL'"
    Then a Memory file is created under ".wingfoil/memory/decision/"
    And its frontmatter contains "status: draft" and a generated unique id
    And the command exits with code 0 and prints the new document id

  Scenario: Error - adding a document of an undefined type
    When I run "wingfoil memory add --type unicorn --title 'X'"
    Then no file is created
    And the command exits with code 1 and message "unknown memory type 'unicorn' (not defined in memory.yaml)"

  Scenario: Error - missing required title
    When I run "wingfoil memory add --type decision"
    Then no file is created
    And the command exits with code 2 and message "missing required argument: --title"

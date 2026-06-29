Feature: P2.5 (US-0A-22) - wingfoil paths [category]
  As Alex, I want to query project resource paths by category with drill-down and
  multiple output formats so I confirm all resources are mapped for agent navigation.

  Background:
    Given an initialized WingFoil project
    And DNA maps "sources" to "src/" and "tests" to "tests/"

  Scenario: List paths for a category
    When I run "wingfoil paths sources --list"
    Then the output contains "src/"
    And the command exits with code 0

  Scenario Outline: Output formats are supported
    When I run "wingfoil paths sources --format <format>"
    Then the output is valid <format>

    Examples:
      | format  |
      | console |
      | json    |
      | yaml    |

  Scenario: Error - querying an undefined category
    When I run "wingfoil paths governance"
    And no "governance" category is mapped in DNA
    Then the command exits with code 1 and message "no paths mapped for category 'governance'"

Feature: P3.4 (US-4-04) - wingfoil directives list
  As Morgan, I want to list available directives (custom + built-in) and their role
  assignments so I manage rules with visibility.

  Background:
    Given an initialized WingFoil project
    And built-in directives and 1 custom directive "no-direct-db-access" exist

  Scenario: List all directives with assignments
    When I run "wingfoil directives list"
    Then the output includes the 6 built-in directives and "no-direct-db-access"
    And each directive shows its assigned roles (or "unassigned")

  Scenario: Filter the listing by role
    Given "testing" is assigned to role "developer"
    When I run "wingfoil directives list --role developer"
    Then only directives assigned to "developer" are listed, including "testing"

  Scenario: Edge - listing when only built-ins exist
    Given no custom directives exist
    When I run "wingfoil directives list"
    Then exactly the 6 built-in directives are listed

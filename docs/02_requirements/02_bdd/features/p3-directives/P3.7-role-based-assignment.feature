Feature: P3.7 (US-4-06) - Role-Based Directive Assignment
  As Morgan, I want to bind multiple directives to a role (one-to-many) so I compose
  flexible rule sets per function.

  Background:
    Given an initialized WingFoil project
    And DNA defines role "developer"

  Scenario: Bind multiple directives to one role
    When I assign "testing", "code-quality", and "security" to role "developer"
    Then role "developer" lists exactly those 3 directives

  Scenario: Binding is idempotent
    Given "testing" is already assigned to "developer"
    When I assign "testing" to "developer" again
    Then "testing" appears exactly once in the role's directive list
    And the command exits with code 0

  Scenario: Error - the assignment set contains an unknown directive
    When I assign "testing" and "ghost" to role "developer"
    Then no partial assignment is persisted
    And the command exits with code 1 and message "unknown directive: ghost"

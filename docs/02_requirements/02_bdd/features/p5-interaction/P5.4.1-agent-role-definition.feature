Feature: P5.4.1 (US-0A-13) - Agent Role Definition
  As Morgan, I want to define available agent roles (developer, reviewer, QA, architect,
  custom) so I can route agents by role.

  Background:
    Given an initialized WingFoil project

  Scenario: Define a built-in agent role
    When I define the role "reviewer" in DNA
    Then "reviewer" is available for directive assignment and step routing

  Scenario: Define a custom agent role
    When I define a custom role "data-engineer" in DNA
    Then "data-engineer" is available like any built-in role

  Scenario: Error - defining a duplicate role
    Given role "reviewer" already exists
    When I define the role "reviewer" again
    Then no duplicate is created
    And the message is "role already defined: reviewer"

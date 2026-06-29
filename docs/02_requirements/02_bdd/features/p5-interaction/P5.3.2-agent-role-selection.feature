Feature: P5.3.2 (US-2-07) - Agent Role Selection per Step
  As the system, I want to route the agent to the correct role based on the current
  workflow step so the right directives apply for the phase.

  Background:
    Given an initialized WingFoil project
    And the workflow step "Code Review" declares role "reviewer"

  Scenario: Role is selected from the current step
    When an agent executes the "Code Review" step
    Then the agent runs under role "reviewer"
    And reviewer directives are loaded

  Scenario: Different step selects a different role
    Given the step "Implementation" declares role "developer"
    When an agent executes the "Implementation" step
    Then the agent runs under role "developer"

  Scenario: Error - the step declares a role not defined in DNA
    Given the step "Code Review" declares role "ghost"
    When an agent executes the "Code Review" step
    Then execution does not start
    And the message is "step role 'ghost' not defined in dna.yaml"

Feature: P5.4.2 (US-3-07) - Agent Role -> Directives Binding
  As Morgan, I want to bind directives to agent roles with auto-load on execution so
  rule-role binding is automatic.

  Background:
    Given an initialized WingFoil project
    And role "developer" is bound to directive "testing"

  Scenario: Bound directives auto-load on agent execution
    When an agent executes under role "developer"
    Then the "testing" directive is loaded into the agent context automatically

  Scenario: Rebinding updates what auto-loads
    Given "code-quality" is additionally bound to "developer"
    When an agent executes under role "developer"
    Then both "testing" and "code-quality" are loaded

  Scenario: Error - binding references an undefined role
    When I bind "testing" to role "ghost"
    And "ghost" is not defined in DNA
    Then the binding is rejected
    And the message is "unknown role 'ghost' (not defined in dna.yaml)"

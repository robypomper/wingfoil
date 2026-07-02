Feature: P1.13 (US-0A-04) - Memory Element Schema (memory.yaml)
  As Morgan, I want to define each element type (path pattern, states, transitions) in
  .wingfoil/memory.yaml so per-type state machines are enforced.

  Background:
    Given an initialized WingFoil project

  Scenario: Validate a well-formed element schema
    Given ".wingfoil/memory.yaml" defines type "release" with states and transitions
    When the schema is validated
    Then validation passes
    And the "release" type exposes initial state "draft"

  Scenario: A type with no explicit states uses the defaults block
    Given ".wingfoil/memory.yaml" defines type "note" without a "states" block
    When the schema is loaded
    Then type "note" uses the default machine draft -> pending -> approved/rejected -> deprecated

  Scenario: Error - a transition references an undeclared state
    Given type "release" lists a transition target "shipped" not present in its "values"
    When the schema is validated
    Then validation fails
    And the error message is "transition target 'shipped' not in declared states for type 'release'"

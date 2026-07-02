Feature: P5.4.4 (US-1-05) - Agent Execution Context (DNA + Memory + Directives)
  As the agent, I want a structured execution context (DNA + Memory + Directives) at task
  start so I operate deterministically.

  Background:
    Given an initialized WingFoil project
    And an agent is starting a task under role "developer"

  Scenario: Receive a structured execution context
    When the task starts
    Then the agent receives a context object containing distinct DNA, Memory, and Directives sections
    And each section is individually addressable

  Scenario: Deterministic context for identical inputs
    Given the same task, role, and unchanged project state
    When the execution context is assembled twice
    Then both contexts are byte-for-byte equivalent

  Scenario: Error - the context fails schema validation
    Given an assembled context is missing the Directives section
    When the context is validated before task start
    Then the task does not start
    And the message is "invalid execution context: missing 'directives' section"

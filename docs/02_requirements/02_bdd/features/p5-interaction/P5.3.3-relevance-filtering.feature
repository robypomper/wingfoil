Feature: P5.3.3 (US-1-10) - Relevance Filtering
  As the agent, I want to load only relevant Memory documents so I avoid noise and context
  window exhaustion.

  Background:
    Given an initialized WingFoil project
    And Memory contains 100 documents, of which 5 are relevant to the current task

  Scenario: Load only relevant documents
    When the agent assembles task context
    Then only the 5 relevant documents are loaded
    And the 95 unrelated documents are excluded

  Scenario: Deprecated documents are never loaded
    Given 1 of the 5 relevant documents has "status: deprecated"
    When the agent assembles task context
    Then 4 documents are loaded
    And the deprecated document is excluded

  Scenario: Edge - no documents pass the relevance threshold
    Given no document is relevant to the current task
    When the agent assembles task context
    Then zero Memory documents are loaded
    And a note "no relevant Memory found for task" is recorded

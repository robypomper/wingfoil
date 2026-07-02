Feature: P5.4.3 (US-1-04) - Agent Context Pre-Loading
  As the agent, I want DNA, Memory, and directives auto-fetched based on role and task so
  I initialize with full context without manual requests.

  Background:
    Given an initialized WingFoil project
    And an agent is launched for element "task:101" under role "developer"

  Scenario: Pre-load context within the time budget
    When the agent initializes
    Then DNA, relevant Memory, and role directives are fetched automatically
    And pre-loading completes in under 30 seconds

  Scenario: Pre-loaded context is scoped to role and task
    When the agent initializes
    Then only Memory relevant to "task:101" and directives for "developer" are present

  Scenario: Error - a required context source is unavailable
    Given the MCP server is unreachable
    When the agent initializes
    Then initialization aborts before any task work begins
    And the message is "context pre-load failed: MCP server unreachable"

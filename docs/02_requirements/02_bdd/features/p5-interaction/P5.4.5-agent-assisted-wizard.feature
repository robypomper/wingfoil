Feature: P5.4.5 (US-0A-07) - Agent-Assisted Init Wizard
  As Morgan, I want a natural-conversation agent-assisted setup so the template is adapted
  to my team context.

  Background:
    Given a new project being initialized with WingFoil
    And the agent-assisted init mode is selected

  Scenario: Configure the project through conversation
    When I answer the agent's setup questions in natural language
    Then a ".wingfoil/" configuration reflecting my answers is generated
    And the result is equivalent in structure to the wizard-mode output

  Scenario: Fall back to wizard mode when the agent is unavailable
    Given the assisting agent cannot be reached
    When I start agent-assisted init
    Then the CLI offers to continue in standard wizard mode
    And initialization can still complete

  Scenario: Error - conversation ends before required fields are gathered
    When the conversation is aborted before tech stack is provided
    Then no partial ".wingfoil/" config is persisted
    And the message is "setup incomplete: required information not collected"

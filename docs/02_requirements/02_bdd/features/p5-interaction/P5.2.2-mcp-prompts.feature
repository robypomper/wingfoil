Feature: P5.2.2 (US-1-06) - MCP Prompts (role-based templates)
  As the agent, I want to auto-load role-specific directives and instruction templates via
  MCP Prompts at session start so I know task rules and instructions.

  Background:
    Given a running WingFoil MCP server
    And role "developer" has directives "testing" and "code-quality" assigned

  Scenario: Auto-load role prompt at session start
    When an agent session starts under the "developer" role
    Then the MCP prompt for "developer" is returned
    And it embeds the "testing" and "code-quality" directives

  Scenario: Prompt reflects the current directive assignments
    Given "security" is newly assigned to "developer"
    When an agent session starts under the "developer" role
    Then the returned prompt includes "security"

  Scenario: Error - requesting a prompt for an undefined role
    When an agent session starts under role "wizard" not defined in DNA
    Then the server returns error "no prompt for undefined role 'wizard'"

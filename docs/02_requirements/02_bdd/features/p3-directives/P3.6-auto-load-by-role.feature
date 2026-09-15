Feature: P3.6 (US-3-06) - Auto-Load Directives by Role
  As Jordan, I want directives to auto-load when agents/developers execute tasks with a
  role so the agent knows standards without manual instructions.

  Background:
    Given an initialized WingFoil project
    And role "developer" has directives "testing" and "code-quality" assigned

  Scenario: Directives auto-load at task execution
    When an agent executes a task under the "developer" role
    Then the agent context includes the "testing" and "code-quality" directives
    And 100% of the role's assigned directives are present in the context

  Scenario: Only the executing role's directives are loaded
    Given role "reviewer" has directive "code-review" assigned
    When an agent executes a task under the "developer" role
    Then the "code-review" directive is NOT loaded

  Scenario: Edge - executing under a role with no assigned directives
    Given role "intern" has no directives assigned
    When an agent executes a task under the "intern" role
    Then the agent context contains only the global directives
    And a warning "no directives assigned to role 'intern'" is emitted

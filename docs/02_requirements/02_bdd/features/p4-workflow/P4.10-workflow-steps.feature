Feature: P4.10 (US-0A-20) - Workflow Steps (atomic actions)
  As the system, I want steps to execute as atomic actions (memory.add, memory.submit,
  agent.execute, git operations) so workflow progress is automated.

  Background:
    Given an initialized WingFoil project
    And the active workflow's next step declares action "git.create_branch(task-id)"

  Scenario: Execute an atomic step action successfully
    When the step is executed
    Then a git branch named after the task id is created
    And the step is marked complete
    And the action is recorded in git history

  Scenario: Error - a failing atomic action does not partially apply
    Given the step declares "git.merge(to: main)" and the merge conflicts
    When the step is executed
    Then the merge is aborted leaving the working tree clean
    And the step is marked failed with message "step action 'git.merge' failed: merge conflict"

  Scenario: Edge - a step with multiple actions runs them in declared order
    Given the step declares actions [git.create_branch, agent.execute, git.merge]
    When the step is executed
    Then the actions run in that exact order
    And execution stops at the first action that fails

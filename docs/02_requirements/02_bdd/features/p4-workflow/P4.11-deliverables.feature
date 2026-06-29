Feature: P4.11 (US-4-08) - Deliverables (Memory + State)
  As Jordan, I want to create a deliverable Memory file with frontmatter state so its
  lifecycle follows the element's per-type state machine.

  Background:
    Given an initialized WingFoil project
    And type "task" defines initial state "draft" in ".wingfoil/memory.yaml"

  Scenario: Create a deliverable with initial state
    When I run "wingfoil memory add --type task --title 'implement billing'"
    Then a deliverable file is created with frontmatter "status: draft"
    And the command exits with code 0

  Scenario: A deliverable state transition follows the type machine
    Given the deliverable has "status: in-review"
    And type "task" allows in-review -> approved
    When the deliverable is approved
    Then its frontmatter becomes "status: approved"

  Scenario: Error - setting a state outside the type's allowed values
    Given the deliverable has "status: draft"
    When a transition to "shipped" is attempted and "shipped" is not a valid task state
    Then the state is unchanged
    And the message is "invalid state 'shipped' for type 'task'"

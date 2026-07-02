Feature: P4.18 (US-0A-10) - Reference Workflow Templates
  As Alex, I want pre-built methodology templates (Scrum, Kanban, Lean Inception,
  Trunk-Based, Custom) so I onboard with a proven workflow without authoring it from scratch.

  Background:
    Given a new project being initialized with WingFoil

  Scenario Outline: Select a reference methodology template
    When I select the "<methodology>" reference template during init
    Then a workflow configuration matching "<methodology>" is generated
    And the command exits with code 0

    Examples:
      | methodology    |
      | Scrum          |
      | Kanban         |
      | Lean Inception |
      | Trunk-Based    |

  Scenario: Custom template starts from a minimal skeleton
    When I select the "Custom" reference template during init
    Then a minimal workflow skeleton is generated for me to extend

  Scenario: Error - selecting an unknown methodology
    When I select the "Waterfall2000" reference template during init
    Then no workflow is generated
    And the message is "unknown reference template: Waterfall2000"

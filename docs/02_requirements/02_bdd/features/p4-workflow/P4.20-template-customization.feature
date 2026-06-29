Feature: P4.20 (US-0A-12) - Template Customization
  As Morgan, I want to override template defaults so the workflow matches my team's style.

  Background:
    Given a new project being initialized with WingFoil
    And a reference template has been expanded with a default approval role "tech-lead"

  Scenario: Override a template default
    When I override the approval role to "lead-architect"
    Then the resulting workflow uses "lead-architect" as the approval role
    And the override is persisted in the custom workflow file

  Scenario: Non-overridden defaults are preserved
    When I override only the approval role
    Then all other template defaults remain unchanged

  Scenario: Error - overriding with a role not defined in DNA
    When I override the approval role to "ghost-role"
    And "ghost-role" is not defined in DNA
    Then the override is rejected
    And the message is "cannot override: role 'ghost-role' not defined in dna.yaml"

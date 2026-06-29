Feature: P3.8 (US-0A-09) - Built-in Directive Templates
  As Alex, I want the wizard to install built-in directive templates (Code Quality,
  Testing, Code Review, Architecture, Security, Documentation) so I start with sensible
  rules and reduced friction.

  Background:
    Given a new project being initialized with WingFoil

  Scenario: Built-in templates are installed during init
    When initialization completes
    Then ".wingfoil/directives/built-in/" contains exactly 6 templates
    And the set is: code-quality, testing, code-review, architecture, security, documentation

  Scenario: Built-in templates are selected by methodology
    Given the selected methodology is "Trunk-Based"
    When initialization completes
    Then the 6 built-in templates are installed and available for assignment

  Scenario: Error - a built-in template fails its integrity check
    Given a built-in template source is corrupted
    When initialization runs
    Then init aborts before writing partial directives
    And the message is "built-in directive template integrity check failed: <name>"

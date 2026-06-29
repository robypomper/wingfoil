Feature: P5.1.3 (US-0B-01) - wingfoil audit
  As Morgan, I want to scan the project and summarize its current state (languages,
  frameworks, structure) so I understand it before migrating.

  Background:
    Given an existing project with Python and JavaScript sources

  Scenario: Produce a state summary
    When I run "wingfoil audit"
    Then the output lists detected languages including "python" and "javascript"
    And it summarizes the directory structure and detected frameworks
    And the command exits with code 0

  Scenario: Audit feeds init --mode infer
    When I run "wingfoil audit"
    Then the produced summary is consumable by "wingfoil init --mode infer"

  Scenario: Error - auditing outside a project directory
    Given the current directory contains no recognizable project files
    When I run "wingfoil audit"
    Then the command exits with code 1 and message "nothing to audit: no project files detected"

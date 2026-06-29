Feature: P1.9 (US-5-04) - wingfoil memory deprecate
  As Casey, I want deprecated documents marked so they stay in the repo but agents ignore
  them, keeping active decisions distinct from archived ones.

  Background:
    Given an initialized WingFoil project
    And a Memory document "decision-12" exists with "status: approved"

  Scenario: Deprecate an approved document
    When I run "wingfoil memory deprecate decision-12 --reason 'superseded by decision-20'"
    Then the document frontmatter becomes "status: deprecated"
    And the file remains present in the repository
    And the command exits with code 0

  Scenario: Deprecated documents are excluded from default agent context
    Given the document "decision-12" has "status: deprecated"
    When an agent fetches relevant Memory for a task
    Then "decision-12" is NOT included in the returned context

  Scenario: Error - deprecating an already-deprecated document
    Given the document "decision-12" has "status: deprecated"
    When I run "wingfoil memory deprecate decision-12 --reason 'x'"
    Then the state is unchanged
    And the command exits with code 1 and message "document already deprecated: decision-12"

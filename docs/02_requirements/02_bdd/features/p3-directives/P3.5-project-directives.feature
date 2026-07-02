Feature: P3.5 (US-4-03) - Project Directives (custom + built-in)
  As Morgan, I want role-scoped rules (custom + built-in) stored in .wingfoil/directives/
  so there is a shared, versionable directive layer.

  Background:
    Given an initialized WingFoil project

  Scenario: Directive storage layout exists after init
    When I inspect ".wingfoil/directives/"
    Then it contains a "built-in/" and a "custom/" subfolder
    And both are tracked by git

  Scenario: A directive change is versioned
    Given a custom directive "no-direct-db-access" exists
    When its content is edited and saved
    Then the change is captured as a git commit
    And the previous version is retrievable from history

  Scenario: Error - a directive file missing required header fields
    Given a custom directive file lacks its required "name" header
    When directives are loaded
    Then loading reports the file as invalid
    And the message is "invalid directive: missing required field 'name'"

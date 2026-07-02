Feature: P5.1.2 (US-0B-02) - wingfoil init --mode infer
  As Morgan, I want to initialize WingFoil on an existing project with codebase inference
  so I migrate without restructuring the code.

  Background:
    Given an existing project that is a git repository with source history
    And no ".wingfoil/" structure exists yet

  Scenario: Initialize an existing project with inference
    When I run "wingfoil init --mode infer" and approve the inferred proposals
    Then a ".wingfoil/" structure is created reflecting the inferred DNA and process
    And no existing source files are modified
    And the command exits with code 0

  Scenario: Inference proposals require human approval before write
    When I run "wingfoil init --mode infer"
    Then each inferred section is presented for approval before being persisted

  Scenario: Error - inference mode on a non-git project
    Given the project is NOT a git repository
    When I run "wingfoil init --mode infer"
    Then initialization stops
    And the command exits with code 1 and message "not a git repository: run 'git init' first"

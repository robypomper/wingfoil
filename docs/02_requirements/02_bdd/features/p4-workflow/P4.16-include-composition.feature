Feature: P4.16 (US-6-04) - Workflow include() Composition
  As Morgan, I want include() to run once or once-per-element via iterate_over with where
  filters so I reuse logic across elements.

  Background:
    Given an initialized WingFoil project
    And a phase declares "include: dev-loop, iterate_over: task, where: { status: [backlog] }"

  Scenario: Iterate the included sub once per matching element
    Given 3 tasks have "status: backlog" and 1 task has "status: done"
    When the phase executes
    Then the sub "dev-loop" runs exactly 3 times, once per backlog task

  Scenario: Plain include runs exactly once
    Given a phase declares "include: setup-sub" with no iterate_over
    When the phase executes
    Then "setup-sub" runs exactly once

  Scenario: Edge - iterate_over matches zero elements
    Given no task has "status: backlog"
    When the phase executes
    Then "dev-loop" runs zero times
    And the phase completes with note "no elements matched the iterate_over filter"

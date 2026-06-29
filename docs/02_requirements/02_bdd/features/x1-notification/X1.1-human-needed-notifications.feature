Feature: X1.1 (US-2-02) - "Human Needed" Notifications
  As Morgan, I want to be notified when an approval or decision is required so I do not
  have to poll the queue manually.

  Background:
    Given an initialized WingFoil project with notifications enabled

  Scenario: Notify on a pending approval
    Given a deliverable transitions to "status: pending" requiring approval
    When the notification system processes the event
    Then a "human needed" notification is emitted naming the required action and the document id

  Scenario: No notification when no human action is required
    Given a deliverable transitions between two automated states
    When the notification system processes the event
    Then no "human needed" notification is emitted

  Scenario: Error - notification delivery fails
    Given the configured notification channel is unreachable
    When a "human needed" event occurs
    Then the failure is logged with the event id
    And the message is "notification delivery failed for event <id>"

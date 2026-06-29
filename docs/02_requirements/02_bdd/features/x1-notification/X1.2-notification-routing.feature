Feature: X1.2 (US-2-03) - Notification Routing
  As Morgan, I want notifications routed by role or decision type so I receive only the
  alerts that pertain to me.

  Background:
    Given an initialized WingFoil project with notifications enabled
    And DNA defines "Morgan" as "approver" and "Casey" as "stakeholder"

  Scenario: Route an approval notification to the role holder
    Given an approval requires the "approver" role
    When the notification is routed
    Then it is delivered to "Morgan"
    And it is NOT delivered to "Casey"

  Scenario: Route by decision type to a specific person
    Given a "budget" decision type is routed to "Casey"
    When a "budget" decision notification is produced
    Then it is delivered to "Casey"

  Scenario: Error - no recipient matches the routing rule
    Given an approval requires a role with no assigned member
    When the notification is routed
    Then delivery is skipped
    And the message is "no recipient for notification: unrouted role '<role>'"

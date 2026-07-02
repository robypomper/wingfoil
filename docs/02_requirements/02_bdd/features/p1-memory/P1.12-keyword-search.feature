Feature: P1.12 (US-1-09) - Keyword Memory Search
  As Alex, I want to find relevant documents via keyword and metadata matching so I
  retrieve content without scanning everything.

  Background:
    Given an initialized WingFoil project
    And Memory contains documents "A" (body mentions "caching") and "B" (tag "caching")

  Scenario: Keyword match against document body and metadata
    When I search for "caching"
    Then both "A" and "B" are returned
    And results are ranked with metadata matches before body-only matches

  Scenario: Case-insensitive matching
    When I search for "CACHING"
    Then both "A" and "B" are returned

  Scenario: Error - empty query string
    When I search with an empty query ""
    Then no search is performed
    And the system returns exit code 2 with message "empty search query"

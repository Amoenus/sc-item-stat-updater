# ADR 004: GitHub Actions as a Shared Artifact Orchestrator

## Status
Accepted, future-facing

## Context
The local CLI can scrape or extract data directly. If many users run web scraping at the same time, especially against third-party sources such as SCMDB or SPViewer, the project could create redundant upstream load. Game-file extraction can happen locally, but web data is a better candidate for shared artifacts when possible.

## Decision
For shared web-source data, we may use scheduled GitHub Actions to run acquisition and patch planning centrally.
* The CI job can acquire SCMDB/SPViewer data politely.
* It can generate optimized intermediary JSON artifacts.
* It can publish artifacts for local or future static-client consumption.

The local pipeline remains the primary workflow for extracting `global.ini` and game-file data from the user's installed game.

## Consequences
### Positive
* **Polite Scraping:** We reduce upstream API load from *N* (number of users) to exactly 1. We hit the API once, process the data once, and distribute the result infinitely.
* **Resilience:** End-users no longer depend on upstream API uptime at the exact moment they run the tool. If an API goes down, users can still download the last known good artifact from GitHub.
* **Speed:** Users do not have to wait for the scraping and transformation process to finish; they simply download a tiny static JSON file.
* **Automation:** Scrapes can run automatically on a daily schedule, ensuring the artifact is always reasonably up-to-date.

### Negative
* **Staleness:** Data is only as fresh as the last cron execution (e.g., up to 24 hours old).
* **CI Limits:** Relies on GitHub Actions' availability and runtime limits, though this text-processing task is extremely lightweight and unlikely to hit limits.

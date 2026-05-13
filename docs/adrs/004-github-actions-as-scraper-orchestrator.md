# ADR 004: GitHub Actions as the Scraper Orchestrator

## Status
Accepted

## Context
In Phase 1, the CLI application relies on local execution, meaning every individual user who runs the tool will independently scrape upstream APIs (like SPViewer or SCMDB). On a major patch day, if 1,000 users run the tool simultaneously, it will result in 1,000 concurrent, redundant scraping sessions hitting those APIs. This is inefficient and risks having our tool flagged or IP-banned for abuse.

## Decision
We will transition the primary scraping responsibility to a scheduled GitHub Actions cron job.
* This CI/CD job will run the Extraction and Transformation pipeline centrally.
* It will generate the optimized intermediary JSON artifact (`patch-data.json`).
* It will commit this artifact to the `gh-pages` branch, making it statically available.

## Consequences
### Positive
* **Polite Scraping:** We reduce upstream API load from *N* (number of users) to exactly 1. We hit the API once, process the data once, and distribute the result infinitely.
* **Resilience:** End-users no longer depend on upstream API uptime at the exact moment they run the tool. If an API goes down, users can still download the last known good artifact from GitHub.
* **Speed:** Users do not have to wait for the scraping and transformation process to finish; they simply download a tiny static JSON file.
* **Automation:** Scrapes can run automatically on a daily schedule, ensuring the artifact is always reasonably up-to-date.

### Negative
* **Staleness:** Data is only as fresh as the last cron execution (e.g., up to 24 hours old).
* **CI Limits:** Relies on GitHub Actions' availability and runtime limits, though this text-processing task is extremely lightweight and unlikely to hit limits.

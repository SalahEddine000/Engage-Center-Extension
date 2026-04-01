# Engage Center Case Fetcher — Tasks & Milestones

> Derived from PRD v1.0 · 01 Apr 2026

---

## Overview

| Milestone | Focus | Status |
|---|---|---|
| M1 | Technical Spike | 🔲 Not Started |
| M2 | MVP Build | 🔲 Not Started |
| M3 | Hardening | 🔲 Not Started |
| M4 | Pilot | 🔲 Not Started |

---

## Milestone 1 — Technical Spike

> **Goal:** Validate that the core technical assumptions in the PRD hold before committing to a full build.

### 1.1 — Auth Context Discovery

- [ ] Set up a test Edge/Chromium environment with Engage Center access
- [ ] Use DevTools to manually inspect outbound requests to `https://gateway.engagehub.azure.com/support/cases/*`
- [ ] Confirm the presence and format of the `Authorization: Bearer <token>` header
- [ ] Confirm the presence and format of the `x-eh-scope` header
- [ ] Determine whether any additional headers or cookies are required for successful API replay
- [ ] Document all required headers and their expected formats

### 1.2 — Host Pattern Confirmation

- [ ] Identify all production and sandbox portal hostnames (e.g. `sandbox-4.reactblade.portal.azure.net`)
- [ ] Determine whether portal hostnames vary across tenants or environments
- [ ] Define the minimal set of `host_permissions` needed in `manifest.json`
- [ ] Confirm whether `https://gateway.engagehub.azure.com/*` is sufficient or additional gateway hosts are needed

### 1.3 — webRequest Feasibility

- [ ] Build a minimal MV3 extension proof-of-concept with `chrome.webRequest` listener
- [ ] Verify that `Authorization` and `x-eh-scope` headers are observable via `webRequest.onSendHeaders`
- [ ] Test whether the captured token can successfully replay the `GET /support/cases/<CaseID>` call
- [ ] Document any limitations (e.g. blocked by CORS, missing headers, opaque responses)

### 1.4 — Fallback Assessment

- [ ] If Option A (webRequest) proves insufficient, prototype Option B (content script + `window.postMessage` bridge)
- [ ] Compare reliability and maintenance cost of both options
- [ ] Confirm final auth strategy and document the decision

### 1.5 — Spike Sign-Off

- [ ] Document findings in a short technical memo
- [ ] Confirm go/no-go for MVP build
- [ ] Finalise `manifest.json` permissions list based on findings

---

## Milestone 2 — MVP Build

> **Goal:** Deliver a working internal extension that satisfies all MVP acceptance criteria from the PRD.

### 2.1 — Project Setup

- [ ] Initialise extension project structure with the following layout:
  ```
  /
  ├── manifest.json
  ├── popup/
  │   ├── popup.html
  │   ├── popup.js
  │   └── popup.css
  ├── background/
  │   └── service-worker.js
  ├── content/
  │   └── content-script.js   (optional)
  ├── modules/
  │   ├── session-manager.js
  │   └── case-api-client.js
  └── assets/
  ```
- [ ] Author `manifest.json` (MV3) with required permissions and host patterns
- [ ] Configure build tooling (bundler, linter, formatter) if needed
- [ ] Set up a local test environment for sideloading in Edge

### 2.2 — Background Service Worker

- [ ] Implement `chrome.webRequest.onSendHeaders` listener targeting Engage Hub endpoints
- [ ] Extract and validate `Authorization` and `x-eh-scope` headers from observed requests
- [ ] Store captured auth context in-memory (service worker scope only — no `chrome.storage`)
- [ ] Handle service worker wake/sleep lifecycle: re-acquire session on next observed request
- [ ] Expose a message listener so the popup can request auth context and trigger case fetches
- [ ] Implement session invalidation on `401`/`403` response from the API

### 2.3 — Session Manager Module

- [ ] Define the in-memory session object schema:
  ```json
  {
    "authorization": "Bearer <redacted>",
    "scope": "agreements/<guid>",
    "capturedAt": "<ISO timestamp>",
    "sourceHost": "gateway.engagehub.azure.com",
    "status": "connected"
  }
  ```
- [ ] Implement `getSession()`, `setSession()`, and `clearSession()` functions
- [ ] Implement session freshness validation (e.g. age threshold or post-401 invalidation)
- [ ] Ensure session is cleared on browser restart (service worker restart = memory cleared)

### 2.4 — Case API Client Module

- [ ] Implement `fetchCase(caseId, authContext)` function
- [ ] Build the `GET https://gateway.engagehub.azure.com/support/cases/<CaseID>` request
- [ ] Attach `Authorization` and `x-eh-scope` headers from session context
- [ ] Parse and return the response payload on success
- [ ] Normalise errors:

  | HTTP Status | Normalised Error |
  |---|---|
  | `401` / `403` | `SESSION_EXPIRED` |
  | `404` | `CASE_NOT_FOUND` |
  | Network failure | `NETWORK_ERROR` |
  | Missing auth context | `NO_SESSION` |

### 2.5 — Popup UI

- [ ] Build `popup.html` with the layout defined in the PRD wireframe
- [ ] Implement session status badge (`Connected` / `Not detected` / `Expired`)
- [ ] Implement Case ID input with inline validation:
  - Required field
  - Numeric string only
  - Whitespace trimming
  - Configurable length check
- [ ] Implement **Fetch Case** button with loading state (spinner + *"Fetching case…"*)
- [ ] Implement **Open Portal** button that opens the Engage Center URL in a new tab
- [ ] Implement result display area:
  - Summary view (Case ID, Status, Severity, Created date)
  - Raw JSON tab
- [ ] Implement **Copy JSON** button (writes full payload to clipboard)
- [ ] Implement **Clear** button (resets input and result)
- [ ] Implement all error states with user-friendly messages:
  - No session → *"Open Engage Center and sign in to begin."*
  - Session expired → *"Session expired or unauthorized. Please re-open Engage Center."*
  - Case not found → *"Case not found. Please check the Case ID and try again."*
  - Network error → *"Request failed. Please check your connection and retry."*
  - Invalid input → *"Please enter a valid numeric Case ID."*

### 2.6 — Empty & Unauthenticated States

- [ ] Show empty state when no session is detected on popup open
- [ ] Show guided instructions when session is missing:
  1. Open Engage Center
  2. Sign in
  3. Open any case in the portal
  4. Return to this extension
- [ ] Automatically update session badge once auth context is captured

### 2.7 — Optional Content Script (if needed)

- [ ] Implement content script to detect Engage Center portal presence
- [ ] Implement `window.postMessage` bridge to relay auth headers to the extension if webRequest proves insufficient
- [ ] Register content script in `manifest.json` scoped to approved portal hostnames only

### 2.8 — End-to-End Integration

- [ ] Wire popup → service worker → session manager → case API client
- [ ] Validate full happy path: session detected → Case ID entered → case fetched → JSON displayed
- [ ] Validate full error path: no session → user guided → session acquired → retry succeeds

---

## Milestone 3 — Hardening

> **Goal:** Make the extension production-safe, secure, and maintainable before pilot rollout.

### 3.1 — Security Review

- [ ] Audit all code paths to confirm JWT is never written to `chrome.storage.local` or `chrome.storage.sync`
- [ ] Confirm `Authorization` header is never logged in full (mask as `Bearer [REDACTED]`)
- [ ] Confirm `x-eh-scope` is never logged in plain text in production mode
- [ ] Review `manifest.json` permissions — remove any that are not strictly required
- [ ] Confirm no `<all_urls>` host permission is used
- [ ] Confirm no remotely hosted code is referenced (MV3 compliance)
- [ ] Produce a short internal threat model document

### 3.2 — Logging & Observability

- [ ] Implement structured debug logging (disabled in production builds)
- [ ] Ensure all auth-related log lines mask sensitive values
- [ ] Add non-sensitive audit log entries for: session captured, fetch attempted, fetch succeeded, fetch failed (with error type only)

### 3.3 — Robustness & Edge Cases

- [ ] Test and handle service worker restart mid-session (re-acquire on next observed request)
- [ ] Test behaviour when user logs out of Engage Center — confirm session is invalidated
- [ ] Test behaviour after token expiry — confirm `401` triggers session clear and actionable error
- [ ] Test with large case JSON payloads — confirm UI renders without freezing
- [ ] Test rapid repeated fetches — confirm no race conditions

### 3.4 — UX Improvements

- [ ] Add visual loading indicator that clearly communicates in-progress state
- [ ] Improve JSON display: syntax highlighting or collapsible tree view
- [ ] Add optional **Copy Summary** action for selected key fields
- [ ] Ensure popup layout is usable at default Edge extension popup dimensions

### 3.5 — Code Quality

- [ ] Enforce consistent code style via linter/formatter
- [ ] Separate all magic strings (URLs, header names, error codes) into a config/constants file
- [ ] Ensure endpoint patterns are configurable without code changes
- [ ] Write inline documentation for session manager and case API client modules

### 3.6 — Regression Test Pass

- [ ] Run all functional tests defined in the QA plan (see PRD §25)
- [ ] Run all security tests (JWT persistence, log redaction, host restriction)
- [ ] Run UX tests (empty state, error readability, copy action, large payload)
- [ ] Test on Microsoft Edge latest stable
- [ ] Optionally test on Chrome latest stable
- [ ] Resolve all critical and high-severity findings before pilot

---

## Milestone 4 — Pilot

> **Goal:** Roll out to a small internal support team, gather feedback, and plan v1.1.

### 4.1 — Internal Distribution

- [ ] Package the extension as a `.crx` or unpacked zip for sideloading
- [ ] Write a one-page install guide for pilot users (how to sideload in Edge)
- [ ] Define the pilot group (suggested: 5–10 support engineers)
- [ ] Distribute the extension to the pilot group

### 4.2 — Pilot Onboarding

- [ ] Brief pilot users on the purpose and expected workflow
- [ ] Share known limitations and open questions (PRD §26)
- [ ] Set up a lightweight feedback channel (e.g. shared doc, form, or Slack thread)

### 4.3 — Monitoring & Feedback Collection

- [ ] Track: weekly active users, cases fetched per week
- [ ] Track: session detection success rate, error rate by category
- [ ] Collect qualitative feedback: UX clarity, missing features, pain points
- [ ] Monitor for any security concerns (token persistence, unintended logging)

### 4.4 — v1.1 Backlog Decision

- [ ] Consolidate pilot feedback
- [ ] Review against v1.1 candidate features:
  - [ ] Recent Cases history (FR-6)
  - [ ] Curated summary view
  - [ ] Multi-environment host configuration UI
  - [ ] Edge Add-ons store publication (if required)
- [ ] Prioritise and scope v1.1
- [ ] Update PRD and re-enter development cycle

---

## Cross-Cutting Tasks

> These tasks apply across milestones and should be tracked continuously.

### Security & Compliance

- [ ] Maintain zero incidents of JWT persistence throughout development
- [ ] Obtain internal security team sign-off before pilot rollout
- [ ] Keep `manifest.json` permissions under review as features are added or removed

### Documentation

- [ ] Keep a running ADR (Architecture Decision Record) for key decisions (e.g. Option A vs B for auth)
- [ ] Maintain a changelog from M2 onwards
- [ ] Document configurable values (endpoint patterns, header names, TTLs)

### Open Questions (to resolve during M1)

- [ ] Are there multiple production portal hostnames beyond `sandbox-4.reactblade.portal.azure.net`?
- [ ] Is `x-eh-scope` always mandatory and stable across tenants/environments?
- [ ] Does the API require additional hidden headers or cookies beyond the observed request?
- [ ] Should the extension display raw JSON only, or also a curated summary view?
- [ ] Is internal sideload distribution sufficient, or is Edge Add-ons publication required later?

---

## MVP Acceptance Checklist

> The MVP is complete when all of the following are checked.

- [ ] Extension installs successfully in Edge/Chromium via sideloading
- [ ] Popup opens and displays correct session status
- [ ] With a valid Engage Center session, user can fetch a case by Case ID
- [ ] Case JSON is displayed in the result area
- [ ] **Copy JSON** successfully copies the full payload to clipboard
- [ ] JWT is never visible in the UI
- [ ] JWT is never written to `chrome.storage`
- [ ] Error messages are shown for: no session, expired session, unauthorized, case not found
- [ ] All regression tests in the QA plan pass
- [ ] Security review completed with no critical findings
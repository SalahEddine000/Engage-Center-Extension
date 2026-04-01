# PRD — Engage Center Case Fetcher Browser Extension

## 1) Document Information

| Field | Value |
|---|---|
| **Product Name** | Engage Center Case Fetcher |
| **Product Type** | Internal browser extension for Microsoft Edge / Chromium |
| **Primary Users** | Support engineers / case handlers |
| **Document Owner** | Product / Engineering |
| **Version** | v1.0 |
| **Date** | 01 Apr 2026 |

---

## 2) Executive Summary

We need an internal browser extension that allows users to retrieve case details from the Engage Center ecosystem by entering a Case ID into a simple extension UI. The extension must work only when the user is already authenticated in Engage Center, and it must obtain the required authorization context from the active logged-in browser session.

The core technical challenge is **session-aware authentication**: the API call to:

```
GET https://gateway.engagehub.azure.com/support/cases/<CaseID>
```

requires a valid Bearer JWT and supporting headers (notably `x-eh-scope`). The extension should therefore detect whether the user is logged in to Engage Center and securely reuse the existing authenticated session context, without asking the user to manually paste tokens.

The initial version will focus on:

- Detecting active Engage Center login context
- Capturing or reusing the session authorization context safely
- Fetching case details by Case ID
- Displaying case data in a simple, minimal UI

---

## 3) Problem Statement

Support engineers frequently need to retrieve case details quickly from the Engage Center backend. The existing workflow requires navigating the portal UI and relying on manual inspection or browser developer tools to locate the case API call and reuse request context.

This is:

- slow
- repetitive
- error-prone
- difficult for non-technical users

A browser extension can significantly streamline this workflow by providing a lightweight UI that fetches the case directly using the user's existing authenticated session.

---

## 4) Goals

### Primary Goals

- Allow a user to enter a Case ID and fetch case details from the Engage Center backend.
- Ensure the extension only works when the user is already logged in to Engage Center.
- Avoid requiring users to manually extract or paste JWT tokens.
- Provide a simple and fast UI inside the browser toolbar popup.
- Minimize security risk by using least-privilege permissions and by avoiding persistent token storage.

### Secondary Goals

- Show authentication/session status in the UI.
- Allow copy/export of fetched case payload.
- Provide basic error states (not logged in, token unavailable, unauthorized, case not found, network error).

---

## 5) Non-Goals

The first version will **not**:

- Create, update, or close cases
- Modify requests or responses in-flight
- Support bulk search / batch import
- Support advanced filtering, dashboards, or analytics
- Replace the Engage Center portal UI
- Support browsers outside Chromium-based browsers
- Authenticate directly against Microsoft Entra ID or request standalone OAuth consent flows

---

## 6) Users / Personas

**Persona A — Cloud Support Engineer**
Needs to quickly retrieve case details during triage, escalation, or customer follow-up.

**Persona B — Team Lead / Escalation Manager**
Needs to validate case status and metadata without repeatedly navigating the full portal.

**Persona C — Technical Investigator**
Needs easy access to raw case payloads for debugging, auditing, or automation input.

---

## 7) User Stories

### Core User Stories

- As a support engineer, I want to enter a Case ID in the extension popup so I can retrieve the case quickly.
- As a logged-in portal user, I want the extension to detect whether my session is valid so I know whether I can use it immediately.
- As a user, I want the extension to reuse my active Engage Center session so I do not need to paste tokens manually.
- As a user, I want clear error messages if I am not logged in or if the extension cannot access the required auth context.
- As a user, I want to copy the fetched case JSON so I can reuse it in notes, AI tools, or investigations.

### Nice-to-Have User Stories

- As a user, I want recently fetched Case IDs listed locally for quick recall.
- As a user, I want a compact "important fields" summary in addition to raw JSON.

---

## 8) Product Scope

### In Scope (v1)

- Extension popup UI
- Session detection
- Auth context capture / reuse
- Single case fetch by Case ID
- Raw JSON display
- Copy to clipboard
- Basic local caching of case data only (optional), with short TTL
- Error handling and audit-friendly logging (non-sensitive)

### Out of Scope (v1)

- Multi-case fetch
- Search by customer / title / subscription / severity
- Case editing
- Portal automation beyond reading session context
- Cloud backend or external storage

---

## 9) Key Technical Constraints

- The extension should be built using **Manifest V3**, where background logic runs in a service worker rather than a persistent background page. Chrome/Edge extensions under MV3 also separate permissions more explicitly, including `permissions`, `host_permissions`, and optional host permissions.
- Content scripts can interact with the page DOM, but they run in an **isolated world**, meaning they do not automatically share JavaScript variables or execution context with the page itself. Communication between page context and extension context must happen explicitly, for example via DOM events or `window.postMessage`.
- Extensions can observe network requests using the `chrome.webRequest` API in MV3, but the blocking variant is largely unavailable to normal MV3 extensions; observational use remains available with the proper permissions and host access.
- Microsoft Edge follows the Chromium extension model and supports MV3-related architecture and migration patterns.

---

## 10) Proposed Solution

### High-Level Approach

The extension will provide a popup where the user enters a Case ID. Before allowing fetch, the extension will verify that the user has an active Engage Center session.

### Recommended Authentication Strategy (Preferred)

Rather than asking the user to supply a JWT manually, the extension should observe an authenticated request made by the portal and capture the required authorization context **in memory only**:

```
Authorization: Bearer <token>
x-eh-scope: <scope>
```

This can be achieved by listening for relevant outbound requests to the Engage Hub / Gateway endpoints while the user is browsing the portal, then caching only the latest valid auth context in extension memory.

### Why this is the preferred approach

- Lowest friction for users
- Reuses existing authenticated browser session
- Avoids custom login flow
- More stable than scraping UI state
- More secure than asking users to paste secrets manually

### Important Security Principle

> The extension should **never** persist the JWT token to local storage unless there is a very strong business justification and explicit approval. Tokens should remain ephemeral, in-memory only, and be cleared on browser restart, logout detection, or explicit "Clear Session" action.

---

## 11) Authentication / Session Design

### Functional Requirement

The extension must work only if the user is already signed in to Engage Center in the same browser profile.

### Session Acquisition Options

#### Option A — Observe outbound request headers *(Recommended)*

The extension observes requests to:

```
https://gateway.engagehub.azure.com/support/cases/*
```

or related Engage Hub APIs and extracts:

- `Authorization` header
- `x-eh-scope` header

This relies on `webRequest` observation plus correct host permissions.

| | |
|---|---|
| **Pros** | Minimal user friction; does not depend on page internals; robust if request format remains stable |
| **Cons** | The user must have already triggered at least one authenticated portal request, or the extension must prompt them to open a case in Engage Center first |

#### Option B — Bridge from page context to extension

A content script injects a page-context helper that monitors `fetch` / XHR calls and relays selected request metadata back to the extension via `window.postMessage`.

| | |
|---|---|
| **Pros** | Can be precise if the portal uses JS-layer tokens; useful fallback if webRequest proves insufficient |
| **Cons** | More fragile; more invasive; higher maintenance cost if the portal frontend changes |

### Decision

Use **Option A** as the default design. Retain Option B only as a fallback if request observation does not reliably expose the auth context required for API replay.

---

## 12) User Experience / UI Requirements

### Popup UI (Simple)

**Main State**
- Header: *Engage Center Case Fetcher*
- Session Status Badge: `Connected` / `Not detected` / `Expired`
- Input: Case ID
- Primary Button: **Fetch Case**
- Secondary Actions: Copy JSON, Clear, Open Engage Center
- Output Area: Summary view, Raw JSON tab, Error messages

**Empty State**
- Message: *"Open Engage Center and sign in to begin."*
- CTA: *"Open Portal"*

**Missing Session State**
- Message: *"No authenticated Engage Center session detected."*
- Guidance: Open Engage Center → Sign in → Open a case once in the portal → Return to the extension

**Loading State**
- Spinner + *"Fetching case…"*

**Error States**
- Invalid Case ID format
- Not authenticated
- Session expired
- Unauthorized (401/403)
- Case not found (404)
- API/network error
- Missing required scope header

---

## 13) Example UX Flow

### Flow A — Happy Path

1. User is logged into Engage Center in Edge.
2. User opens the extension popup.
3. Extension shows **Session: Connected**.
4. User enters Case ID.
5. User clicks **Fetch Case**.
6. Extension calls `GET https://gateway.engagehub.azure.com/support/cases/<CaseID>` using captured auth context.
7. Case details are displayed.
8. User copies JSON or reviews summary.

### Flow B — No Session Yet

1. User opens extension.
2. Extension cannot find valid auth context.
3. UI shows *"Sign in to Engage Center first."*
4. User clicks **Open Portal**.
5. User signs in and opens a case page.
6. Extension detects/captures auth context.
7. User retries fetch.

---

## 14) Functional Requirements

### FR-1: Session Detection

The extension must detect whether an Engage Center-authenticated session context is available.

**Acceptance Criteria**
- Shows one of: `Connected` / `Not detected` / `Expired`
- Detects absence of required auth headers
- Clears invalid/expired in-memory session automatically after failed auth response

### FR-2: Case Fetch by ID

The extension must allow the user to enter a single Case ID and fetch the corresponding case payload.

**Acceptance Criteria**
- Accepts manual Case ID input
- Prevents empty submission
- Calls the target API with required headers
- Displays success or failure result within 3 seconds in normal conditions

### FR-3: Authorization Context Reuse

The extension must reuse the existing browser session auth context rather than require manual token input.

**Acceptance Criteria**
- Uses observed or relayed auth context
- Does not ask the user to paste JWT in the UI
- Keeps token in memory only by default

### FR-4: Copy / Export

The extension must let the user copy case data.

**Acceptance Criteria**
- "Copy JSON" copies the full fetched payload
- Optional "Copy Summary" copies selected fields only

### FR-5: Error Handling

The extension must show actionable errors.

**Acceptance Criteria**
- `401/403` → *"Session expired or unauthorized"*
- `404` → *"Case not found"*
- Missing auth context → *"Please open Engage Center and sign in"*
- Network errors → *"Request failed, please retry"*

### FR-6: Recent Cases *(Optional v1.1)*

Store last 5–10 recent Case IDs locally, without sensitive auth data.

**Acceptance Criteria**
- JWT is never stored in recent history
- User can clear history

---

## 15) Non-Functional Requirements

### Security
- JWT must not be written to persistent storage by default.
- Sensitive headers must be masked in logs.
- Use least-privilege permissions.
- No remote hosted code in the extension package (MV3 requirement).

### Performance
- Popup should load in under **500 ms**
- Case fetch should start within **200 ms** of clicking Fetch
- Render JSON efficiently for large payloads

### Reliability
- Service worker wake/sleep behavior under MV3 must not break the session flow; durable non-sensitive state should be persisted explicitly because service workers are not persistent.

### Maintainability
- Modular code structure
- Configurable endpoint patterns
- Clear separation: popup UI / background service worker / content script (if needed) / auth+session manager / case API client

---

## 16) Permissions & Browser Model

### Permissions Required

- `storage`
- `webRequest`
- `scripting` *(possibly, if content script or fallback injection is needed)*

### Host Permissions Required

- `https://gateway.engagehub.azure.com/*`
- The Engage Center/ReactBlade portal host(s), e.g. `https://*.reactblade.portal.azure.net/*`

> **Important:** Do not request broad host access such as `<all_urls>` unless proven necessary.

---

## 17) Proposed Architecture

### Components

#### 1. Popup UI
Responsible for: Case ID input, status display, results rendering, user actions (fetch, copy, clear, open portal).

#### 2. Background Service Worker
Responsible for: listening for relevant outbound requests, capturing auth context in memory, executing case fetch, centralizing error handling, maintaining minimal session metadata.

> MV3 uses a service worker instead of a persistent background page.

#### 3. Optional Content Script
Responsible for: detecting portal presence, relaying page state to extension, fallback integration if network observation alone is insufficient.

> Content scripts can manipulate/read the DOM and message the extension, but they do not automatically share page JS context because they run in isolated worlds.

#### 4. Session Manager
Responsible for: storing ephemeral auth context in memory, validating freshness, clearing session on auth failure.

#### 5. Case API Client
Responsible for: building request, attaching headers, parsing response, normalizing errors.

---

## 18) Data Model

### In-Memory Session Object

```json
{
  "authorization": "Bearer <redacted>",
  "scope": "agreements/<guid>",
  "capturedAt": "2026-04-01T10:40:14Z",
  "sourceHost": "gateway.engagehub.azure.com",
  "status": "connected"
}
```

### Recent Case Record (Persistent, Non-Sensitive)

```json
{
  "caseId": "2603270050001469",
  "lastFetchedAt": "2026-04-01T10:41:00Z"
}
```

### Case Result Object

```json
{
  "caseId": "2603270050001469",
  "fetchedAt": "2026-04-01T10:41:00Z",
  "payload": {}
}
```

---

## 19) Validation Rules

### Case ID Input

- Required
- Numeric string
- Expected length validation configurable
- Trim whitespace
- Reject non-supported formats with inline validation

---

## 20) Security & Privacy Requirements

| Requirement | Detail |
|---|---|
| **No manual token entry** | Avoid exposing JWT handling to end users |
| **No persistent token storage** | Store tokens in memory only; clear on browser restart, logout detection, or auth failure |
| **No secret logging** | Never log full `Authorization` headers; mask tokens in debug output |
| **Least privilege** | Limit permissions and host patterns; avoid broad URL access |
| **Internal distribution first** | Start as a sideloaded internal extension before considering store publication |
| **No remote executable code** | All code must ship in the extension package under MV3 expectations |

---

## 21) Risks and Mitigations

| Risk | Description | Mitigation |
|---|---|---|
| **Token/header format changes** | Engage Center changes auth/header behavior | Centralize header detection logic; support configurable header names |
| **Portal host changes** | `sandbox-4.reactblade.portal.azure.net` may vary by environment | Allow configurable match patterns for approved portal hosts |
| **Session unavailable until portal makes a request** | Extension may not have auth context immediately | Provide UI guidance: *"Open a case in Engage Center first"* |
| **MV3 service worker lifecycle** | Background service worker may unload and lose in-memory session | Reacquire session on next observed request; store only non-sensitive metadata persistently |
| **Security review concerns** | Extension that observes auth headers may trigger internal scrutiny | Internal-only distribution, documented threat model, no persistence of credentials, masked logging, explicit approval |

---

## 22) Success Metrics

### Adoption Metrics
- Number of weekly active users
- Number of fetched cases per week

### Efficiency Metrics
- Average time from popup open to case data display
- Reduction in manual DevTools-based case retrieval

### Reliability Metrics
- Successful fetch rate
- Session detection success rate
- Error rate by category (401/403/404/network)

### Security Metrics
- Zero incidents of token persistence
- Zero logs containing full tokens

---

## 23) MVP Acceptance Criteria

The MVP is complete when:

- [ ] User can install the extension in Edge/Chromium.
- [ ] User can open the popup and see session status.
- [ ] If logged in to Engage Center and auth context has been captured, user can fetch a case by Case ID.
- [ ] Case JSON is displayed and can be copied.
- [ ] Token is never shown in UI and is not stored persistently.
- [ ] Clear error messages exist for no-session, expired-session, unauthorized, and case-not-found scenarios.

---

## 24) Suggested Milestones

**Milestone 1 — Technical Spike**
- Validate whether `webRequest` reliably exposes `Authorization` and `x-eh-scope`
- Confirm exact host patterns required
- Confirm whether all needed requests originate from stable portal hosts

**Milestone 2 — MVP Build**
- Popup UI
- Session manager
- Request observer
- Case fetch client
- Error handling

**Milestone 3 — Hardening**
- Logging hygiene
- Permission review
- UX improvements
- Regression test pass

**Milestone 4 — Pilot**
- Roll out internally to small support team
- Collect feedback
- Decide on v1.1 backlog

---

## 25) QA / Test Plan

### Functional Tests
- Fetch valid case with valid session
- Fetch invalid/nonexistent case
- Fetch with expired token
- Fetch with missing `x-eh-scope`
- Fetch after browser restart
- Fetch after re-login

### UX Tests
- Empty state clarity
- Error readability
- Copy JSON action
- Long payload rendering

### Security Tests
- Confirm JWT never persists in `chrome.storage`
- Confirm logs redact auth headers
- Confirm extension cannot run outside intended hosts

### Compatibility Tests
- Microsoft Edge latest stable
- Chrome latest stable *(optional if Edge is primary target)*

---

## 26) Open Questions

1. Are there multiple production portal hostnames beyond `sandbox-4.reactblade.portal.azure.net`?
2. Is `x-eh-scope` always mandatory, and is it stable across tenants/environments?
3. Does the API require any additional hidden headers or cookies beyond the observed request?
4. Should the extension display raw JSON only, or also a curated summary view?
5. Is internal-only sideload distribution sufficient, or is Edge Add-ons publication required later?

---

## 27) Recommended Engineering Decision Summary

| Decision | Choice |
|---|---|
| **Browser** | Microsoft Edge first |
| **Extension model** | Manifest V3 |
| **Auth strategy** | Observe authenticated portal requests; reuse auth context in memory |
| **UI** | Simple popup |
| **Storage** | Recent case IDs only; no persistent JWT storage |
| **Fallback plan** | Page-context bridge only if request observation fails |

---

## 28) Simple Wireframe

```
+--------------------------------------------------+
| Engage Center Case Fetcher                       |
| Session: Connected                               |
+--------------------------------------------------+
| Case ID                                          |
| [ 2603270050001469                         ]     |
|                                                  |
| [ Fetch Case ]   [ Open Portal ]                 |
|                                                  |
| Result                                           |
| ------------------------------------------------ |
| Summary                                          |
| - Case ID: 2603270050001469                      |
| - Status: Open                                   |
| - Severity: ...                                  |
| - Created: ...                                   |
|                                                  |
| [ Copy JSON ] [ Clear ]                          |
|                                                  |
| Raw JSON                                         |
| {                                                |
|   ...                                            |
| }                                                |
+--------------------------------------------------+
```

---

## 29) Final Recommendation

Build this as a small internal MV3 Edge extension that:

- Observes authenticated Engage Center network traffic
- Captures `Authorization` + `x-eh-scope` in memory only
- Uses a minimal popup UI to fetch cases by Case ID
- Avoids persistent token storage entirely
- Starts as an internal pilot before any broader rollout

This gives you the simplest viable solution with the lowest operational friction and the cleanest user experience.
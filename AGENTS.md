# AGENTS.md — Engage Center Case Fetcher Extension

This file provides guidance for agentic coding agents operating in this repository.

---

## Project Overview

A Microsoft Edge/Chromium browser extension (Manifest V3) that allows support engineers to fetch case details from Engage Center by entering a Case ID. The extension reuses the user's existing authenticated browser session rather than requiring manual token entry.

**Key Security Principle:** JWT tokens must NEVER be persisted to storage. Keep auth context in memory only.

---

## Build / Lint / Test Commands

Since this is an early-stage project (no code yet), use these commands once the extension structure is established:

```bash
# Load extension in Edge/Chrome
# Navigate to: chrome://extensions (Edge: edge://extensions)
# Enable "Developer mode" → "Load unpacked" → select extension root

# Run tests (when implemented)
npm test

# Run tests in watch mode
npm test -- --watch

# Run a single test file
npm test -- <test-file-path>

# Lint (when configured)
npm run lint

# Type check (if using TypeScript)
npm run typecheck
```

---

## Code Style Guidelines

### General Principles

- **Modular architecture**: Separate popup UI, background service worker, session manager, and case API client into distinct modules/files
- **No magic strings**: Extract URLs, header names, error codes into a constants/config file
- **Zero JWT persistence**: Never use `chrome.storage.local` or `chrome.storage.sync` for tokens
- **Masked logging**: Never log full `Authorization` headers; mask as `Bearer [REDACTED]`

### File Structure

```
/
├── manifest.json              # MV3 extension manifest
├── popup/
│   ├── popup.html             # Popup UI markup
│   ├── popup.js               # Popup logic
│   └── popup.css              # Popup styles
├── background/
│   └── service-worker.js      # MV3 service worker
├── modules/
│   ├── constants.js            # URLs, headers, error codes
│   ├── session-manager.js     # In-memory auth context
│   └── case-api-client.js     # API fetch logic
├── content/
│   └── content-script.js     # Optional fallback
└── assets/                    # Icons, images
```

### Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Files | kebab-case | `session-manager.js` |
| Functions | camelCase | `getSession()` |
| Classes | PascalCase | `CaseApiClient` |
| Constants | UPPER_SNAKE_CASE | `API_BASE_URL` |
| DOM elements | Descriptive with prefix | `btnFetchCase`, `inputCaseId` |

### Type Annotations

- Use JSDoc comments for all public functions
- Document parameter types, return types, and exceptions
- Example:
  ```javascript
  /**
   * @typedef {Object} SessionContext
   * @property {string} authorization - Bearer token (masked in logs)
   * @property {string} scope - x-eh-scope header value
   * @property {string} capturedAt - ISO timestamp
   * @property {string} sourceHost - Origin host
   * @property {'connected'|'expired'} status
   */

  /**
   * @param {string} caseId
   * @param {SessionContext} session
   * @returns {Promise<CaseResult>}
   * @throws {SessionError|NetworkError|CaseNotFoundError}
   */
  ```

### Import Patterns

```javascript
// Use ES modules if bundler is configured
import { API_BASE_URL, CASE_ENDPOINT } from './modules/constants.js';

// Otherwise use explicit require for Chrome APIs
const { runtime, storage } = chrome;
```

### Error Handling

- Use specific error types with clear messages
- Normalize all API errors to these codes:
  - `SESSION_EXPIRED` — 401/403 response
  - `CASE_NOT_FOUND` — 404 response
  - `NETWORK_ERROR` — Request failed
  - `NO_SESSION` — No auth context available
  - `INVALID_INPUT` — Invalid Case ID format

### Manifest V3 Requirements

- Use service worker instead of background page
- Declare all permissions explicitly in `manifest.json`
- Use `host_permissions` for API endpoints, not `<all_urls>`
- No remote hosted code (MV3 compliance)
- Required permissions: `storage`, `webRequest`, `scripting` (if needed)

### Security Checklist

- [ ] JWT never stored in `chrome.storage`
- [ ] `Authorization` header masked in all logs
- [ ] No `<all_urls>` host permission
- [ ] No external code execution
- [ ] Service worker handles lifecycle (re-acquire session on wake)

### UI/UX Guidelines

- Display session status: `Connected` | `Not detected` | `Expired`
- Show loading state during fetch (spinner + "Fetching case…")
- Display errors with actionable messages
- Include "Copy JSON" and "Clear" actions
- Support empty state when no session detected
- Follow PRD wireframe layout (docs/PRD.md §28)

### Testing Guidelines

- Test happy path: session detected → case fetched → JSON displayed
- Test error paths: no session, expired token, case not found, network failure
- Test service worker restart behavior
- Test with large JSON payloads
- Verify JWT never appears in storage or logs

---

## Documentation References

- **PRD**: `docs/PRD.md` — Full product requirements
- **Tasks**: `docs/TASKS.md` — Milestones and checklist

---

## Open Questions (from PRD §26)

These should be resolved during Milestone 1 (Technical Spike):

1. Are there multiple production portal hostnames beyond `sandbox-4.reactblade.portal.azure.net`?
2. Is `x-eh-scope` always mandatory, and is it stable across tenants/environments?
3. Does the API require any additional hidden headers or cookies beyond the observed request?
4. Should the extension display raw JSON only, or also a curated summary view?
5. Is internal-only sideload distribution sufficient, or is Edge Add-ons publication required later?

---

## Key Technical Decisions (to be made)

- **Auth strategy**: Use `chrome.webRequest` to observe outbound requests and capture auth headers (Option A from PRD)
- **Fallback**: Content script + `window.postMessage` bridge if webRequest proves insufficient (Option B)
- **Build tooling**: Choose bundler (e.g., esbuild, webpack, rollup) based on team preference
- **Testing framework**: Use Vitest, Jest, or Mocha for unit tests

---

## Notes for Agents

- This is a greenfield project — no existing code to modify yet
- Start by implementing Milestone 1 (Technical Spike) to validate technical assumptions
- Follow the task checklist in `docs/TASKS.md` for development sequence
- Prioritize security requirements from the start — no JWT persistence, masked logging
- Keep the extension minimal and focused on the MVP scope defined in PRD §16

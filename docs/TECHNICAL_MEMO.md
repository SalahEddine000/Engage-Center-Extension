# Engage Center Case Fetcher - Technical Spike (M1)

## Status: In Progress

This document captures the technical spike findings for Milestone 1.

---

## What Was Built

A minimal MV3 extension proof-of-concept with:

1. **manifest.json** - MV3 manifest with:
   - `webRequest` permission for observing requests
   - `storage` permission (available for future use)
   - Host permissions for `gateway.engagehub.azure.com` and `*.reactblade.portal.azure.net`
   - Service worker as background script

2. **Service Worker** (`background/service-worker.js`):
   - Uses `chrome.webRequest.onSendHeaders` to observe outbound requests
   - Captures `Authorization` and `x-eh-scope` headers from matching requests
   - Stores auth context in memory only (no persistence)
   - Message handler for popup communication

3. **Modules**:
   - `constants.js` - API endpoints, header names, error codes
   - `session-manager.js` - In-memory session management
   - `case-api-client.js` - API fetch logic with error normalization

4. **Popup UI** (`popup/popup.html/js/css`):
   - Session status badge (Connected/Not detected/Expired)
   - Case ID input with validation
   - Fetch, Copy JSON, Clear, Open Portal buttons
   - Result display with summary and raw JSON toggle

---

## Key Technical Decisions

### Auth Strategy: Option A (webRequest)
- Using `chrome.webRequest.onSendHeaders` to capture auth headers
- Filters for requests to Engage Hub endpoints
- Extracts both `Authorization` and `x-eh-scope` headers
- Stores only in service worker memory (no chrome.storage)

### Security Principles Applied
- JWT never persisted to storage
- Auth headers masked in logs (`Bearer [REDACTED]`)
- No `<all_urls>` permission
- MV3 compliant (no remote code)

---

## Testing Required

To validate the technical assumptions, the extension needs to be loaded in a browser:

1. Open Edge/Chrome and navigate to `edge://extensions` (or `chrome://extensions`)
2. Enable "Developer mode"
3. Click "Load unpacked" and select the extension root directory
4. Open Engage Center portal and sign in
5. Open a case in the portal
6. Click the extension icon to check session detection
7. Try fetching a case by ID

---

## Findings to Validate

- [ ] webRequest listener successfully captures Authorization header
- [ ] webRequest listener successfully captures x-eh-scope header
- [ ] Captured token can replay GET /support/cases/<CaseID> successfully
- [ ] No CORS issues when calling API from service worker
- [ ] Service worker correctly re-acquires session on wake

---

## Open Questions (from PRD §26)

1. **Portal hostnames**: Are there multiple beyond `sandbox-4.reactblade.portal.azure.net`?
   - Current implementation uses wildcards: `*.reactblade.portal.azure.net`

2. **x-eh-scope stability**: Is it always mandatory and stable across tenants?
   - Implementation assumes it's required; testing will confirm

3. **Additional headers/cookies**: Does API require anything beyond observed headers?
   - Current implementation captures what was observed; may need adjustment

4. **Raw JSON vs Summary**: Display both (implemented in popup)

5. **Distribution**: Internal sideload (sufficient for MVP)

---

## Next Steps

1. **Load and test in browser** - Validate webRequest feasibility
2. **If webRequest insufficient**, implement Option B fallback
3. **Document go/no-go decision** for MVP build
4. **Finalize manifest permissions** based on testing

---

## File Structure

```
/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── background/
│   └── service-worker.js
├── modules/
│   ├── constants.js
│   ├── session-manager.js
│   └── case-api-client.js
└── docs/
    ├── PRD.md
    └── TASKS.md
```
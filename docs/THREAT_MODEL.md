# Threat Model — Engage Center Case Fetcher Extension

> Version 1.0 · 01 Apr 2026

---

## 1. Scope

This document covers security considerations for the Engage Center Case Fetcher browser extension (Manifest V3).

---

## 2. Trust Boundaries

| Component | Trust Level | Notes |
|-----------|-------------|-------|
| User's browser | Trusted | Extension runs in user's browser context |
| Engage Center portal | Trusted | Source of auth tokens |
| Gateway API | Trusted | Target API for case data |
| Extension code itself | Trusted | All code is local, no remote execution |

---

## 3. Assets (Security-Sensitive)

| Asset | Sensitivity | Protection |
|-------|-------------|------------|
| JWT Authorization token | High | In-memory only, never persisted |
| x-eh-scope header | Medium | In-memory only, never persisted |
| Case data (PII) | High | Displayed only in popup, not stored |

---

## 4. Threats & Mitigations

### T1: Token Persistence

**Threat:** JWT written to `chrome.storage.local` or `chrome.storage.sync`

**Mitigation:** 
- Session stored in service worker memory only
- No `chrome.storage` calls anywhere in codebase
- Service worker restart clears memory automatically

**Status:** ✅ Mitigated

---

### T2: Token Logging

**Threat:** Full `Authorization` header logged to console

**Mitigation:**
- All auth logs use `Bearer [REDACTED]` mask
- Audit logs capture only: event type, success/failure, error code

**Status:** ✅ Mitigated

---

### T3: Host Permission Overreach

**Threat:** Extension requests `<all_urls>` permission

**Mitigation:**
- Specific host patterns only:
  - `https://gateway.engagehub.azure.com/*`
  - `https://*.reactblade.portal.azure.net/*`

**Status:** ✅ Mitigated

---

### T4: Remote Code Execution

**Threat:** Extension loads remote JavaScript

**Mitigation:**
- All code is local (MV3 requirement)
- No `eval()`, `new Function()`, or external script tags

**Status:** ✅ Mitigated

---

### T5: Service Worker Lifecycle

**Threat:** Session persists after browser restart

**Mitigation:**
- Service worker memory cleared on browser restart
- Session age limited to 30 minutes (configurable)

**Status:** ✅ Mitigated

---

### T6: XSS in Popup

**Threat:** Malicious case data executed as script

**Mitigation:**
- Case JSON displayed via `textContent` (not `innerHTML`)
- No user input rendered as HTML

**Status:** ✅ Mitigated

---

## 5. Permissions Required

| Permission | Purpose | Risk |
|------------|---------|------|
| `webRequest` | Observe outbound requests to capture auth headers | Low — read-only observation |
| `storage` | Reserved for future UI state (NOT for tokens) | Low — not used for auth |
| `host_permissions` | Access Engage Center endpoints only | Low — specific patterns only |

---

## 6. Audit Summary

| Check | Result |
|-------|--------|
| JWT persisted to storage | ❌ Not found |
| Auth header logged in full | ❌ Not found |
| `<all_urls>` permission | ❌ Not found |
| Remote code execution | ❌ Not found |
| XSS vectors | ❌ Not found |

**Conclusion:** No critical security findings.

---

## 7. Sign-Off

| Role | Name | Date |
|------|------|------|
| Security Reviewer | — | — |
| Tech Lead | — | — |

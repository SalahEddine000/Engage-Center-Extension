# Changelog — Engage Center Case Fetcher

All notable changes to this project will be documented in this file.

---

## [1.0.0] - Pilot Release

### Added
- MVP extension with session capture via webRequest
- Popup UI with session status, case input, fetch/copy/clear actions
- JSON syntax highlighting
- Copy Summary button
- In-memory session management (no JWT persistence)
- Debug mode for development
- Request timeout (15s)
- Full JSDoc documentation

### Security
- Zero JWT persistence (in-memory only)
- Authorization header masked in logs
- No `<all_urls>` permission
- MV3 compliant (no remote code)

---

## [0.1.0] - Technical Spike

### Added
- Proof-of-concept MVP
- webRequest listener for auth capture
- Content script fallback (not used in MVP)
